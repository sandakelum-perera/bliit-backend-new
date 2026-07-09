/**
 * Study Plan AI controller.
 *
 * Powers the "Study Plan" flow in the Bliit mobile app:
 *   1. generatePlan      → a multi-part, step-by-step study plan for a
 *                          class / subject / topic / sub-topic.
 *   2. generatePartMcqs  → 5 MCQs to test understanding of one part.
 *   3. generateFinalTest → a final essay test (with model answers) covering
 *                          every part of the plan.
 *   4. evaluateAnswer    → grades a student's uploaded answer image against
 *                          the model answer (vision).
 *
 * Provider keys stay server-side (GEMINI_API_KEY). Uses the Gemini
 * OpenAI-compatible chat-completions endpoint with forced tool calls, mirroring
 * aiController.js so structured JSON comes back reliably.
 */

const StudyPlan = require("../models/StudyPlan");
const StudyPlanResult = require("../models/StudyPlanResult");

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

/** Shared context line built from the selected class/subject/topic/subtopic. */
function contextLine({ className, subject, topic, subTopic }) {
  return [
    `Class: ${className || "unspecified"}`,
    `Subject: ${subject || "unspecified"}`,
    `Topic: ${topic || "unspecified"}`,
    `Sub Topic: ${subTopic || "unspecified"}`,
  ].join("\n");
}

/**
 * Sinhala language rule appended to the SYSTEM prompt when the student picked
 * Sinhala. [fields] names the text fields that must be written in Sinhala.
 * Numbers, formulae and standard math/chemistry notation stay unchanged.
 */
function sinhalaRules(si, fields) {
  if (!si) return "";
  return (
    `\n\nCRITICAL LANGUAGE RULE: You MUST write EVERY text field (${fields}) entirely in Sinhala (සිංහල). ` +
    `Do NOT use English words in those fields. Only numbers, formulae and universal math/chemistry ` +
    `notation (^, sqrt(...), /, chemical symbols) stay in their standard form.`
  );
}

/** Sinhala reminder appended to the USER text for extra reliability. */
function sinhalaSuffix(si) {
  return si
    ? "\n\nCRITICAL: All descriptive text in your tool call MUST be written entirely in Sinhala (සිංහල), not English."
    : "";
}

/* ─────────────────────────── 1. Study plan ─────────────────────────── */

const PLAN_SYSTEM = `You are an expert teacher for the Sri Lankan school syllabus. Build a clear, step-by-step STUDY PLAN that helps a student master a sub-topic from the ground up.

Rules:
- Break the sub-topic into 4 to 6 sequential PARTS, ordered from the most basic idea to the most advanced. Each part builds on the previous one.
- Every part must be self-contained and teach ONE clear idea.
- "formula" is a very short chip shown on a card (e.g. "ax^2 + bx + c = 0"). Keep it under ~18 chars; use "" if the part has no formula.
- "theory.text" is 2-4 sentences of core theory. Use plain-text math notation (^ for powers, sqrt(...), / for division). Do NOT use LaTeX backslashes.
- "theory.keyPoint" is one crucial must-remember fact.
- "explanation" is a friendly, deeper explanation of the same idea in simple language (3-5 sentences).
- "examples" has 2-3 worked examples; each has a "problem" and a step-by-step "solution" string (use \\n between steps).
- "achieve" is 3-4 short bullet outcomes ("You can ...").
- Stay strictly within the given class level and sub-topic.
- If the user gives "Focus", weave it into the plan.

Always call the function "return_plan".`;

exports.generatePlan = async (req, res) => {
  try {
    const { className, subject, topic, subTopic, prompt, language } = req.body;
    const si = language === "si";
    const focus = (prompt || "").trim();
    const userText =
      contextLine({ className, subject, topic, subTopic }) +
      (focus ? `\nFocus: ${focus}` : "") +
      `\n\nBuild the study plan following the rules above.` +
      sinhalaSuffix(si);

    const data = await callGemini({
      model: GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content:
            PLAN_SYSTEM +
            sinhalaRules(
              si,
              "overview, each part's title, subtitle, theory text, key point, explanation, every example's problem and solution, and all achieve outcomes",
            ),
        },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_plan",
            description: "Return the structured study plan.",
            parameters: {
              type: "object",
              properties: {
                overview: {
                  type: "string",
                  description: "One-sentence overview of what this plan covers.",
                },
                parts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "e.g. 'Introduction to Quadratic Equations'." },
                      subtitle: { type: "string", description: "One-line description of the part." },
                      formula: { type: "string", description: "Short formula chip or empty string." },
                      theory: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          keyPoint: { type: "string" },
                        },
                        required: ["text", "keyPoint"],
                      },
                      explanation: { type: "string" },
                      examples: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            problem: { type: "string" },
                            solution: { type: "string" },
                          },
                          required: ["problem", "solution"],
                        },
                      },
                      achieve: { type: "array", items: { type: "string" } },
                    },
                    required: ["title", "subtitle", "theory", "explanation", "examples", "achieve"],
                  },
                },
              },
              required: ["parts"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_plan" } },
    });

    const plan = extractToolArg(data);

    // Persist the generated plan automatically so the student can revisit it.
    // Best-effort: a DB hiccup must not fail the AI response the user paid a
    // credit for.
    try {
      const saved = await StudyPlan.create({
        user_id: req.user._id,
        className: className || "",
        subject: subject || "",
        topic: topic || "",
        subTopic: subTopic || "",
        focus,
        language: si ? "si" : "en",
        overview: plan.overview || "",
        parts: plan.parts || [],
      });
      plan.planId = saved._id;
    } catch (dbErr) {
      console.error("study-plan/generate save error:", dbErr.message);
    }

    res.json(plan);
  } catch (err) {
    console.error("study-plan/generate error:", err.message);
    geminiError(res, err);
  }
};

/* ─────────────────────────── 2. Part MCQs ──────────────────────────── */

const MCQ_SYSTEM = `You are a teacher creating a short multiple-choice quiz to test understanding of ONE part of a study plan. Produce exactly 5 questions. Each has 4 options, exactly one correct answer (answerIndex 0-3), and a brief explanation of why it is correct. Stay within the given class level and part. Always call the function "return_mcqs".`;

exports.generatePartMcqs = async (req, res) => {
  try {
    const { className, subject, topic, subTopic, partTitle, partTheory, language } = req.body;
    const si = language === "si";
    const userText =
      contextLine({ className, subject, topic, subTopic }) +
      `\nPart: ${partTitle || "unspecified"}` +
      (partTheory ? `\nWhat this part teaches: ${partTheory}` : "") +
      `\n\nWrite 5 MCQs to test this part.` +
      sinhalaSuffix(si);

    const data = await callGemini({
      model: GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content: MCQ_SYSTEM + sinhalaRules(si, "each question, all four options, and the explanation"),
        },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_mcqs",
            description: "Return the 5 MCQs.",
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

    res.json(extractToolArg(data));
  } catch (err) {
    console.error("study-plan/part-mcqs error:", err.message);
    geminiError(res, err);
  }
};

/* ────────────────────────── 3. Final test ──────────────────────────── */

const TEST_SYSTEM = `You are an examiner. Create a FINAL ESSAY TEST that assesses a student's complete understanding of a sub-topic, covering all key concepts.

Rules:
- Produce exactly 5 essay questions, spread across the whole sub-topic.
- Each question is worth 10 marks (total 50).
- "requirements" lists the points the student's answer SHOULD include (3-6 bullets).
- "modelAnswer" is the correct answer broken into sections; each section has a "heading" and 1-5 "points". Use plain-text math notation (^ , sqrt(...), / ). No LaTeX backslashes.
- "writingTips" (top level) are 3-4 general tips for answering essay questions well.
- Stay within the given class level and sub-topic.

Always call the function "return_test".`;

exports.generateFinalTest = async (req, res) => {
  try {
    const { className, subject, topic, subTopic, partTitles, language } = req.body;
    const si = language === "si";
    const parts = Array.isArray(partTitles) && partTitles.length
      ? `\nParts covered: ${partTitles.join("; ")}`
      : "";
    const userText =
      contextLine({ className, subject, topic, subTopic }) +
      parts +
      `\n\nCreate the final essay test following the rules above.` +
      sinhalaSuffix(si);

    const data = await callGemini({
      model: GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content:
            TEST_SYSTEM +
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
            name: "return_test",
            description: "Return the final essay test.",
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
      tool_choice: { type: "function", function: { name: "return_test" } },
    });

    res.json(extractToolArg(data));
  } catch (err) {
    console.error("study-plan/final-test error:", err.message);
    geminiError(res, err);
  }
};

/* ──────────────────────── 4. Evaluate answer ───────────────────────── */

const EVAL_SYSTEM = `You are a fair, encouraging examiner marking a student's hand-written essay answer (shared as an image) against a model answer and a list of required points.

Your job:
1. Read the student's uploaded answer from the image.
2. Compare it with the requirements and model answer.
3. Award a score out of the question's total marks.
4. Set "verdict": "correct" (score >= 80%), "partial" (40-79%), or "incorrect" (< 40%).
5. Give short, friendly overall "feedback" (1-2 sentences).
6. "missing" lists the key points the student did NOT cover or got wrong (0-5 short bullets).
7. "strengths" lists what the student did well (1-4 short bullets).
8. "weaknesses" lists the weak spots / mistakes in the answer (1-4 short bullets).
9. "improvements" lists concrete, actionable steps the student can take to improve (1-4 short bullets).

Always call the function "return_evaluation". Never reply in plain text.`;

exports.evaluateAnswer = async (req, res) => {
  try {
    const {
      imageBase64,
      question,
      requirements,
      modelAnswer,
      marks,
      language,
      className,
      subject,
      topic,
      subTopic,
      planId,
    } = req.body;
    const si = language === "si";
    const hasImage = typeof imageBase64 === "string" && imageBase64.length > 0;
    if (!hasImage) return res.status(400).json({ error: "imageBase64 is required" });

    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const total = Number(marks) || 10;
    const reqText = Array.isArray(requirements) ? requirements.map((r) => `- ${r}`).join("\n") : "";
    const modelText =
      typeof modelAnswer === "string"
        ? modelAnswer
        : JSON.stringify(modelAnswer || "");

    const userText =
      `Mark this student's answer out of ${total} marks.\n\n` +
      `QUESTION: ${question || ""}\n\n` +
      (reqText ? `REQUIRED POINTS:\n${reqText}\n\n` : "") +
      (modelText ? `MODEL ANSWER (reference):\n${modelText}\n\n` : "") +
      `Read the student's answer from the image and evaluate it.` +
      sinhalaSuffix(si);

    const data = await callGemini({
      model: GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content:
            EVAL_SYSTEM +
            sinhalaRules(
              si,
              "the feedback and every missing-point, strength, weakness and improvement bullet",
            ),
        },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_evaluation",
            description: "Return the evaluation of the student's answer.",
            parameters: {
              type: "object",
              properties: {
                verdict: { type: "string", enum: ["correct", "partial", "incorrect"] },
                score: { type: "number", description: `Marks awarded out of ${total}.` },
                feedback: { type: "string" },
                missing: { type: "array", items: { type: "string" } },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                improvements: { type: "array", items: { type: "string" } },
              },
              required: ["verdict", "score", "feedback"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_evaluation" } },
    });

    const out = extractToolArg(data);
    // Clamp the score into [0, total] so the client can trust it.
    out.score = Math.max(0, Math.min(total, Number(out.score) || 0));
    out.marks = total;
    // Normalise the qualitative arrays so they always exist for the client.
    const asList = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
    out.strengths = asList(out.strengths);
    out.weaknesses = asList(out.weaknesses);
    out.improvements = asList(out.improvements);

    // Persist the graded result automatically. Best-effort — never fail the
    // response the user paid a credit for.
    try {
      const saved = await StudyPlanResult.create({
        user_id: req.user._id,
        plan_id: planId || null,
        className: className || "",
        subject: subject || "",
        topic: topic || "",
        subTopic: subTopic || "",
        question: question || "",
        verdict: out.verdict,
        score: out.score,
        marks: total,
        feedback: out.feedback || "",
        strengths: out.strengths,
        weaknesses: out.weaknesses,
        improvements: out.improvements,
      });
      out.resultId = saved._id;
    } catch (dbErr) {
      console.error("study-plan/evaluate save error:", dbErr.message);
    }

    res.json(out);
  } catch (err) {
    console.error("study-plan/evaluate error:", err.message);
    geminiError(res, err);
  }
};

/* ────────────────────── 5. More explanation ────────────────────────── */

const MORE_EXPL_SYSTEM = `You are a patient teacher giving a student ONE additional, deeper explanation of a single part of a study plan. The student has already read a first explanation and wants another angle.

Rules:
- Write ONE fresh explanation (4-7 sentences) that approaches the idea from a DIFFERENT angle than the existing explanation — a new analogy, intuition, or line of reasoning.
- Do NOT repeat or merely rephrase the existing explanation.
- Use plain-text math notation (^ for powers, sqrt(...), / for division). Do NOT use LaTeX backslashes.
- Stay strictly within the given class level and part.

Always call the function "return_explanation".`;

exports.generateMoreExplanation = async (req, res) => {
  try {
    const { className, subject, topic, subTopic, partTitle, partTheory, existingExplanation, language } = req.body;
    const si = language === "si";
    const userText =
      contextLine({ className, subject, topic, subTopic }) +
      `\nPart: ${partTitle || "unspecified"}` +
      (partTheory ? `\nWhat this part teaches: ${partTheory}` : "") +
      (existingExplanation ? `\n\nExisting explanation (do NOT repeat this):\n${existingExplanation}` : "") +
      `\n\nGive one more, different explanation of this part.` +
      sinhalaSuffix(si);

    const data = await callGemini({
      model: GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content: MORE_EXPL_SYSTEM + sinhalaRules(si, "the explanation"),
        },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_explanation",
            description: "Return one additional explanation.",
            parameters: {
              type: "object",
              properties: {
                explanation: { type: "string" },
              },
              required: ["explanation"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_explanation" } },
    });

    res.json(extractToolArg(data));
  } catch (err) {
    console.error("study-plan/more-explanation error:", err.message);
    geminiError(res, err);
  }
};

/* ──────────────────────── 6. More examples ──────────────────────────── */

const MORE_EX_SYSTEM = `You are a teacher creating additional worked examples for ONE part of a study plan. The student wants more practice.

Rules:
- Produce exactly N NEW worked examples (N is given by the user), all DIFFERENT from the examples the student has already seen.
- Each example has a "problem" and a step-by-step "solution" string (use \\n between steps).
- Vary difficulty from easy to slightly harder. Use plain-text math notation (^, sqrt(...), / ). No LaTeX backslashes.
- Stay strictly within the given class level and part.

Always call the function "return_examples".`;

exports.generateMoreExamples = async (req, res) => {
  try {
    const { className, subject, topic, subTopic, partTitle, partTheory, existingProblems, count, language } = req.body;
    const si = language === "si";
    // How many new examples to generate — clamped to a sane [1, 5] range.
    const n = Math.max(1, Math.min(5, Number(count) || 2));
    const existing = Array.isArray(existingProblems) ? existingProblems.filter(Boolean) : [];
    const existingText = existing.length
      ? `\n\nExamples the student has already seen (do NOT repeat these):\n${existing.map((p) => `- ${p}`).join("\n")}`
      : "";
    const userText =
      contextLine({ className, subject, topic, subTopic }) +
      `\nPart: ${partTitle || "unspecified"}` +
      (partTheory ? `\nWhat this part teaches: ${partTheory}` : "") +
      existingText +
      `\n\nGenerate exactly ${n} new worked example(s).` +
      sinhalaSuffix(si);

    const data = await callGemini({
      model: GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content: MORE_EX_SYSTEM + sinhalaRules(si, "every example's problem and solution"),
        },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_examples",
            description: "Return the new worked examples.",
            parameters: {
              type: "object",
              properties: {
                examples: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      problem: { type: "string" },
                      solution: { type: "string" },
                    },
                    required: ["problem", "solution"],
                  },
                },
              },
              required: ["examples"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_examples" } },
    });

    const out = extractToolArg(data);
    // Never return more than requested, even if the model over-produces.
    out.examples = Array.isArray(out.examples) ? out.examples.slice(0, n) : [];
    res.json(out);
  } catch (err) {
    console.error("study-plan/more-examples error:", err.message);
    geminiError(res, err);
  }
};

/* ─────────────────── 7. Saved plans & results (history) ─────────────── */

// GET /api/study-plan/plans — the signed-in student's saved study plans.
exports.getMyPlans = async (req, res) => {
  try {
    const plans = await StudyPlan.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .limit(100)
      .lean();
    res.json(plans);
  } catch (err) {
    console.error("study-plan/plans error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/study-plan/results — the signed-in student's saved graded results.
exports.getMyResults = async (req, res) => {
  try {
    const results = await StudyPlanResult.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .limit(100)
      .lean();
    res.json(results);
  } catch (err) {
    console.error("study-plan/results error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
