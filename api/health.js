/**
 * GET /api/health
 * Simple health-check. Frontend pings this to confirm backend is alive.
 */
const { setCors, handlePreflight } = require("./_cors");

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (handlePreflight(req, res)) return;

  const keyConfigured = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== "YOUR_GEMINI_KEY_HERE"
  );

  res.status(200).json({
    ok: true,
    service: "StudyTrack Backend",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    keyConfigured,
    timestamp: new Date().toISOString()
  });
};
