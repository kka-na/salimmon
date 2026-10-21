// Renders pages in headless Chromium and prints their og:image tags after client-side JS ran.
// Used by `import_research.py --fetch-previews --render` for SPA shops whose server HTML
// only carries a site-wide og:image. Playwright comes from client/node_modules.
// Usage: node render_og.mjs URL [URL...]  → one JSON line per URL: {"url", "og": [...], "error"}
import { createRequire } from "node:module";

const require = createRequire(new URL("../../client/package.json", import.meta.url));
const { chromium } = require("playwright");

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ locale: "ko-KR" });
  for (const url of process.argv.slice(2)) {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const og = await page.$$eval('meta[property="og:image"]', (els) => els.map((e) => e.content));
      console.log(JSON.stringify({ url, og }));
    } catch (err) {
      console.log(JSON.stringify({ url, og: [], error: String(err).slice(0, 200) }));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
