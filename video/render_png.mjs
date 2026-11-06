// Renders an SVG or HTML file to PNG with Chromium.  node render_png.mjs in.svg out.png 1600 900
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [, , input, output, w = "1600", h = "900"] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await p.setContent(`<html><body style="margin:0">${readFileSync(input, "utf8")}</body></html>`);
await p.waitForTimeout(300);
await p.screenshot({ path: output, clip: { x: 0, y: 0, width: +w, height: +h } });
await b.close();
