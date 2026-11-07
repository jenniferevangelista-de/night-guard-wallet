"""Builds the interactive web replay (docs/demo/index.html) from the real wallet page (app/web/index.html).
The page is the same; only the server calls are replaced by the answers recorded from a real devnet run
(docs/demo/data, made by app/src/capture_replay.ts), and a live "try your own message" box runs the scam-trick
rules in the browser.   python docs/demo/build_demo.py
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
src = (ROOT / "app" / "web" / "index.html").read_text(encoding="utf-8")
ai = (ROOT / "app" / "src" / "ai.ts").read_text(encoding="utf-8")
rules = ai[ai.index("const RULES"):ai.index("};", ai.index("const RULES")) + 2]
rules = rules.replace("const RULES: Record<Tactic, RegExp> =", "const RULES =")
shutil.copy(ROOT / "app" / "web" / "style.css", ROOT / "docs" / "demo" / "style.css")


def rep(s, old, new):
    assert old in s, old[:70]
    return s.replace(old, new, 1)


s = src
s = rep(s, '<title>Night Guard Wallet</title>', '<title>Night Guard Wallet · interactive demo</title>')
# the header link already points to family.html (the interactive guardian replay, built by build_family.py)
s = rep(s, '<main>', '''<div class="replay">
  <b data-t="replayTitle"></b> <span data-t="replayText"></span> <span id="when"></span>. <span data-t="replayRun"></span> <a href="https://github.com/jenniferevangelista-de/night-guard-wallet#run-it" target="_blank">README</a> ·
  <a href="https://youtu.be/rZ3oyl6PMTw" target="_blank">video</a> · <a href="../" target="_blank">project page</a>
</div>
<main>''')
# live box under the scenarios
s = rep(s, '''    <div id="scenarios"></div>
  </section>''', '''    <div id="scenarios"></div>
    <div class="req try">
      <b data-t="tryTitle"></b>
      <div class="meta" data-t="tryHint"></div>
      <textarea id="tryText" rows="4"></textarea>
      <button class="big b-check" onclick="tryIt()" data-t="tryBtn"></button>
      <div id="tryOut"></div>
    </div>
  </section>''')
s = rep(s, 'trusted: "Contatos de confiança",', 'trusted: "Contatos de confiança", replayTitle: "🎬 Repetição interativa de uma rodada real na devnet da Solana.", replayText: "Cada veredito, explicação, motivo e fonte é a resposta real do app (simulação na devnet + Gemma 4), gravada em", replayRun: "Os botões que assinam abrem as transações reais na Solana Explorer. Para rodar ao vivo:", tryTitle: "🧪 Teste ao vivo: cole uma mensagem que você recebeu", tryHint: "Roda aqui no seu navegador, com as regras fixas do app (o Gemma roda na nossa máquina).", tryBtn: "Procurar truques de golpe", tryNone: "Nenhum truque das regras fixas encontrado. Isso não prova que é seguro: no app, o Gemma também lê a mensagem.", tryFound: "Truques encontrados:",')
s = rep(s, 'trusted: "Trusted contacts",', 'trusted: "Trusted contacts", replayTitle: "🎬 Interactive replay of a real run on Solana devnet.", replayText: "Every verdict, explanation, flag and source is the real answer of the app (devnet simulation + Gemma 4), recorded", replayRun: "Buttons that sign open the real transactions on Solana Explorer. To run it live:", tryTitle: "🧪 Live test: paste a message you got", tryHint: "Runs right here in your browser with the app\'s fixed rules (Gemma runs on our own machine).", tryBtn: "Find scam tricks", tryNone: "No fixed-rule trick found. That does not prove it is safe: in the app, Gemma reads the message too.", tryFound: "Tricks found:",')
# server calls -> recorded answers
s = rep(s, '''async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  return r.json();
}''', '''const D = "data/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJ = async (p) => (await fetch(p)).json();
let PROOFS = null;
const proof = async (re) => { PROOFS ??= (await getJ("../results.json")).proofs; return PROOFS.find((p) => re.test(p.name)); };
async function api(path, body) {
  if (path.startsWith("/api/state")) return getJ(`${D}state_${lang}.json`);
  if (path === "/api/scenarios") return getJ(`${D}scenarios.json`);
  if (path === "/api/check") {
    const kind = body.phoneMode ? "phone" : body.ai ? "full" : "fast";
    if (body.ai && !body.phoneMode) await sleep(1800);   // Gemma took several seconds on a CPU; shortened here
    const r = await getJ(`${D}check_${body.id}_${body.lang}_${kind}.json`);
    r._audio = `${D}audio/${body.id}_${body.lang}_${kind}.mp3`;   // neural voice: Ava (EN) / Francisca (PT)
    return r;
  }
  if (path === "/api/sign") { const p = await proof(/^legit: groceries/); return { sig: p.link.split("/tx/")[1].split("?")[0], link: p.link, ms: p.ms }; }
  if (path === "/api/ask-family") {
    const s = scen.find((x) => x.id === body.id);
    if (!s.vaultPath) return { alerted: true };
    const p = await proof(body.id === "car-repair" ? /request opened: 1 SOL to Pedro/ : /request opened for the 'new number'/);
    const d = await proof(body.id === "car-repair" ? /guardian Ana approves/ : /guardian Ana says NO/);
    return { request: true, link: p.link, decided: d, car: body.id === "car-repair" };
  }
  return {};
}''')
# "Listen" plays the recorded neural voice; the browser voice is only a fallback
s = rep(s, '''function say() {
  if (!report || !window.speechSynthesis) return;
  speechSynthesis.cancel();''', '''let player = null;
function say() {
  if (!report) return;
  if (player) { player.pause(); player = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (report._audio) {
    player = new Audio(report._audio);
    player.play().catch(() => {});   // browsers may block autoplay until the first click; the Listen button always works
    return;
  }
  if (!window.speechSynthesis) return;''')
# show what Ana did, from the real transactions
s = rep(s, '''  $("#after").innerHTML = r.request ? `<p>👩 ${t("asked")} <a href="${r.link}" target="_blank">Explorer ↗</a></p>` : `<p>👩 ${t("alerted")} ${t("gone")}</p>`;
  loadState();''', '''  $("#after").innerHTML = r.request ? `<p>👩 ${t("asked")} <a href="${r.link}" target="_blank">Explorer ↗</a></p>
    <div class="ana"><a href="family.html" target="_blank"><img src="../screens/3_ana_guardian.png" alt="Ana's guardian page"></a><p>${r.car
      ? (lang === "pt" ? "Na tela dela, a Ana <b>aprovou</b> com a própria assinatura; o cofre ainda segurou o valor pelo período de espera." : "On her page, Ana <b>approved</b> with her own signature; the vault still held the money for the cooling-off.")
      : (lang === "pt" ? "Na tela dela, a Ana disse <b>não</b> com a própria assinatura e denunciou a carteira para todas as famílias." : "On her page, Ana said <b>no</b> with her own signature and reported the wallet to every family.")}
      <a href="${r.decided.link}" target="_blank">${lang === "pt" ? "Ver a decisão na Solana" : "See her decision on Solana"} ↗</a></p></div>` : `<p>👩 ${t("alerted")} ${t("gone")}</p>`;''')
s = rep(s, '''const es = new EventSource("/api/events");
es.onmessage = (m) => { const ev = JSON.parse(m.data); if (ev.type === "chain") loadState(); };
''', f'''{rules}
function tryIt() {{
  const msg = $("#tryText").value.trim();
  if (!msg) return;
  const found = [];
  for (const [id, re] of Object.entries(RULES)) {{ const m = msg.match(re); if (m) found.push({{ id, quote: m[0] }}); }}
  $("#tryOut").innerHTML = found.length
    ? `<p><b>${{t("tryFound")}}</b> ${{found.map((f) => TACTIC[lang][f.id] ?? f.id).join(" · ")}}</p><div class="bubble">${{hl(msg, found.map((f) => f.quote))}}</div>`
    : `<p class="small">${{t("tryNone")}}</p>`;
}}
getJ(D + "captured.json").then((c) => ($("#when").textContent = new Date(c.when).toUTCString())).catch(() => {{}});
''')
s = rep(s, '</style>' if '</style>' in s else '<link rel="stylesheet" href="style.css">', '''<link rel="stylesheet" href="style.css">
<style>
  .replay { max-width:1180px; margin:16px auto 0; padding:12px 18px; background:#fff3d6; border:2px solid #9a5b00; border-radius:14px; font-size:.8em; }
  .try textarea { width:100%; font:inherit; font-size:.85em; padding:10px; border-radius:10px; border:1px solid #cfc8bb; margin:8px 0; }
  .ana { display:grid; grid-template-columns:1fr 1fr; gap:12px; align-items:center; background:#efe9fd; border-radius:14px; padding:10px; margin-top:8px; }
  .ana img { width:100%; border-radius:10px; border:1px solid #cfc8bb; }
  .ana p { margin:0; font-size:.85em; }
  @media (max-width:900px) { .ana { grid-template-columns:1fr; } }
</style>''')
s = s.replace('let lang = localStorage.lang || "en"', 'let lang = "en"')
import hashlib
ver = hashlib.sha1((ROOT / "app" / "web" / "style.css").read_bytes()).hexdigest()[:8]
s = s.replace('<link rel="stylesheet" href="style.css">', f'<link rel="stylesheet" href="style.css?v={ver}">')   # new styles reach every browser
(ROOT / "docs" / "demo" / "index.html").write_text(s, encoding="utf-8", newline="\n")
print("docs/demo/index.html built")
