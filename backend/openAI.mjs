/*NOT linked to an HTML, so everything is private (can't be seen in browser DevTools)
Purpose:
  Takes in chunked pdf text from server.js and uses them to prompt openAI to generate 
  a quiz based on the pdfs. 
*/

import "dotenv/config";
import fs from "fs";
import OpenAI from "openai";

//throw error if no valid API Key for OpenAI
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OpenAI API key missing");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

//generate one multiple choice question
async function generateOneQuestion(chunk) {
  let response;
  try {
    response = await client.responses.create({
      model: "gpt-4.1",
      input: `
        You are an educational assistant.
        Generate one ${globalThis.difficulty}-difficulty multiple-choice question
        based ONLY on these notes:

        ${chunk}
      `,
      text: {
        format: {
          name: "quiz_question",
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              question: { type: "string" },
              choices: {
                type: "array",
                items: { type: "string" },
                minItems: 4,
                maxItems: 4
              },
              correct_answer: { type: "string" },
              explanation: { type: "string" }
            },
            required: ["question","choices","correct_answer","explanation"],
            additionalProperties: false
          }
        }
      }
    });
  } catch (err) {
    if (
      err.status === 429 ||
      err.message?.toLowerCase().includes("quota") ||
      err.message?.toLowerCase().includes("rate")
    ) {
      console.error("❌ OpenAI quota exhausted");
      throw new Error("OPENAI_QUOTA_EXHAUSTED");
    }
    throw err;
  }
  return response.output_parsed || null;
}


//generates a JavaScript object of questions and their answer choices; creates one set per chunk sent
//stores each set of question/answers in JSON format as a JavaScript object, in an array
//export functions are accessible by other files, just import the function from the file you're using it in
export async function generateQuestionBank(pdfChunkArray,limit) {
  //give openAI instructions (how to speak + structure responses)
  const questions = [];

  // --- MOCK MODE --- 
  if (process.env.MOCK_AI === "true") { 
    console.log("⚠️ MOCK MODE ENABLED — No OpenAI calls will be made."); 
    for (let i = 0; i < Math.min(pdfChunkArray.length, limit); i++) { 
      questions.push({ 
        question: `Mock question #${i + 1}: What is the main idea of this section?`, 
        choices: [ "Mock choice A", "Mock choice B", "Mock choice C", "Mock choice D" ], 
        correct_answer: "Mock choice A", 
        explanation: "This is a mock explanation used for development." 
      }); 
    }
    if(questions.length > 0){
      console.log(`Success! Created ${questions.length} questions`);
    }
    console.log("Finished generating question bank. (MOCK)");
    return questions;
  }

  // --- OPENAI MODE  ---
  //continue generating one question at a time until generated enough questions, use up all the chunks, or hit the end of the free quota
  for (const chunk of pdfChunkArray) {
    if(questions.length>=limit){break}
    try {
      const questionObject = await generateOneQuestion(chunk);
      if (questionObject) {
        questions.push(questionObject);
        console.log("OpenAI success");
      }
    } catch (err) {
      if (err.message === "OPENAI_QUOTA_EXHAUSTED") {
        console.warn("Stopping OpenAI early due to quota");
        break;
      }
      throw err;
    }
  }
  
  console.log("Finished generating question bank.")
  return questions;
}

export async function attemptOpenAI(chunk) {
  return await generateOneQuestion(chunk);
}

/*--------------CALL THE FUNCTIONS-------------//
generateQuestionBank()
  .then(() => console.log("✅ API call succeeded"))
  .catch(err => console.error("❌ Error:", err));
  */