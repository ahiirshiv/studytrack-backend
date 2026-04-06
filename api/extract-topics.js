/**
 * POST /api/extract-topics
 *
 * Request body (JSON):
 * {
 *   pdfBase64: "<base64 string of the PDF, no data-url prefix>",
 *   fileName:  "MyNotes.pdf"   // used for logging only
 * }
 *
 * Response (JSON):
 * {
 *   ok: true,
 *   topics: ["Topic A", "Topic B", ...]
 * }
 *
 * Error response:
 * { ok: false, error: "message" }
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { setCors, handlePreflight } = require("./_cors");

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (handlePreflight(req, res)) return;

  // ── Only POST allowed ──────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  // ── Validate API key ───────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_KEY_HERE") {
    console.error("[extract-topics] GEMINI_API_KEY is not set in Vercel environment.");
    return res.status(500).json({
      ok: false,
      error: "Backend is missing Gemini API key. Set GEMINI_API_KEY in your Vercel environment."
    });
  }

  // ── Parse body ─────────────────────────────────────────────
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON body." });
    }
  }

  const { pdfBase64, fileName = "file.pdf" } = body || {};

  if (!pdfBase64 || typeof pdfBase64 !== "string" || pdfBase64.length < 100) {
    return res.status(400).json({ ok: false, error: "Missing or invalid pdfBase64 in request body." });
  }

  console.log(`[extract-topics] Processing "${fileName}" (${Math.round(pdfBase64.length / 1024)} KB base64)`);

  // ── Call Gemini ────────────────────────────────────────────
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `You are a study assistant. Carefully analyse this PDF document.

Extract every major topic, chapter, concept, unit, and subtopic as a flat list.
Return ONLY a raw JSON array of strings — no markdown, no code fences, no explanation, nothing else.
Each string must be a clear concise topic name.

Rules:
- Aim for 10–50 items depending on document size
- Include chapter names, section headings, key concepts, formulas, theorems
- If it's a textbook, include all chapters and their key sections
- Keep each item under 80 characters
- No duplicates

Example (return exactly this format):
["Chapter 1: Introduction to Thermodynamics","Laws of Thermodynamics","Entropy and Enthalpy","Chapter 2: Kinematics","Newton's Laws of Motion"]`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64
        }
      },
      { text: prompt }
    ]);

    const raw  = result.response.text().trim();
    console.log(`[extract-topics] Raw response (first 200 chars): ${raw.slice(0, 200)}`);

    // ── Parse JSON from response ───────────────────────────────
    let topics;
    try {
      // Strip code fences if model added them
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      // Find the JSON array (model sometimes adds a sentence before it)
      const match   = cleaned.match(/\[[\s\S]*\]/);
      topics = JSON.parse(match ? match[0] : cleaned);
    } catch (parseErr) {
      console.error("[extract-topics] JSON parse failed:", raw.slice(0, 500));
      return res.status(502).json({
        ok: false,
        error: "AI returned unexpected format. Try again or use a different PDF."
      });
    }

    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(502).json({ ok: false, error: "AI returned an empty topic list." });
    }

    // Sanitise: keep only strings, trim whitespace
    const sanitised = topics
      .filter(t => typeof t === "string" && t.trim().length > 0)
      .map(t => t.trim());

    console.log(`[extract-topics] ✓ Extracted ${sanitised.length} topics from "${fileName}"`);
    return res.status(200).json({ ok: true, topics: sanitised });

  } catch (err) {
    console.error("[extract-topics] Gemini error:", err.message || err);
    const status = err.message?.includes("quota") ? 429 : 500;
    return res.status(status).json({
      ok: false,
      error: err.message || "Gemini API call failed."
    });
  }
};
