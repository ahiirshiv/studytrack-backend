/**
 * POST /api/summary
 *
 * Request body (JSON):
 * {
 *   pdfBase64: "<base64 string of the PDF, no data-url prefix>",
 *   fileName:  "MyNotes.pdf"
 * }
 *
 * Response (JSON):
 * {
 *   ok: true,
 *   summary: "Markdown-formatted summary string"
 * }
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { setCors, handlePreflight } = require("./_cors");

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (handlePreflight(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  // ── Validate API key ───────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_KEY_HERE") {
    console.error("[summary] GEMINI_API_KEY is not set in Vercel environment.");
    return res.status(500).json({
      ok: false,
      error: "Backend is missing Gemini API key. Set GEMINI_API_KEY in Vercel environment."
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
    return res.status(400).json({ ok: false, error: "Missing or invalid pdfBase64." });
  }

  console.log(`[summary] Summarising "${fileName}" (${Math.round(pdfBase64.length / 1024)} KB base64)`);

  // ── Call Gemini ────────────────────────────────────────────
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `You are an expert study assistant helping a student understand this document.

Write a structured study summary using exactly this format (use the **bold headings** as shown):

**📌 Subject Overview**
One or two sentences describing what this document covers and who it is for.

**📚 Key Topics Covered**
A bullet list of the major chapters, units, or themes in this document.

**💡 Core Concepts to Remember**
The most important ideas, definitions, formulas, theorems, or facts a student must know.

**⚠️ Tricky Areas**
Anything that students commonly find confusing or that requires extra attention.

**📝 Study Tips**
2–4 specific, actionable tips tailored to studying this particular material effectively.

Keep the tone clear, concise, and encouraging. Use bullet points (•) where appropriate. Maximum 500 words.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64
        }
      },
      { text: prompt }
    ]);

    const summary = result.response.text().trim();

    if (!summary || summary.length < 50) {
      return res.status(502).json({ ok: false, error: "AI returned an empty summary. Try again." });
    }

    console.log(`[summary] ✓ Summary generated for "${fileName}" (${summary.length} chars)`);
    return res.status(200).json({ ok: true, summary });

  } catch (err) {
    console.error("[summary] Gemini error:", err.message || err);
    const status = err.message?.includes("quota") ? 429 : 500;
    return res.status(status).json({
      ok: false,
      error: err.message || "Gemini API call failed."
    });
  }
};
