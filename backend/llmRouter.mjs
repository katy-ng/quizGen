/*Manages fallback between APIs:
  Use OpenAI API until free quota is out, 
  then fall back to Hugging Face API (less quality in responses in exchange for more free quota),
  then fall back to local AI (worst quality but no quota, always available)
*/

import "dotenv/config";
import { generateQuestionBank as openaiGen } from "./openAI.mjs";
import { generateQuestionBank as hfGen } from "./huggingFace.mjs";

/* ---------------- LOCAL FALLBACK ---------------- */
/*To get the question, the local fallback splices a sentence with a key (repeating) word/phrase and asks about the main idea/definition
  To get the correct answer, it finds a sentence containing the key term
  To get other answer choices, it finds sentences from the same chunk without the key word*/ 

function localFallback(chunks) {
  console.warn("⚠️ Using LOCAL fallback model (PDF-grounded)");

  const STOPWORDS = new Set([
    "the","and","of","to","in","a","is","that","it","for","on","as",
    "with","are","was","were","by","this","which","or","an","be"
  ]);

  function splitSentences(text) {
    return (text.match(/[^.!?]+[.!?]/g) || [])
      .map(s => s.trim())
      .filter(s => s.length > 40);
  }

  function extractKeywords(text) {
    const freq = {};
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .forEach(word => {
        if (word.length > 4 && !STOPWORDS.has(word)) {
          freq[word] = (freq[word] || 0) + 1;
        }
      });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }

  function makeQuestion(chunk) {
    const sentences = splitSentences(chunk);
    const keywords = extractKeywords(chunk);

    if (sentences.length < 4 || keywords.length === 0) {
      return {
        question: "What is the main idea of this section?",
        choices: sentences.slice(0, 4),
        correct_answer: sentences[0],
        explanation: "The correct answer is the sentence that best summarizes the section."
      };
    }

    const keyword = keywords[0];

    // correct answer = sentence containing keyword
    const correct =
      sentences.find(s =>
        s.toLowerCase().includes(keyword)
      ) || sentences[0];

    // distractors = other real sentences from same chunk
    const distractors = sentences
      .filter(s => s !== correct)
      .slice(0, 3);

    // ensure exactly 4 choices
    const choices = [correct, ...distractors];

    return {
      question: `Which statement best explains "${keyword}" as described in these notes?`,
      choices,
      correct_answer: correct,
      explanation: `The correct answer was selected because it directly mentions "${keyword}" in the PDF text.`
    };
  }

  return chunks.map(makeQuestion);
}


/* ---------------- PROVIDER WRAPPER ---------------- */

async function tryProvider(name, fn, chunks) {
  try {
    console.log(`🧠 Attempting ${name} provider...`);
    const result = await fn(chunks);

    if (!Array.isArray(result) || result.length === 0) {
      throw new Error(`${name} returned no valid questions`);
    }

    console.log(`✅ ${name} succeeded`);
    return result;
  } catch (err) {
    console.error(`❌ ${name} failed:`, err.message);
    return null;
  }
}

/* ---------------- MAIN EXPORT ---------------- */

export async function generateQuestionBank(chunks) {
  // MOCK MODE SHORT-CIRCUIT
  if (process.env.MOCK_AI === "true") {
    console.log("⚠️ MOCK MODE ENABLED — Skipping all providers");
    return localFallback(chunks);
  }

  //OpenAI
  if (process.env.OPENAI_API_KEY) {
    const openaiResult = await tryProvider("OpenAI", openaiGen, chunks);
    if (openaiResult) return openaiResult;
  }

  //if OpenAI quota is out, fall back to Hugging Face
  if (process.env.HUGGINGFACE_API_KEY) {
    const hfResult = await tryProvider("Hugging Face", hfGen, chunks);
    if (hfResult) return hfResult;
  }

  //if Hugging Face quota is out, fall back to Local
  console.log("Fell back to Local");
  return localFallback(chunks);
}
