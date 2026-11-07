"""Builds Ana's guardian page for the interactive web replay (docs/demo/family.html) from the real page
(app/web/family.html). The requests and alerts come from the recorded devnet run; every decision Ana takes here
opens the real transaction of that decision on Solana Explorer.   python docs/demo/build_family.py
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
s = (ROOT / "app" / "web" / "family.html").read_text(encoding="utf-8")
ver = hashlib.sha1((ROOT / "app" / "web" / "style.css").read_bytes()).hexdigest()[:8]


def rep(s, old, new):
    assert old in s, old[:70]
    return s.replace(old, new, 1)


s = rep(s, '<link rel="stylesheet" href="style.css">', f'''<link rel="stylesheet" href="style.css?v={ver}">
<style>
  .replay {{ max-width:1180px; margin:16px auto 0; padding:12px 18px; background:#fff3d6; border:2px solid #9a5b00; border-radius:14px; font-size:.8em; }}
  .ok {{ margin:0 0 12px; padding:12px 16px; border-radius:14px; background:#e3f6ea; border:3px solid var(--green); font-weight:600; }}
</style>''')
s = rep(s, '<main>', '''<div class="replay"><b data-t="replayTitle"></b> <span data-t="replayText"></span>
  <a href="index.html" data-t="backWallet"></a> · <a href="https://youtu.be/rZ3oyl6PMTw" target="_blank">video</a></div>
<main>''')
s = rep(s, '''    <h2 data-t="decide"></h2>''', '''    <h2 data-t="decide"></h2>
    <div id="done"></div>''')
s = rep(s, 'RequestOpened: "Novo pedido no cofre",', 'replayTitle: "🎬 Repetição interativa de uma rodada real na devnet da Solana.", replayText: "Os pedidos e alertas são os reais; cada decisão da Ana abre a transação real dela na Solana Explorer.", backWallet: "← Carteira da Dona Lúcia", doneNo: "A Ana disse NÃO, com a própria assinatura na Solana. O dinheiro não saiu.", doneYes: "A Ana aprovou, com a própria assinatura. O cofre ainda segura o valor pelo período de espera e depois envia.", doneReport: "E denunciou a carteira na lista comunitária: todas as famílias são avisadas.", seeTx: "Ver na Solana", RequestOpened: "Novo pedido no cofre",')
s = rep(s, 'RequestOpened: "New request in the vault",', 'replayTitle: "🎬 Interactive replay of a real run on Solana devnet.", replayText: "The requests and alerts are the real ones; every decision Ana takes opens her real transaction on Solana Explorer.", backWallet: "← Lucy\'s wallet", doneNo: "Ana said NO, with her own signature on Solana. The money never left.", doneYes: "Ana approved, with her own signature. The vault still holds the money for the cooling-off, then sends it.", doneReport: "And she reported the wallet on the community list: every family is warned.", seeTx: "See it on Solana", RequestOpened: "New request in the vault",')
s = s.replace('let lang = localStorage.lang || "en";', 'let lang = "en";')

# server calls -> the recorded run
s = rep(s, '''async function api(p, b) { const r = await fetch(p, b ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) } : {}); return r.json(); }''', '''const D = "data/";
const getJ = async (p) => (await fetch(p)).json();
let PROOFS = null;
const proof = async (re) => { PROOFS ??= (await getJ("../results.json")).proofs; return PROOFS.find((p) => re.test(p.name)); };
const sigOf = (link) => link.split("/tx/")[1].split("?")[0];
const short = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const sol = (l) => `${(l / 1e9).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 4 })} SOL`;
let REQS = null, SC = null;
async function init() {
  if (REQS) return;
  SC = await getJ(D + "scenarios.json");
  const fr = await getJ(D + "check_fake-relative_en_fast.json");
  const car = await getJ(D + "check_car-repair_en_fast.json");
  const p1 = await proof(/request opened for the 'new number'/), p2 = await proof(/request opened: 1 SOL to Pedro/);
  REQS = [
    { address: "r1", id: 1, lamports: fr.amountLamports, to: fr.destination, toKnown: false, note: "fake-relative", link: p1.link, status: "pending" },
    { address: "r2", id: 2, lamports: car.amountLamports, to: car.destination, toKnown: true, note: "car-repair", link: p2.link, status: "pending" },
  ];
  const now = Date.now();
  for (const [i, id] of ["fake-support", "airdrop-drainer", "fake-token-fee"].entries()) {
    const c = await getJ(`${D}check_${id}_en_fast.json`);
    feed.push({ type: "blocked", id, title: SC.find((x) => x.id === id).title, lamports: c.amountLamports, flags: c.flags.slice(0, 3), at: now - (9 - i) * 60000 });
  }
  feed.push({ type: "chain", name: "RequestOpened", data: { needs_guardian: true, trusted: true, over_limit: true, large: true }, sig: sigOf(p2.link), link: p2.link, at: now - 120000 });
  feed.push({ type: "chain", name: "RequestOpened", data: { needs_guardian: true, trusted: false, over_limit: true, large: true }, sig: sigOf(p1.link), link: p1.link, at: now - 60000 });
  render();
}
async function api(p) {
  await init();
  return { requests: REQS.map((r) => ({ ...r, needsGuardian: true, amountTxt: sol(r.lamports), toName: r.toKnown ? (lang === "pt" ? "Pedro (filho)" : "Pedro (son)") : short(r.to) })) };
}''')
s = rep(s, '''async function decide(req, approve, reportTo) {
  document.querySelectorAll(".req button").forEach((b) => (b.disabled = true));
  const r = await api("/api/guardian/decide", { request: req, approve });
  if (r.error) { alert(r.error); }
  if (reportTo) await report(reportTo, null, req);
  load();
}''', '''async function decide(req, approve, reportTo) {
  const r = REQS.find((x) => x.address === req);
  r.status = approve ? "approved" : "rejected";
  const d = await proof(approve ? /guardian Ana approves/ : /guardian Ana says NO/);
  feed.push({ type: "chain", name: "GuardianDecided", data: { approve }, sig: sigOf(d.link), link: d.link, at: Date.now() });
  let html = `<p>${approve ? "✅" : "⛔"} ${approve ? t("doneYes") : t("doneNo")} <a href="${d.link}" target="_blank">${t("seeTx")} ↗</a></p>`;
  if (reportTo) {
    const rp = await proof(/^Ana reports/);
    feed.push({ type: "chain", name: "ScamReported", data: {}, sig: sigOf(rp.link), link: rp.link, at: Date.now() + 1 });
    html += `<p>🚩 ${t("doneReport")} <a href="${rp.link}" target="_blank">${t("seeTx")} ↗</a></p>`;
  }
  if (approve) {
    const ex = await proof(/after the cooling-off/);
    setTimeout(() => { feed.push({ type: "chain", name: "Executed", data: {}, sig: sigOf(ex.link), link: ex.link, at: Date.now() }); render(); }, 2500);
  }
  $("#done").innerHTML = `<div class="ok">${html}</div>`;
  render(); load();
}''')
s = rep(s, '''    if (ev.type === "blocked") return `<div class="ev blocked"><b>⛔ ${t("blocked")}: ${esc(ev.title[lang])}</b> ${esc(ev.amountTxt)}''',
        '''    if (ev.type === "blocked") return `<div class="ev blocked"><b>⛔ ${t("blocked")}: ${esc(ev.title[lang])}</b> ${ev.lamports ? sol(ev.lamports) : ""}''')
s = rep(s, '''const es = new EventSource("/api/events");
es.onmessage = (m) => { const ev = JSON.parse(m.data); feed.push(ev); render(); load();
  if (ev.type === "blocked" && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(t("blocked") + ": " + ev.title[lang]); u.lang = lang === "pt" ? "pt-BR" : "en-US"; speechSynthesis.speak(u); } };
''', '')
s = rep(s, 'labels(); load(); setInterval(load, 30000);', 'labels(); load();')
s = s.replace('<title>Night Guard Wallet · Ana</title>', '<title>Night Guard Wallet · Ana (interactive demo)</title>')
(ROOT / "docs" / "demo" / "family.html").write_text(s, encoding="utf-8", newline="\n")
print("docs/demo/family.html built")
