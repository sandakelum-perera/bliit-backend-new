const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const GEN_SYSTEM = `You are a math problem generator for the Sri Lankan school mathematics syllabus. Given a grade, topic and difficulty level, produce ONE clear, self-contained math question that fits that grade and topic.

Rules:
- Output ONLY the question itself — no greeting, no answer, no steps, no explanation.
- Keep it concise (one or two short lines).
- Use plain text math notation: ^ for powers, sqrt(...) for roots, / or fractions like (a)/(b), * for multiplication.
- Match the difficulty level: Easy = straightforward single-step, Normal = typical exam-style, Hard = challenging multi-step.
- Stay strictly within the given topic and grade level of the Sri Lankan syllabus.
- IMPORTANT: If the user specifies "Additional instructions", you MUST follow them exactly when crafting the question. They override default style choices.

GEOMETRY CONSTRUCTION QUESTION RULES (for construction/triangle/circle/angle topics):
- For SAS triangle construction questions, use this EXACT format for the question text:
    "Construct a triangle [V1][V2][V3] where [V1][V2] = Xcm, angle [V1][V2][V3] = Y degrees, and [V2][V3] = Zcm. Then, construct the perpendicular bisector of [V1][V3] and the angle bisector of angle [V2][V1][V3], and locate their point of intersection."
  Where [V1], [V2], [V3] are uppercase single letters and [V2] is the included-angle vertex.
- For SSS triangle constructions, use: "Construct triangle [V1][V2][V3] where [V1][V2] = Acm, [V2][V3] = Bcm and [V1][V3] = Ccm."
- Use realistic cm measurements that form a valid triangle.

DIAGRAM RULE: For geometry/construction topics (triangles, circles, constructions, angles, etc.) ONLY, you may also return a "diagram" with simple shapes drawn in a 200×200 coordinate space (x increases right, y increases down, origin at top-left):
  { "t": "seg",   "pts": [x1,y1,x2,y2] }
  { "t": "tri",   "pts": [x1,y1,x2,y2,x3,y3] }
  { "t": "circ",  "pts": [cx,cy,r] }
  { "t": "angle", "pts": [vx,vy,p1x,p1y,p2x,p2y] }
  { "t": "lbl",   "pts": [x,y], "text": "A" }
Keep diagrams simple (3–10 shapes). Omit "diagram" entirely for non-geometry topics.

Always call the function "return_question" with the result.`;

const SOLVE_SYSTEM = `You are an expert math tutor. The user shares an image of a hand-drawn math problem on a notebook canvas.

1. Read the problem carefully (arithmetic, algebra, calculus, geometry, etc.).
2. Solve it step by step. Each step's "math" must be a SHORT single line (max ~40 chars) using this notation:
   - Fractions: frac{numerator}{denominator}   e.g.  frac{1}{2}, frac{x+1}{2}
   - Exponents / powers: ^{...}                e.g.  x^{2}, 2^{10}
   - Subscripts: _{...}                        e.g.  x_{1}
   - Square roots: sqrt{...}                   e.g.  sqrt{2}, sqrt{x+1}
   - Use * for multiplication and / only when not stacking a fraction.
   Do NOT use LaTeX backslashes; use the bare keywords (frac, sqrt) above.
3. For each step, give a brief plain-language explanation (max ~60 chars).
4. End with a final "answer" string using the same notation.

Always call the function "return_solution" with the structured result. Never reply in plain text.`;

const CHECK_SYSTEM = `You are a math tutor. The image shows a math problem AND the student's hand-written attempt at solving it.

Your job:
1. Read the problem and the student's working / final answer.
2. Decide if the student's final answer is CORRECT, WRONG, or INCOMPLETE (no clear final answer).
3. Give short, friendly feedback (1-2 sentences). If wrong, briefly say where they went wrong and what the correct answer is.

Always call the function "return_check" with the structured result. Never reply in plain text.`;

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
  if (!call?.function?.arguments) throw new Error("AI did not return a structured response.");
  return JSON.parse(call.function.arguments);
}

function geminiError(res, err) {
  const status = err.status;
  if (status === 429) return res.status(429).json({ error: "Rate limit exceeded. Please try again in a moment." });
  if (status === 402) return res.status(402).json({ error: "AI credits exhausted." });
  return res.status(500).json({ error: err.message || "AI gateway error" });
}

exports.generateQuestion = async (req, res) => {
  try {
    const { topic, grade, level, syllabus, language, hint } = req.body;
    const si = language === "si";

    const langInstruction = si
      ? "\n\nCRITICAL LANGUAGE RULE: You MUST write the question entirely in Sinhala (සිංහල). Every word of the question must be in Sinhala. Only numbers and universal math symbols stay in their standard form."
      : "";

    const hintLine = hint?.trim() ? `\n\nAdditional instructions (MUST follow): ${hint.trim()}` : "";

    const userText = si
      ? `සිංහල ලියයි ගණිත ප්‍රශ්නයක් ජනනය කරන්න. Generate a math question IN SINHALA ONLY.\nSyllabus: ${syllabus ?? "Sri Lankan"}\nGrade: ${grade ?? "unspecified"}\nTopic: ${topic ?? "any"}\nLevel: ${level ?? "Normal"}${hintLine}\n\nThe question field MUST be written in Sinhala (සිංහල) language. Do NOT write the question in English.`
      : `Syllabus: ${syllabus ?? "Sri Lankan"}\nGrade: ${grade ?? "unspecified"}\nTopic: ${topic ?? "any"}\nLevel: ${level ?? "Normal"}${hintLine}\n\nGenerate a math question following the rules above.`;

    const data = await callGemini({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: GEN_SYSTEM + langInstruction },
        { role: "user", content: userText },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_question",
          description: "Return the generated math question.",
          parameters: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: si
                  ? "The math question written entirely in Sinhala (සිංහල)."
                  : "The math question only.",
              },
              diagram: {
                type: "object",
                description: "Optional geometric diagram for geometry/construction topics only.",
                properties: {
                  shapes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        t: { type: "string", enum: ["seg", "tri", "circ", "angle", "lbl"] },
                        pts: { type: "array", items: { type: "number" } },
                        text: { type: "string" },
                      },
                      required: ["t", "pts"],
                    },
                  },
                },
                required: ["shapes"],
              },
            },
            required: ["question"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_question" } },
    });

    res.json(extractToolArg(data));
  } catch (err) {
    console.error("generate-question error:", err.message);
    geminiError(res, err);
  }
};

exports.solveMath = async (req, res) => {
  try {
    const { imageBase64, prompt, language } = req.body;
    const hasImage = typeof imageBase64 === "string" && imageBase64.length > 0;
    const hasPrompt = typeof prompt === "string" && prompt.trim().length > 0;

    if (!hasImage && !hasPrompt) {
      return res.status(400).json({ error: "imageBase64 or prompt is required" });
    }

    const si = language === "si";
    const langInstruction = si
      ? "\n\nCRITICAL LANGUAGE RULE: You MUST write the 'problem' description and every step 'explanation' entirely in Sinhala (සිංහල). Do NOT use English words in problem or explanation fields."
      : "";
    const langSuffix = si
      ? "\n\nCRITICAL: Every text field (problem, each step explanation) in your tool call MUST be in Sinhala (සිංහල)."
      : "";

    const dataUrl = hasImage
      ? (imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`)
      : null;

    const userText = hasImage
      ? (hasPrompt
          ? `Solve the math problem in this drawing. Use the tool.\n\nUser note: ${prompt.trim()}${langSuffix}`
          : `Solve the math problem in this drawing. Use the tool.${langSuffix}`)
      : `Solve this math problem. Use the tool.\n\nProblem: ${prompt.trim()}${langSuffix}`;

    const userContent = [{ type: "text", text: userText }];
    if (dataUrl) userContent.push({ type: "image_url", image_url: { url: dataUrl } });

    const data = await callGemini({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: SOLVE_SYSTEM + langInstruction },
        { role: "user", content: userContent },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_solution",
          description: "Return the step-by-step solution.",
          parameters: {
            type: "object",
            properties: {
              problem: {
                type: "string",
                description: si
                  ? "Describe the math problem in Sinhala (සිංහල) ONLY."
                  : "The math problem as you read it from the image.",
              },
              steps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    math: { type: "string" },
                    explanation: {
                      type: "string",
                      description: si
                        ? "Explain this step in Sinhala (සිංහල) ONLY, max ~60 chars."
                        : "Brief explanation, max ~60 chars.",
                    },
                  },
                  required: ["math", "explanation"],
                  additionalProperties: false,
                },
              },
              answer: { type: "string" },
            },
            required: ["problem", "steps", "answer"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_solution" } },
    });

    res.json(extractToolArg(data));
  } catch (err) {
    console.error("solve-math error:", err.message);
    geminiError(res, err);
  }
};

exports.checkAnswer = async (req, res) => {
  try {
    const { imageBase64, prompt, language } = req.body;
    const hasImage = typeof imageBase64 === "string" && imageBase64.length > 0;

    if (!hasImage) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    const si = language === "si";
    const langInstruction = si
      ? "\n\nCRITICAL LANGUAGE RULE: You MUST write the 'feedback' field entirely in Sinhala (සිංහල). Mathematical expressions and the correct answer may use standard notation."
      : "";
    const langSuffix = si
      ? "\n\nCRITICAL: The 'feedback' field in your tool call MUST be written entirely in Sinhala (සිංහල)."
      : "";

    const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`;
    const hasPrompt = typeof prompt === "string" && prompt.trim().length > 0;
    const userText = hasPrompt
      ? `Check the student's solution in this drawing. The problem is: ${prompt.trim()}${langSuffix}`
      : `Check the student's solution in this drawing.${langSuffix}`;

    const data = await callGemini({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: CHECK_SYSTEM + langInstruction },
        { role: "user", content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ]},
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_check",
          description: "Return the verdict on the student's answer.",
          parameters: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["correct", "wrong", "incomplete"] },
              studentAnswer: { type: "string" },
              correctAnswer: { type: "string" },
              feedback: {
                type: "string",
                description: si
                  ? "Write short friendly feedback in Sinhala (සිංහල) ONLY (1-2 sentences)."
                  : "Short friendly feedback (1-2 sentences).",
              },
            },
            required: ["verdict", "correctAnswer", "feedback"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_check" } },
    });

    res.json(extractToolArg(data));
  } catch (err) {
    console.error("check-answer error:", err.message);
    geminiError(res, err);
  }
};
