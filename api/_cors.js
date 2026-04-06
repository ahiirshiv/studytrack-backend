/**
 * _cors.js  — shared CORS helper
 * Call setCors(res) at the top of every handler,
 * then check handlePreflight(req, res) to short-circuit OPTIONS.
 */

const ALLOWED_ORIGINS = [
  // GitHub Pages frontend — update to your actual URL before deploying
  "https://YOUR_USERNAME.github.io",
  // Local dev
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];

/**
 * Sets CORS headers. In production it validates origin.
 * In dev (NODE_ENV !== 'production') it allows all origins.
 */
function setCors(req, res) {
  const origin = req.headers.origin || "";

  if (process.env.NODE_ENV !== "production") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    res.setHeader("Access-Control-Allow-Origin", allowed ? origin : ALLOWED_ORIGINS[0]);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

/**
 * Returns true and sends 204 if this is a preflight OPTIONS request.
 * Use: if (handlePreflight(req, res)) return;
 */
function handlePreflight(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { setCors, handlePreflight };
