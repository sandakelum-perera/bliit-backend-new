/**
 * Remote headless browser controller — powered by Playwright.
 *
 * Server setup (run once on the server):
 *   npx playwright install chromium --with-deps
 *
 * Sessions are keyed by sessionId and expire after 5 min of inactivity.
 */

const fs = require("fs");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.warn("[Browser] playwright not installed — remote browser mode disabled.");
}

const VIEWPORT = { width: 1280, height: 720 };
const SESSION_TTL = 5 * 60 * 1000;

let _browser = null;
let _launchError = null;

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--no-first-run",
  "--hide-scrollbars",
  "--mute-audio",
];

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_launchError) throw _launchError;

  try {
    // Prefer system Chrome/Chromium via CHROME_PATH env; otherwise let Playwright
    // use its own downloaded Chromium.
    const launchOpts = {
      headless: true,
      args: LAUNCH_ARGS,
    };

    if (process.env.CHROME_PATH) {
      launchOpts.executablePath = process.env.CHROME_PATH;
    } else {
      // Try system Chromium candidates before falling back to Playwright's bundle
      const candidates = [
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/snap/bin/chromium",
      ];
      const found = candidates.find((p) => fs.existsSync(p));
      if (found) {
        console.log("[Browser] Using system Chrome:", found);
        launchOpts.executablePath = found;
      }
    }

    _browser = await chromium.launch(launchOpts);
    _browser.on("disconnected", () => {
      _browser = null;
      _launchError = null;
    });
    console.log("[Browser] Playwright Chromium launched.");
    return _browser;
  } catch (err) {
    _launchError = err;
    console.error("[Browser] Launch failed:", err.message);
    console.error(
      "[Browser] Fix: run  npx playwright install chromium --with-deps  on the server, then restart."
    );
    throw err;
  }
}

// sessionId → { context, page, lastActive }
const sessions = new Map();

async function getPage(sessionId) {
  if (sessions.has(sessionId)) {
    const s = sessions.get(sessionId);
    if (!s.page.isClosed()) {
      s.lastActive = Date.now();
      return s.page;
    }
    await s.context.close().catch(() => {});
    sessions.delete(sessionId);
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    // Suppress automation detection
    javaScriptEnabled: true,
    bypassCSP: true,
  });

  // Hide webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();
  const sessionObj = { context, page, lastActive: Date.now() };
  sessions.set(sessionId, sessionObj);

  // Redirect new-tab popups back into the main page instead of losing them
  context.on("page", async (popup) => {
    try {
      // Wait up to 2 s for the popup to get its target URL
      await popup.waitForLoadState("commit", { timeout: 2000 }).catch(() => {});
      const url = popup.url();
      await popup.close().catch(() => {});
      if (url && url !== "about:blank" && url !== "about:newtab") {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      }
    } catch { /* ignore */ }
  });

  return page;
}

// Cleanup idle sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActive > SESSION_TTL) {
      s.context.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 60_000);

async function snap(page) {
  const buf = await page.screenshot({ type: "jpeg", quality: 70 });
  return buf.toString("base64");
}

// Wait only as long as needed: short pause for UI-only clicks, full
// domcontentloaded wait only when navigation actually starts.
async function waitAfterAction(page, maxNavMs = 8000) {
  let navigated = false;
  await Promise.race([
    page.waitForNavigation({ waitUntil: "commit", timeout: 400 })
      .then(() => { navigated = true; })
      .catch(() => {}),
    new Promise(r => setTimeout(r, 150)),
  ]);
  if (navigated) {
    await page.waitForLoadState("domcontentloaded", { timeout: maxNavMs }).catch(() => {});
    await new Promise(r => setTimeout(r, 400)); // let JS render
  }
  // else: non-navigation click — 150ms already elapsed, snap immediately
}

function notAvailable(res) {
  return res.status(503).json({
    error:
      "Remote browser not available. Run on the server:\n" +
      "  npx playwright install chromium --with-deps\n" +
      "then restart the backend.",
  });
}

function handleErr(res, err) {
  if (
    _launchError ||
    (err.message &&
      (err.message.includes("Failed to launch") ||
        err.message.includes("error while loading")))
  ) {
    return res.status(503).json({
      error:
        "Chrome failed to start. Run on the server:\n" +
        "  npx playwright install chromium --with-deps\n" +
        "then restart the backend.\n\n" +
        "Raw: " + err.message,
    });
  }
  res.status(500).json({ error: err.message });
}

// ── POST /api/browser/navigate ─────────────────────────────────────────────
exports.navigate = async (req, res) => {
  if (!chromium) return notAvailable(res);
  const { sessionId, url } = req.body;
  if (!sessionId || !url) return res.status(400).json({ error: "sessionId and url required" });
  try {
    const page = await getPage(sessionId);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(r => setTimeout(r, 400));
    const screenshot = await snap(page);
    res.json({ screenshot, url: page.url(), viewport: VIEWPORT });
  } catch (err) {
    handleErr(res, err);
  }
};

// ── POST /api/browser/click ────────────────────────────────────────────────
exports.click = async (req, res) => {
  if (!chromium) return notAvailable(res);
  const { sessionId, x, y } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  try {
    const page = await getPage(sessionId);
    await page.mouse.click(Number(x), Number(y));
    await waitAfterAction(page);
    const screenshot = await snap(page);
    const inputFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return !!(el && (
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" ||
        el.getAttribute("contenteditable") === "true" ||
        el.getAttribute("role") === "textbox" ||
        el.getAttribute("role") === "searchbox"
      ));
    }).catch(() => false);
    res.json({ screenshot, url: page.url(), viewport: VIEWPORT, inputFocused });
  } catch (err) {
    handleErr(res, err);
  }
};

// ── POST /api/browser/scroll ───────────────────────────────────────────────
exports.scroll = async (req, res) => {
  if (!chromium) return notAvailable(res);
  const { sessionId, deltaY } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  try {
    const page = await getPage(sessionId);
    await page.mouse.wheel(0, Number(deltaY) * 3);
    await new Promise(r => setTimeout(r, 120));
    const screenshot = await snap(page);
    res.json({ screenshot, viewport: VIEWPORT });
  } catch (err) {
    handleErr(res, err);
  }
};

// ── POST /api/browser/type ─────────────────────────────────────────────────
exports.type = async (req, res) => {
  if (!chromium) return notAvailable(res);
  const { sessionId, text } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  try {
    const page = await getPage(sessionId);
    await page.keyboard.type(String(text));
    await new Promise(r => setTimeout(r, 80));
    const screenshot = await snap(page);
    res.json({ screenshot, url: page.url(), viewport: VIEWPORT });
  } catch (err) {
    handleErr(res, err);
  }
};

// ── POST /api/browser/key ──────────────────────────────────────────────────
exports.key = async (req, res) => {
  if (!chromium) return notAvailable(res);
  const { sessionId, key } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  try {
    const page = await getPage(sessionId);
    await page.keyboard.press(key);
    await waitAfterAction(page);
    const screenshot = await snap(page);
    res.json({ screenshot, url: page.url(), viewport: VIEWPORT });
  } catch (err) {
    handleErr(res, err);
  }
};

// ── POST /api/browser/image-at ─────────────────────────────────────────────
exports.imageAt = async (req, res) => {
  if (!chromium) return notAvailable(res);
  const { sessionId, x, y } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  try {
    const page = await getPage(sessionId);
    const imgUrl = await page.evaluate(
      ([px, py]) => {
        let el = document.elementFromPoint(px, py);
        while (el) {
          if (el.tagName === "IMG" && el.src) return el.src;
          const bg = window.getComputedStyle(el).backgroundImage;
          const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
          if (m && m[1] && !m[1].startsWith("data:")) return m[1];
          el = el.parentElement;
        }
        return null;
      },
      [Number(x), Number(y)]
    );
    res.json({ url: imgUrl });
  } catch (err) {
    handleErr(res, err);
  }
};
