// Films the real app (server on localhost:8787, Solana devnet, Gemma on CPU) with Playwright.
// Writes video/work/raw/*.webm and video/work/scenes.json (when each part starts and when its result shows).
// Run in the Codespace:  cloud/pw.sh "node video/record_demo.mjs"
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const URL = process.env.NGW_URL ?? "http://localhost:8787";
const W = 1536, H = 864;
mkdirSync("video/work/raw", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: "video/work/raw", size: { width: W, height: H } }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.lang = "en"; window.speechSynthesis && (window.speechSynthesis.speak = () => {}); });
const page = await ctx.newPage();
const T0 = Date.now();
const now = () => (Date.now() - T0) / 1000;
const scenes = [];
const scene = (key) => { const s = { key, start: now(), at: now() }; scenes.push(s); console.log("scene", key, s.start.toFixed(1)); return s; };
const shown = (s) => { s.at = now(); };
const end = (s) => { s.end = now(); };
const pause = (ms) => page.waitForTimeout(ms);
const cuts = [];   // long waits (Gemma on a CPU, the 60 s cooling-off, page loads) are cut out in the edit
async function waitCut(p, keep = 1.2) { const a = now(); await p; const b = now(); if (b - a > keep + 1.5) cuts.push([a + keep, b - 0.5]); }
const smooth = async (sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); await pause(400); };
const waitText = (txt, timeout = 120000) => page.waitForFunction((t) => document.body.innerText.includes(t), txt, { timeout });
const gemmaDone = () => page.waitForFunction(() => !document.querySelector("#result")?.innerText.includes("is reading the message"), null, { timeout: 180000 });

async function check(id) {
  await page.evaluate((i) => document.getElementById("s-" + i).scrollIntoView({ block: "center", behavior: "smooth" }), id);
  await pause(900);
  await page.locator(`#s-${id} button`).click();
  await page.waitForSelector("#result .verdict", { timeout: 60000 });
}

await page.goto(URL);
await page.waitForSelector(".bal b");
await pause(800);

let s = scene("wallet"); shown(s);
await pause(5500); end(s);

s = scene("relative");
await check("fake-relative"); shown(s);
await pause(2500);
await waitCut(gemmaDone());
await page.evaluate(() => document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" }));
await pause(4000);
await page.mouse.wheel(0, 380); await pause(3500);
end(s);

s = scene("askana");
await page.evaluate(() => window.scrollTo({ top: document.getElementById("resultCard").offsetTop - 20, behavior: "smooth" }));
await pause(900);
await page.locator("button.b-family").first().click();
await waitText("Request created in the vault", 90000); shown(s);
await page.evaluate(() => document.getElementById("requests").scrollIntoView({ block: "center", behavior: "smooth" }));
await pause(4000); end(s);

s = scene("ana");
await page.goto(URL + "/family.html");
await page.waitForSelector(".req .b-family", { timeout: 60000 }); shown(s);
await pause(4500);
await page.locator(".req .b-family").first().click();
await waitText("Decision recorded on Solana", 90000);
await pause(4500); end(s);

await page.goto(URL);
await page.waitForSelector(".bal b");
s = scene("others");
for (const id of ["fake-support", "airdrop-drainer", "address-poisoning", "fake-token-fee"]) {
  await check(id);
  if (!s.atSet) { shown(s); s.atSet = true; }
  await page.evaluate(() => document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" }));
  await pause(3200);
}
end(s);

s = scene("groceries");
await check("groceries"); shown(s);
await page.evaluate(() => document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" }));
await pause(1500);
await page.locator("button.b-sign").first().click();
await waitText("Sent! See it on Solana", 90000);
await pause(3500); end(s);

s = scene("car");
await check("car-repair"); shown(s);
await page.evaluate(() => document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" }));
await pause(2500);
await page.locator("button.b-family").first().click();
await waitText("Request created in the vault", 90000);
await page.goto(URL + "/family.html");
await page.waitForSelector(".req .b-sign", { timeout: 60000 });
await pause(2000);
await page.locator(".req .b-sign").first().click();
await waitText("Decision recorded on Solana", 90000);
await pause(2000);
await page.goto(URL);
await page.waitForSelector(".bal b");
await page.evaluate(() => document.getElementById("requests").scrollIntoView({ block: "center", behavior: "smooth" }));
await waitCut(page.waitForSelector("#requests .b-sign", { timeout: 200000 }), 3.0);
await pause(1500);
await page.locator("#requests .b-sign").first().click();
await pause(6000);
end(s);

// The on-chain proof: a forced transfer to the scammer, refused by the program (from the measured demo run)
const res = existsSync("app/out/results.json") ? JSON.parse(readFileSync("app/out/results.json", "utf8")) : null;
const proof = res?.proofs.find((p) => p.failed && p.name.includes("new number"));
if (proof) {
  s = scene("proof");
  await page.goto(proof.link, { waitUntil: "domcontentloaded" });
  await waitCut(page.waitForTimeout(9000), 0.5); shown(s);
  await page.mouse.wheel(0, 900); await page.waitForTimeout(5000);
  await page.screenshot({ path: "video/work/proof.png" });
  await page.mouse.wheel(0, 1400); await page.waitForTimeout(4000);
  await page.screenshot({ path: "video/work/proof_logs.png" });
  end(s);
}
await ctx.close();
await browser.close();
writeFileSync("video/work/scenes.json", JSON.stringify(scenes, null, 2));
writeFileSync("video/work/cuts.json", JSON.stringify(cuts, null, 2));
console.log("recorded", scenes.length, "scenes,", now().toFixed(0), "s");
