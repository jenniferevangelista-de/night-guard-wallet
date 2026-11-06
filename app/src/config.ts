import { homedir } from "node:os";
import { join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import idl from "./idl/guardian_vault.json" with { type: "json" };

export const RPC_URL = process.env.NGW_RPC ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(idl.address);
export const IDL = idl;

// Demo keypairs live outside the repository (never committed).
export const KEY_DIR = process.env.NGW_KEYS ?? join(homedir(), ".config", "ngw");
export const DEMO_DIR = join(KEY_DIR, "demo");

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
export const MODEL = process.env.NGW_MODEL ?? "gemma4:e2b";
// "ollama": Gemma reads the message and writes the explanation. "template": no model, fixed texts.
export const AI = (process.env.NGW_AI ?? "ollama") as "ollama" | "template";

export const PORT = Number(process.env.PORT ?? 8787);

// Demo vault settings (lamports / seconds). Real life: cooling-off of 24 h.
export const LAMPORTS = 1_000_000_000;
export const DAILY_LIMIT = 0.5 * LAMPORTS;
export const LARGE_AMOUNT = 1.0 * LAMPORTS;
export const COOLING_OFF_SECS = Number(process.env.NGW_COOLING_OFF ?? 60);
