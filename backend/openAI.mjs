import "dotenv/config";
/*NOT linked to an HTML, so everything is private (can't be seen in browser DevTools)
Purpose:
  Takes in chunked pdf text from server.js and uses them to prompt openAI to generate 
  a quiz based on the pdfs. 
*/

import fs from "fs";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

//generates a JavaScript object of questions and their answer choices; creates one set per chunk sent
//stores each set of question/answers in JSON format as a JavaScript object, in an array
//export functions are accessible by other files, just import the function from the file you're using it in
export async function generateQuestionBank(pdfChunkArray) {
  //give openAI instructions (how to speak + structure responses)
  const questions = [];

  // --- MOCK MODE --- 
  if (process.env.MOCK_AI === "true") { 
    console.log("⚠️ MOCK MODE ENABLED — No OpenAI calls will be made."); 
    for (let i = 0; i < pdfChunkArray.length; i++) { 
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
  for(const chunk of pdfChunkArray){
    const response = await client.responses.create({
      model: "gpt-4.1", //the model of openAI we're using
      input: ` 
        You are an educational assistant. 
        Generate one ${globalThis.difficulty}-difficulty multiple-choice question based ONLY on these notes: ${chunk} 
      `,
      //ensures openAI's response is in a JSON format, specifying properties/guidelines to provide adequate info
      text:{
        format:{
          name:"quiz_question",
          type: "json_schema", //constructing the "schema"/blueprint of the JSON file; prevents the AI from responding with anything but JSON
          schema: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "The quiz question generated from the PDF content"
              },
              choices: {
                type: "array",
                items: {
                  type: "string"
                },
                minItems: 4,
                maxItems: 4,
                description: "Exactly four multiple-choice answer options"
              },
              correct_answer: {
                type: "string",
                description: "The correct answer, which must exactly match one of the choices"
              },
              explanation: {
                type: "string",
                description: "A brief explanation of why the correct answer is correct"
              }
            },
            required: [
              "question",
              "choices",
              "correct_answer",
              "explanation"
            ],
            additionalProperties: false
          }
        }
      }
    }); 
  
    //Convert openAI's response into a JS object
    const questionObject = response.output_parsed;
    if (questionObject) {
      questions.push(questionObject);
      console.log("Success!");
    } else {
      console.error("❌ Null parsed output — skipping this chunk");
    }
  }
  
  console.log("Finished generating question bank.")
  return questions;
}


/*--------------CALL THE FUNCTIONS-------------//
generateQuestionBank()
  .then(() => console.log("✅ API call succeeded"))
  .catch(err => console.error("❌ Error:", err));
  */