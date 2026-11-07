// Films the real app (server on localhost:8787, Solana devnet, Gemma on CPU) with Playwright.
// Writes video/work/raw/*.webm and video/work/scenes.json (when each part starts and when its result shows).
// Run in the Codespace:  cloud/pw.sh "node video/record_demo.mjs"
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const URL = process.env.NGW_URL ?? "http://localhost:8787";
const W = 1152, H = 648;   // filmed at 1152x648 and scaled to 1536x864, so the letters read well in the video
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
await page.mouse.wheel(0, 380); await pause(3000);
await page.mouse.wheel(0, 420); await pause(3500);   // "where each part comes from"
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
const before_b_family = await page.locator("#requests .req").count();
await page.locator(".req .b-report").first().click();   // say no AND report the wallet on the community list
await page.waitForFunction((n) => document.querySelectorAll("#requests .req").length < n, before_b_family, { timeout: 120000 });   // gone from Ana's list: decided on-chain
await pause(4500); end(s);

await page.goto(URL);
await page.waitForSelector(".bal b");
s = scene("community");
await check("fake-relative"); shown(s);
await page.evaluate(() => document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" }));
await pause(2500);
await page.mouse.wheel(0, 330); await pause(5500);
end(s);

s = scene("others");
for (const id of ["fake-support", "airdrop-drainer", "address-poisoning", "fake-token-fee"]) {
  await check(id);
  if (!s.atSet) { shown(s); s.atSet = true; }
  await page.evaluate(() => document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" }));
  await pause(3200);
}
end(s);

const SKIP = (process.env.NGW_SKIP ?? "").split(",");
if (!SKIP.includes("groceries")) {
s = scene("groceries");
await check("groceries"); shown(s);
await page.evaluate(() => document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" }));
await pause(1500);
await page.locator("button.b-sign").first().click();
await waitText("Sent! See it on Solana", 90000);
await pause(3500); end(s);
}

await page.evaluate(async () => {   // the rejected request was shown already; clear it before the next part
  const st = await (await fetch("/api/state")).json();
  for (const r of st.requests) await fetch("/api/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request: r.address }) });
});
await page.reload(); await page.waitForSelector(".bal b");
s = scene("car");
await check("car-repair"); shown(s);
await page.evaluate(() => document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" }));
await pause(2500);
await page.locator("button.b-family").first().click();
await waitText("Request created in the vault", 90000);
await page.goto(URL + "/family.html");
await page.waitForSelector(".req .b-sign", { timeout: 60000 });
await pause(2000);
const before_b_sign = await page.locator("#requests .req").count();
await page.locator(".req .b-sign").first().click();
await page.waitForFunction((n) => document.querySelectorAll("#requests .req").length < n, before_b_sign, { timeout: 120000 });
await pause(2000);
await page.goto(URL);
await page.waitForSelector(".bal b");
await page.evaluate(() => document.getElementById("requests").scrollIntoView({ block: "center", behavior: "smooth" }));
await waitCut(page.waitForSelector("#requests .b-sign", { timeout: 200000 }), 3.0);
await pause(1500);
await page.locator("#requests .b-sign").first().click();
await pause(6000);
end(s);

await ctx.close();
await browser.close();
writeFileSync("video/work/scenes.json", JSON.stringify(scenes, null, 2));
writeFileSync("video/work/cuts.json", JSON.stringify(cuts, null, 2));
console.log("recorded", scenes.length, "scenes,", now().toFixed(0), "s");
