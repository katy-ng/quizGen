/*Purpose:
  Replaces openAI.mjs
  Generates quiz questions using Hugging Face Inference API
  Includes:
    - strict JSON prompt
    - validation
    - retry logic
*/
import "dotenv/config";

//throw error if no valid API Key for Hugging Face
if (!process.env.HUGGINGFACE_API_KEY) {
  throw new Error("Hugging Face API key missing");
}

const HF_API_URL =
  "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta";


const HF_HEADERS = {
  "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
  "Content-Type": "application/json"
};

/* ---------------- PROMPT TEMPLATE ---------------- */

function buildPrompt(chunk) {
  return `
You are an educational assistant.

Generate ONE ${globalThis.difficulty}-difficulty multiple-choice question
based ONLY on the text below.

RULES (VERY IMPORTANT):
- Output VALID JSON ONLY
- Do NOT include markdown
- Do NOT include explanations outside JSON
- Do NOT include extra text
- Choices MUST be exactly 4
- correct_answer MUST exactly match one of the choices

JSON FORMAT:
{
  "question": "string",
  "choices": ["A", "B", "C", "D"],
  "correct_answer": "one of the choices exactly",
  "explanation": "string"
}

TEXT:
${chunk}
`.trim();
}

/* ---------------- VALIDATION ---------------- */

function isValidQuestion(obj) {
  return (
    obj &&
    typeof obj.question === "string" &&
    Array.isArray(obj.choices) &&
    obj.choices.length === 4 &&
    obj.choices.every(c => typeof c === "string") &&
    typeof obj.correct_answer === "string" &&
    obj.choices.includes(obj.correct_answer) &&
    typeof obj.explanation === "string"
  );
}

/* ---------------- JSON EXTRACTION ---------------- */

function extractJSON(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/* ---------------- HF CALL ---------------- */

async function callHuggingFace(prompt) {
  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: HF_HEADERS,
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        temperature: 0.2,
        max_new_tokens: 600,
        return_full_text: false
      },
      options:{
        wait_for_model:true
      }
    })
  });

  if (res.status === 429) {
    throw new Error("HF_QUOTA_EXHAUSTED");
  }
  if (!res.ok) {
    throw new Error(`HF API error: ${res.status}`);
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return data[0]?.generated_text || "";
  }
  if (typeof data?.generated_text === "string") {
    return data.generated_text;
  }
  console.error("Unexpected HF response:", data);
  return "";
}

/* ---------------- MAIN EXPORT ---------------- */

export async function generateQuestionBank(pdfChunkArray, limit) {
  const questions = [];

  // ---- MOCK MODE (KEEP THIS, IT'S GOOD) ----
  if (process.env.MOCK_AI === "true") {
    console.log("⚠️ MOCK MODE ENABLED — No Hugging Face calls");
    for (let i = 0; i < Math.min(pdfChunkArray.length, limit); i++) {
      questions.push({
        question: `Mock question #${i + 1}`,
        choices: ["A", "B", "C", "D"],
        correct_answer: "A",
        explanation: "Mock explanation"
      });
    }
    return questions;
  }

  // ---- REAL MODE ----
  for (const chunk of pdfChunkArray) {
    if(questions.length>=limit){break}
    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      attempts++;

      try {
        const prompt = buildPrompt(chunk);
        const raw = await callHuggingFace(prompt);
        const parsed = extractJSON(raw);

        if (isValidQuestion(parsed)) {
          questions.push(parsed);
          console.log("Question generated using HF!");
          success = true;
        } else {
          console.warn(`Invalid JSON (attempt ${attempts})`);
        }
        console.log("RAW HF OUTPUT:\n", raw);
      } catch (err) {
        if (err.message === "HF_QUOTA_EXHAUSTED") {
          console.warn("Hugging Face quota exhausted");
          throw err;
        }
        console.error(`HF error (attempt ${attempts}):`, err.message);
      }
    }

    if (!success) {
      console.error("Failed after 3 attempts — skipping chunk");
    }
  }

  console.log("Finished generating question bank.");
  return questions;
}

export async function attemptHuggingFace(prompt) {
  return await callHuggingFace(prompt);
}
