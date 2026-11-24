const crypto = require("node:crypto");

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const RECEIPT_ID_PATTERN = /^[a-f0-9]{32}$/;

function respondJson(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

function getSiteUrl() {
  const configured = process.env.SITE_URL;
  if (!configured) throw new Error("SITE_URL is not configured.");
  const url = new URL(configured);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("SITE_URL must use HTTPS.");
  }
  return url.origin;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function receiptImageUrl(cloudName, id) {
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/zesty-receipts/${id}.png`;
}

function renderReceiptPage(res, siteUrl, cloudName, id) {
  const imageUrl = receiptImageUrl(cloudName, id);
  const receiptUrl = `${siteUrl}/api/receipt?id=${id}`;
  const safeImageUrl = escapeHtml(imageUrl);
  const safeReceiptUrl = escapeHtml(receiptUrl);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src https://res.cloudinary.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=86400");
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Zesty order receipt">
  <meta property="og:description" content="View the order bill and details.">
  <meta property="og:url" content="${safeReceiptUrl}">
  <meta property="og:image" content="${safeImageUrl}">
  <meta property="og:image:secure_url" content="${safeImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:alt" content="Zesty order bill">
  <meta property="og:site_name" content="Zesty">
  <meta name="twitter:card" content="summary_large_image">
  <title>Zesty order receipt</title>
  <style>body{margin:0;padding:24px;background:#fff8f4;color:#191923;font:16px Arial,sans-serif;text-align:center}main{max-width:640px;margin:auto}img{display:block;width:100%;height:auto;border-radius:16px}h1{font-size:22px}</style>
</head>
<body><main><h1>Zesty order receipt</h1><img src="${safeImageUrl}" alt="Order bill"></main></body>
</html>`);
}

async function readJsonBody(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8"));
    if (typeof req.body === "string") return JSON.parse(req.body);
    return req.body;
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 3 * 1024 * 1024) throw new RangeError("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isSameOrigin(req, siteUrl) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const requestUrl = new URL(siteUrl);
    const requestHost = req.headers["x-forwarded-host"] || req.headers.host;
    const originUrl = new URL(origin);
    if (originUrl.origin === `${requestUrl.protocol}//${requestHost}`) return true;

    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    return process.env.NODE_ENV !== "production" &&
      localHosts.has(new URL(`http://${requestHost}`).hostname) &&
      originUrl.origin === `http://${requestHost}`;
  } catch {
    return false;
  }
}

async function uploadReceipt(req, res, siteUrl, cloudName) {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return respondJson(res, 500, { error: "Cloudinary server credentials are not configured." });
  }
  if (!isSameOrigin(req, siteUrl)) {
    return respondJson(res, 403, { error: "Receipt uploads must come from this website." });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    return respondJson(res, status, { error: status === 413 ? "Bill image is too large." : "Invalid upload request." });
  }

  const match = body && typeof body === "object" &&
    typeof body.image === "string" &&
    body.image.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return respondJson(res, 400, { error: "A PNG bill image is required." });

  const imageBuffer = Buffer.from(match[1], "base64");
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    return respondJson(res, 413, { error: "Bill image exceeds the 2 MB limit." });
  }
  if (imageBuffer.length < pngSignature.length || !imageBuffer.subarray(0, 8).equals(pngSignature)) {
    return respondJson(res, 400, { error: "The uploaded bill is not a valid PNG image." });
  }

  const id = crypto.randomBytes(16).toString("hex");
  const publicId = `zesty-receipts/${id}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  const form = new FormData();
  form.append("file", new Blob([imageBuffer], { type: "image/png" }), "zesty-order-bill.png");
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("signature", signature);

  let cloudinaryResponse;
  try {
    cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: "POST",
      body: form
    });
  } catch (error) {
    console.error("Cloudinary upload request failed.", error);
    return respondJson(res, 502, { error: "Could not connect to receipt image storage." });
  }

  if (!cloudinaryResponse.ok) {
    const detail = await cloudinaryResponse.text();
    let providerMessage = "";
    try {
      const payload = JSON.parse(detail);
      providerMessage = payload.error && payload.error.message;
    } catch {
      providerMessage = "";
    }
    providerMessage = typeof providerMessage === "string"
      ? providerMessage.slice(0, 400)
      : `Cloudinary returned HTTP ${cloudinaryResponse.status}.`;
    console.error("Cloudinary rejected a receipt upload.", cloudinaryResponse.status, providerMessage);
    return respondJson(res, 502, {
      error: "Receipt image storage rejected the upload.",
      details: providerMessage
    });
  }

  return respondJson(res, 201, { receiptUrl: `${siteUrl}/api/receipt?id=${id}` });
}

module.exports = async function handler(req, res) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return respondJson(res, 500, { error: "Cloudinary cloud name is not configured." });

  let siteUrl;
  try {
    siteUrl = getSiteUrl();
  } catch (error) {
    console.error("Receipt endpoint configuration error.", error);
    return respondJson(res, 500, { error: "Receipt link domain is not configured." });
  }

  if (req.method === "GET") {
    const requestUrl = new URL(req.url, siteUrl);
    const id = requestUrl.searchParams.get("id") || "";
    if (!RECEIPT_ID_PATTERN.test(id)) return respondJson(res, 404, { error: "Receipt not found." });
    return renderReceiptPage(res, siteUrl, cloudName, id);
  }

  if (req.method === "POST") return uploadReceipt(req, res, siteUrl, cloudName);

  res.setHeader("Allow", "GET, POST");
  return respondJson(res, 405, { error: "Method not allowed." });
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "3mb"
    }
  }
};
