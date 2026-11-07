//! Night Guard Wallet: a vault on Solana that keeps an older person's savings safe from scams.
//!
//! The rules live on-chain, so nobody can switch them off: not the scammer on the phone, not a
//! fake "bank support" page, and not the owner while under pressure.
//!
//! - Money only goes out to **trusted contacts**. Adding one needs the owner AND the family guardian.
//! - A **daily limit**: small payments to trusted contacts go out at once, up to the limit.
//! - Anything else becomes a **request**: a new wallet, over the limit or a big amount needs the
//!   guardian's on-chain approval, and big amounts wait a **cooling-off period** before they can go out.
//! - Every request emits an event, so the family sees it live from the chain.
//! - A community scam list: when a guardian refuses a scam, they can report the wallet on-chain.
//!   Every Night Guard wallet reads the list, so one family's "no" protects every other family.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8vE76ymUvgkQdwBmtQ68kVuaxPvUVN7YymSpSkf3hwtn");

pub const MAX_TRUSTED: usize = 8;
const DAY: i64 = 86_400;

#[program]
pub mod guardian_vault {
    use super::*;

    /// Opens the vault for `owner` and names the family guardian.
    pub fn initialize(
        ctx: Context<Initialize>,
        guardian: Pubkey,
        daily_limit: u64,
        large_amount: u64,
        cooling_off_secs: i64,
    ) -> Result<()> {
        require!(guardian != ctx.accounts.owner.key(), VaultError::GuardianIsOwner);
        require!(cooling_off_secs >= 0, VaultError::BadSettings);
        let v = &mut ctx.accounts.vault;
        v.owner = ctx.accounts.owner.key();
        v.guardian = guardian;
        v.daily_limit = daily_limit;
        v.large_amount = large_amount;
        v.cooling_off_secs = cooling_off_secs;
        v.day = Clock::get()?.unix_timestamp / DAY;
        v.spent_today = 0;
        v.next_request = 0;
        v.trusted = Vec::new();
        v.bump = ctx.bumps.vault;
        emit!(VaultOpened { vault: v.key(), owner: v.owner, guardian, daily_limit, large_amount, cooling_off_secs });
        Ok(())
    }

    /// Anyone can put money in. Taking it out follows the rules below.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer { from: ctx.accounts.payer.to_account_info(), to: ctx.accounts.vault.to_account_info() },
            ),
            amount,
        )
    }

    /// Adding a trusted contact needs two signatures: the owner and the guardian.
    /// A scammer who talks the owner into signing still can't add their own wallet.
    pub fn add_trusted(ctx: Context<OwnerAndGuardian>, contact: Pubkey) -> Result<()> {
        let v = &mut ctx.accounts.vault;
        require!(!v.trusted.contains(&contact), VaultError::AlreadyTrusted);
        require!(v.trusted.len() < MAX_TRUSTED, VaultError::TooManyContacts);
        require!(contact != v.key(), VaultError::BadSettings);
        v.trusted.push(contact);
        emit!(TrustedChanged { vault: v.key(), contact, added: true });
        Ok(())
    }

    /// Removing a contact only makes the vault safer, so the owner or the guardian can do it alone.
    pub fn remove_trusted(ctx: Context<OwnerOrGuardian>, contact: Pubkey) -> Result<()> {
        let v = &mut ctx.accounts.vault;
        let pos = v.trusted.iter().position(|c| *c == contact).ok_or(VaultError::NotTrusted)?;
        v.trusted.remove(pos);
        emit!(TrustedChanged { vault: v.key(), contact, added: false });
        Ok(())
    }

    /// Changing the limits needs both signatures.
    pub fn set_limits(ctx: Context<OwnerAndGuardian>, daily_limit: u64, large_amount: u64, cooling_off_secs: i64) -> Result<()> {
        require!(cooling_off_secs >= 0, VaultError::BadSettings);
        let v = &mut ctx.accounts.vault;
        v.daily_limit = daily_limit;
        v.large_amount = large_amount;
        v.cooling_off_secs = cooling_off_secs;
        emit!(LimitsChanged { vault: v.key(), daily_limit, large_amount, cooling_off_secs });
        Ok(())
    }

    /// An everyday payment: goes out at once only to a trusted contact, under the daily limit
    /// and below the "large amount". Anything else is refused by the chain.
    pub fn send(ctx: Context<Send>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        let now = Clock::get()?.unix_timestamp;
        let to = ctx.accounts.to.key();
        {
            let v = &mut ctx.accounts.vault;
            roll_day(v, now);
            require!(v.trusted.contains(&to), VaultError::NotTrusted);
            require!(amount < v.large_amount, VaultError::NeedsCoolingOff);
            let after = v.spent_today.checked_add(amount).ok_or(VaultError::OverDailyLimit)?;
            require!(after <= v.daily_limit, VaultError::OverDailyLimit);
            v.spent_today = after;
        }
        pay(&ctx.accounts.vault.to_account_info(), &ctx.accounts.to.to_account_info(), amount)?;
        emit!(Sent { vault: ctx.accounts.vault.key(), to, amount });
        Ok(())
    }

    /// Asks to send money that the everyday path refuses. The chain decides, from its own rules,
    /// whether the guardian must approve and how long the money must wait.
    pub fn request(ctx: Context<Request>, amount: u64, note: [u8; 32]) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        let now = Clock::get()?.unix_timestamp;
        let to = ctx.accounts.to.key();
        let v = &mut ctx.accounts.vault;
        roll_day(v, now);
        let trusted = v.trusted.contains(&to);
        let over_limit = v.spent_today.saturating_add(amount) > v.daily_limit;
        let large = amount >= v.large_amount;
        let r = &mut ctx.accounts.req;
        r.vault = v.key();
        r.id = v.next_request;
        r.to = to;
        r.amount = amount;
        r.created_at = now;
        r.unlock_at = if large { now + v.cooling_off_secs } else { now };
        r.needs_guardian = !trusted || over_limit;
        r.status = Status::Pending as u8;
        r.note = note;
        r.bump = ctx.bumps.req;
        v.next_request += 1;
        emit!(RequestOpened {
            vault: r.vault, request: r.key(), id: r.id, to, amount,
            needs_guardian: r.needs_guardian, unlock_at: r.unlock_at, trusted, over_limit, large,
        });
        Ok(())
    }

    /// The family guardian says yes or no, with an on-chain signature.
    pub fn guardian_decide(ctx: Context<GuardianDecide>, approve: bool) -> Result<()> {
        let r = &mut ctx.accounts.req;
        require!(r.status == Status::Pending as u8, VaultError::NotPending);
        r.status = if approve { Status::Approved as u8 } else { Status::Rejected as u8 };
        emit!(GuardianDecided { request: r.key(), approve });
        Ok(())
    }

    /// Sends the money of a request, once its rules are met. Closes the request.
    pub fn execute(ctx: Context<Execute>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let (amount, to, supervised) = {
            let r = &ctx.accounts.req;
            require!(r.status != Status::Rejected as u8, VaultError::Rejected);
            require!(!r.needs_guardian || r.status == Status::Approved as u8, VaultError::NeedsGuardian);
            require!(now >= r.unlock_at, VaultError::StillCoolingOff);
            require_keys_eq!(r.to, ctx.accounts.to.key(), VaultError::WrongDestination);
            (r.amount, r.to, r.needs_guardian)
        };
        // The daily limit counts what the owner spends alone; a payment the guardian approved does not use it up.
        if !supervised {
            let v = &mut ctx.accounts.vault;
            roll_day(v, now);
            v.spent_today = v.spent_today.saturating_add(amount);
        }
        pay(&ctx.accounts.vault.to_account_info(), &ctx.accounts.to.to_account_info(), amount)?;
        emit!(Executed { request: ctx.accounts.req.key(), to, amount });
        Ok(())
    }

    /// The owner or the guardian drops a request. Closes it.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        emit!(Cancelled { request: ctx.accounts.req.key(), by: ctx.accounts.signer.key() });
        Ok(())
    }

    /// Community scam list: a family guardian reports a wallet that tried to scam their family.
    /// One public record per wallet, counting how many different families reported it; every
    /// Night Guard wallet reads it before signing. Each family can report a wallet only once.
    pub fn report_scam(ctx: Context<ReportScam>, address: Pubkey, reason: u8) -> Result<()> {
        require!(address != ctx.accounts.vault.owner && !ctx.accounts.vault.trusted.contains(&address), VaultError::BadSettings);
        let now = Clock::get()?.unix_timestamp;
        let r = &mut ctx.accounts.report;
        if r.reports == 0 {
            r.address = address;
            r.first_at = now;
            r.bump = ctx.bumps.report;
        }
        r.reports = r.reports.saturating_add(1);
        r.last_at = now;
        r.last_reason = reason;
        ctx.accounts.mark.bump = ctx.bumps.mark;
        emit!(ScamReported { address, vault: ctx.accounts.vault.key(), reports: r.reports, reason });
        Ok(())
    }
}

fn roll_day(v: &mut Vault, now: i64) {
    let today = now / DAY;
    if today != v.day {
        v.day = today;
        v.spent_today = 0;
    }
}

/// Moves lamports out of the vault, which this program owns. The vault always keeps its rent.
fn pay<'a>(vault: &AccountInfo<'a>, to: &AccountInfo<'a>, amount: u64) -> Result<()> {
    let rent = Rent::get()?.minimum_balance(vault.data_len());
    let available = vault.lamports().saturating_sub(rent);
    require!(amount <= available, VaultError::NotEnoughMoney);
    **vault.try_borrow_mut_lamports()? -= amount;
    **to.try_borrow_mut_lamports()? += amount;
    Ok(())
}

#[repr(u8)]
pub enum Status { Pending = 0, Approved = 1, Rejected = 2 }

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub guardian: Pubkey,
    pub daily_limit: u64,
    pub large_amount: u64,
    pub cooling_off_secs: i64,
    pub day: i64,
    pub spent_today: u64,
    pub next_request: u64,
    #[max_len(MAX_TRUSTED)]
    pub trusted: Vec<Pubkey>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TransferRequest {
    pub vault: Pubkey,
    pub id: u64,
    pub to: Pubkey,
    pub amount: u64,
    pub created_at: i64,
    pub unlock_at: i64,
    pub needs_guardian: bool,
    pub status: u8,
    pub note: [u8; 32],
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = 8 + Vault::INIT_SPACE, seeds = [b"vault", owner.key().as_ref()], bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"vault", vault.owner.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerAndGuardian<'info> {
    pub owner: Signer<'info>,
    pub guardian: Signer<'info>,
    #[account(mut, seeds = [b"vault", owner.key().as_ref()], bump = vault.bump, has_one = owner, has_one = guardian)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct OwnerOrGuardian<'info> {
    #[account(constraint = signer.key() == vault.owner || signer.key() == vault.guardian @ VaultError::NotAllowed)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"vault", vault.owner.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct Send<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"vault", owner.key().as_ref()], bump = vault.bump, has_one = owner)]
    pub vault: Account<'info, Vault>,
    /// CHECK: only receives lamports; must be on the vault's trusted list (checked in the handler).
    #[account(mut)]
    pub to: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Request<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"vault", owner.key().as_ref()], bump = vault.bump, has_one = owner)]
    pub vault: Account<'info, Vault>,
    #[account(init, payer = owner, space = 8 + TransferRequest::INIT_SPACE,
        seeds = [b"req", vault.key().as_ref(), &vault.next_request.to_le_bytes()], bump)]
    pub req: Account<'info, TransferRequest>,
    /// CHECK: the destination is only recorded here.
    pub to: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GuardianDecide<'info> {
    pub guardian: Signer<'info>,
    #[account(has_one = guardian)]
    pub vault: Account<'info, Vault>,
    #[account(mut, has_one = vault)]
    pub req: Account<'info, TransferRequest>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"vault", owner.key().as_ref()], bump = vault.bump, has_one = owner)]
    pub vault: Account<'info, Vault>,
    #[account(mut, has_one = vault, close = owner)]
    pub req: Account<'info, TransferRequest>,
    /// CHECK: must match the request's destination (checked in the handler).
    #[account(mut)]
    pub to: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(constraint = signer.key() == vault.owner || signer.key() == vault.guardian @ VaultError::NotAllowed)]
    pub signer: Signer<'info>,
    /// CHECK: receives the request account's rent; must be the vault owner.
    #[account(mut, address = vault.owner)]
    pub rent_to: UncheckedAccount<'info>,
    pub vault: Account<'info, Vault>,
    #[account(mut, has_one = vault, close = rent_to)]
    pub req: Account<'info, TransferRequest>,
}

#[account]
#[derive(InitSpace)]
pub struct ScamReport {
    pub address: Pubkey,
    pub reports: u32,
    pub first_at: i64,
    pub last_at: i64,
    pub last_reason: u8,
    pub bump: u8,
}

/// Marks that one family (vault) already reported an address, so it counts once.
#[account]
#[derive(InitSpace)]
pub struct ReportMark {
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct ReportScam<'info> {
    #[account(mut)]
    pub guardian: Signer<'info>,
    #[account(has_one = guardian)]
    pub vault: Account<'info, Vault>,
    #[account(init_if_needed, payer = guardian, space = 8 + ScamReport::INIT_SPACE, seeds = [b"scam", address.as_ref()], bump)]
    pub report: Account<'info, ScamReport>,
    #[account(init, payer = guardian, space = 8 + ReportMark::INIT_SPACE, seeds = [b"reported", vault.key().as_ref(), address.as_ref()], bump)]
    pub mark: Account<'info, ReportMark>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct ScamReported { pub address: Pubkey, pub vault: Pubkey, pub reports: u32, pub reason: u8 }
#[event]
pub struct VaultOpened { pub vault: Pubkey, pub owner: Pubkey, pub guardian: Pubkey, pub daily_limit: u64, pub large_amount: u64, pub cooling_off_secs: i64 }
#[event]
pub struct TrustedChanged { pub vault: Pubkey, pub contact: Pubkey, pub added: bool }
#[event]
pub struct LimitsChanged { pub vault: Pubkey, pub daily_limit: u64, pub large_amount: u64, pub cooling_off_secs: i64 }
#[event]
pub struct Sent { pub vault: Pubkey, pub to: Pubkey, pub amount: u64 }
#[event]
pub struct RequestOpened {
    pub vault: Pubkey, pub request: Pubkey, pub id: u64, pub to: Pubkey, pub amount: u64,
    pub needs_guardian: bool, pub unlock_at: i64, pub trusted: bool, pub over_limit: bool, pub large: bool,
}
#[event]
pub struct GuardianDecided { pub request: Pubkey, pub approve: bool }
#[event]
pub struct Executed { pub request: Pubkey, pub to: Pubkey, pub amount: u64 }
#[event]
pub struct Cancelled { pub request: Pubkey, pub by: Pubkey }

#[error_code]
pub enum VaultError {
    #[msg("This wallet is not on your trusted contacts list")]
    NotTrusted,
    #[msg("This goes over today's limit")]
    OverDailyLimit,
    #[msg("Big amount: it must wait the cooling-off period")]
    NeedsCoolingOff,
    #[msg("The family guardian has to approve this first")]
    NeedsGuardian,
    #[msg("Still in the cooling-off period")]
    StillCoolingOff,
    #[msg("The family guardian said no")]
    Rejected,
    #[msg("This request was already decided")]
    NotPending,
    #[msg("Destination does not match the request")]
    WrongDestination,
    #[msg("Not enough money in the vault")]
    NotEnoughMoney,
    #[msg("Only the owner or the guardian can do this")]
    NotAllowed,
    #[msg("The guardian must be someone else")]
    GuardianIsOwner,
    #[msg("Contact already trusted")]
    AlreadyTrusted,
    #[msg("Too many trusted contacts")]
    TooManyContacts,
    #[msg("Invalid settings")]
    BadSettings,
    #[msg("Amount must be more than zero")]
    ZeroAmount,
}
