/**
 * Practice Questions AI controller.
 *
 * Powers the "Practice Questions" flow in the Bliit mobile app:
 *   1. generateMcqs   → up to 50 MCQs for a level/subject/topic/sub-topic,
 *                       at a chosen difficulty, each with 4 options + answer +
 *                       explanation (revealed after the student finishes).
 *   2. generateEssays → up to 5 essay questions with model answers, graded by
 *                       the shared /api/study-plan/evaluate vision endpoint.
 *
 * Provider keys stay server-side (GEMINI_API_KEY). Mirrors studyPlanController
 * so structured JSON comes back reliably via forced tool calls.
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "gemini-2.5-flash";

async function callGemini(body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const aiRes = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!aiRes.ok) {
    const text = await aiRes.text();
    const err = new Error(`Gemini error ${aiRes.status}: ${text.slice(0, 200)}`);
    err.status = aiRes.status;
    throw err;
  }
  return aiRes.json();
}

function extractToolArg(data) {
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments)
    throw new Error("AI did not return a structured response.");
  return JSON.parse(call.function.arguments);
}

function geminiError(res, err) {
  const status = err.status;
  if (status === 429)
    return res
      .status(429)
      .json({ error: "Rate limit exceeded. Please try again in a moment." });
  if (status === 402) return res.status(402).json({ error: "AI credits exhausted." });
  return res.status(500).json({ error: err.message || "AI gateway error" });
}

function contextLine({ className, subject, topic, subTopic }) {
  return [
    `Class: ${className || "unspecified"}`,
    `Subject: ${subject || "unspecified"}`,
    `Topic: ${topic || "unspecified"}`,
    `Sub Topic: ${subTopic || "unspecified"}`,
  ].join("\n");
}

function sinhalaRules(si, fields) {
  if (!si) return "";
  return (
    `\n\nCRITICAL LANGUAGE RULE: You MUST write EVERY text field (${fields}) entirely in Sinhala (සිංහල). ` +
    `Do NOT use English words in those fields. Only numbers, formulae and universal math/chemistry ` +
    `notation (^, sqrt(...), /, chemical symbols) stay in their standard form.`
  );
}

function sinhalaSuffix(si) {
  return si
    ? "\n\nCRITICAL: All descriptive text in your tool call MUST be written entirely in Sinhala (සිංහල), not English."
    : "";
}

/** Difficulty phrase woven into the prompt. */
function difficultyLine(difficulty) {
  const d = String(difficulty || "medium").toLowerCase();
  if (d === "easy") return "Keep the questions EASY — foundational recall and simple one-step application.";
  if (d === "hard") return "Make the questions HARD — multi-step reasoning and tricky distractors.";
  return "Use MEDIUM difficulty — a mix of direct application and light reasoning.";
}

/* ─────────────────────────── 1. Practice MCQs ─────────────────────────── */

const MCQ_SYSTEM = `You are an expert teacher for the Sri Lankan school / higher-education syllabus writing a multiple-choice practice quiz.

Rules:
- Produce EXACTLY N questions (N is given by the user).
- Each question has exactly 4 options, exactly one correct answer (answerIndex 0-3), and a brief "explanation" of why the answer is correct.
- Do NOT repeat questions. Cover the sub-topic broadly.
- Use plain-text math notation (^ for powers, sqrt(...), / for division). Do NOT use LaTeX backslashes.
- Stay strictly within the given class level and sub-topic. If the user gives a Focus, weave it in.

Always call the function "return_mcqs".`;

exports.generateMcqs = async (req, res) => {
  try {
    const { className, subject, topic, subTopic, count, difficulty, prompt, language } = req.body;
    const si = language === "si";
    // Clamp to a sane [1, 50] range.
    const n = Math.max(1, Math.min(50, Number(count) || 10));
    const focus = (prompt || "").trim();
    const userText =
      contextLine({ className, subject, topic, subTopic }) +
      `\n\n${difficultyLine(difficulty)}` +
      (focus ? `\nFocus: ${focus}` : "") +
      `\n\nWrite exactly ${n} MCQs following the rules above.` +
      sinhalaSuffix(si);

    const data = await callGemini({
      model: GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content: MCQ_SYSTEM + sinhalaRules(si, "each question, all four options, and every explanation"),
        },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_mcqs",
            description: `Return exactly ${n} MCQs.`,
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      answerIndex: { type: "integer" },
                      explanation: { type: "string" },
                    },
                    required: ["question", "options", "answerIndex", "explanation"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_mcqs" } },
    });

    const out = extractToolArg(data);
    // Never return more than requested.
    out.questions = Array.isArray(out.questions) ? out.questions.slice(0, n) : [];
    res.json(out);
  } catch (err) {
    console.error("practice/mcqs error:", err.message);
    geminiError(res, err);
  }
};

/* ─────────────────────────── 2. Practice essays ───────────────────────── */

const ESSAY_SYSTEM = `You are an examiner creating essay practice questions for the Sri Lankan syllabus.

Rules:
- Produce EXACTLY N essay questions (N is given by the user), spread across the sub-topic.
- Each question is worth 10 marks.
- "requirements" lists the points a good answer SHOULD include (3-6 bullets).
- "modelAnswer" is the correct answer broken into sections; each section has a "heading" and 1-5 "points". Use plain-text math notation (^ , sqrt(...), / ). No LaTeX backslashes.
- "writingTips" (top level) are 3-4 general tips for answering essay questions well.
- Stay within the given class level and sub-topic. If the user gives a Focus, weave it in.

Always call the function "return_essays".`;

exports.generateEssays = async (req, res) => {
  try {
    const { className, subject, topic, subTopic, count, difficulty, prompt, language } = req.body;
    const si = language === "si";
    // Clamp to a sane [1, 5] range.
    const n = Math.max(1, Math.min(5, Number(count) || 3));
    const focus = (prompt || "").trim();
    const userText =
      contextLine({ className, subject, topic, subTopic }) +
      `\n\n${difficultyLine(difficulty)}` +
      (focus ? `\nFocus: ${focus}` : "") +
      `\n\nCreate exactly ${n} essay questions following the rules above.` +
      sinhalaSuffix(si);

    const data = await callGemini({
      model: GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content:
            ESSAY_SYSTEM +
            sinhalaRules(
              si,
              "all writing tips, every question, all requirement bullets, and each model-answer heading and point",
            ),
        },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_essays",
            description: `Return exactly ${n} essay questions.`,
            parameters: {
              type: "object",
              properties: {
                writingTips: { type: "array", items: { type: "string" } },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      marks: { type: "integer" },
                      question: { type: "string" },
                      requirements: { type: "array", items: { type: "string" } },
                      modelAnswer: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            heading: { type: "string" },
                            points: { type: "array", items: { type: "string" } },
                          },
                          required: ["heading", "points"],
                        },
                      },
                    },
                    required: ["marks", "question", "requirements", "modelAnswer"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_essays" } },
    });

    const out = extractToolArg(data);
    out.questions = Array.isArray(out.questions) ? out.questions.slice(0, n) : [];
    res.json(out);
  } catch (err) {
    console.error("practice/essays error:", err.message);
    geminiError(res, err);
  }
};
