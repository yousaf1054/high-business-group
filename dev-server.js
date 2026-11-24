const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const receiptHandler = require("./api/receipt");

const root = __dirname;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function loadLocalEnvironment() {
  const envFile = path.join(root, ".env.local");
  if (!fs.existsSync(envFile)) return;

  fs.readFileSync(envFile, "utf8").split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#") || process.env[match[1]]) return;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  });
}

function sendText(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
}

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendText(res, 405, "Static files only support GET and HEAD.");
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return sendText(res, 400, "Invalid URL path.");
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "");
  const filePath = path.resolve(root, relativePath);
  const relativeFromRoot = path.relative(root, filePath);
  if (
    relativeFromRoot.startsWith("..") ||
    path.isAbsolute(relativeFromRoot) ||
    relativeFromRoot.split(path.sep).some(part => part.startsWith(".") || part.toLowerCase() === "api")
  ) {
    return sendText(res, 404, "Not found.");
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) return sendText(res, 404, "Not found.");
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

loadLocalEnvironment();
process.env.NODE_ENV = process.env.NODE_ENV || "development";

const port = Number(process.env.PORT || 3000);
const server = http.createServer((req, res) => {
  let requestUrl;
  try {
    requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  } catch {
    return sendText(res, 400, "Invalid request URL.");
  }

  if (requestUrl.pathname === "/api/receipt") {
    return receiptHandler(req, res);
  }
  if (requestUrl.pathname.startsWith("/api/")) {
    return sendText(res, 404, "API route not found.");
  }
  return serveStatic(req, res, requestUrl.pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Zesty dev server running at http://127.0.0.1:${port}`);
  console.log("Set Cloudinary credentials and your deployed HTTPS SITE_URL in .env.local to test receipts.");
});
