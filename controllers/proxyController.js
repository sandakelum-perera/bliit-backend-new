const https = require("https");
const http = require("http");

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

function isPrivate(hostname) {
  if (BLOCKED_HOSTS.has(hostname)) return true;
  // Block RFC-1918 numeric addresses
  const parts = hostname.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

exports.proxyPage = (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "url param required" });

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "Only http/https URLs allowed" });
  }

  if (isPrivate(parsed.hostname)) {
    return res.status(403).json({ error: "Private/internal addresses not allowed" });
  }

  const lib = parsed.protocol === "https:" ? https : http;

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "Cache-Control": "no-cache",
    },
    timeout: 15000,
  };

  const proxyReq = lib.request(options, (proxyRes) => {
    // Follow one level of redirect
    if (
      [301, 302, 303, 307, 308].includes(proxyRes.statusCode) &&
      proxyRes.headers.location
    ) {
      let redirectUrl = proxyRes.headers.location;
      if (redirectUrl.startsWith("/")) {
        redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
      }
      return res.redirect(`/api/proxy?url=${encodeURIComponent(redirectUrl)}`);
    }

    // Build response headers — strip framing restrictions
    const headers = {};
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      const lk = k.toLowerCase();
      if (lk === "x-frame-options") continue;
      if (lk === "content-security-policy") {
        // Remove only the frame-ancestors directive
        const stripped = (Array.isArray(v) ? v.join("; ") : v)
          .replace(/frame-ancestors[^;]*(;|$)/gi, "")
          .trim()
          .replace(/;$/, "");
        if (stripped) headers[k] = stripped;
        continue;
      }
      // Rewrite location header on responses so relative redirects resolve correctly
      if (lk === "location") continue;
      headers[k] = v;
    }

    // Allow embedding
    headers["Access-Control-Allow-Origin"] = "*";

    res.writeHead(proxyRes.statusCode || 200, headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("[Proxy] Request error:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to fetch the target URL" });
    }
  });

  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: "Request timed out" });
    }
  });

  proxyReq.end();
};
