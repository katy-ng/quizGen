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

function localFallback(chunks,limit) {
  console.warn("Using LOCAL fallback model (PDF-grounded)");

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

  let questions = [];
  for(let chunk of chunks){
    if(questions.length>=limit){break}
    questions.push(makeQuestion(chunk));
  }
  return questions;
}

/* ---------------- CHUNK SELECTION ---------------- */

/**
 * Selects chunks evenly across the document so questions
 * cover the entire PDF, not just the beginning.
 */
function selectChunksForCoverage(chunks, questionCount) {
  if (questionCount >= chunks.length) {
    return [...chunks];
  }

  const step = chunks.length / questionCount;
  const selected = [];

  for (let i = 0; i < questionCount; i++) {
    const index = Math.floor(i * step);
    selected.push(chunks[index]);
  }

  return selected;
}

/* ---------------- MAIN EXPORT ---------------- */
export async function generateQuestionBank(allChunks) {
  const max = globalThis.questions;
  let chunks = selectChunksForCoverage(allChunks,max); //chunks array only includes the chunks from allChunks that were assigned a question
  let questions = [];
  let remainingBudget = () => max - questions.length; //function so that it's recalc every time you call it (easier than having to remember to recalc a variable before using it)

  //MOCK MODE
  if (process.env.MOCK_AI === "true") {
    console.log("MOCK MODE ENABLED — Skipping all providers");
    return localFallback(chunks,max);
  }

  //Try using OpenAI first
  if (process.env.OPENAI_API_KEY && remainingBudget()>0) {
    try {
      const genQuestions = await openaiGen(chunks,remainingBudget());
      questions.push(...genQuestions);
      chunks = chunks.slice(genQuestions.length); //remove chunks that have already been used before continuing to gen more questions
    } catch (err) {
      console.warn("OpenAI failed or quota exhausted");
    }
  }

  //If OpenAI quota runs out, fall back to Hugging Face to finish the rest
  if (process.env.HUGGINGFACE_API_KEY && remainingBudget()>0) {
    try {
      const genQuestions = await hfGen(chunks,remainingBudget());
      questions.push(...genQuestions);
      chunks = chunks.slice(genQuestions.length); //remove chunks that have already been used before continuing to gen more questions
    } catch (err) {
      console.warn("Hugging Face failed or quota exhausted");
    }
  }

  //If Hugging Face quota runs out, use local fallback to finish the rest
  if (remainingBudget() > 0 && chunks.length>0) {
    console.warn("Using LOCAL fallback for remaining chunks");
    const localQuestions = localFallback(chunks,remainingBudget());
    questions.push(...localQuestions);
  }
  
  if (questions.length === 0) {
    throw new Error("All providers failed");
  }

  return questions.slice(0,max);
}