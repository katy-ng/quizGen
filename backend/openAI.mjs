/*NOT linked to an HTML, so everything is private (can't be seen in browser DevTools)
Purpose:
  Takes in chunked pdf text from server.js and uses them to prompt openAI to generate 
  a quiz based on the pdfs. 
*/

import "dotenv/config";
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
  for(chunk of pdfChunkArray){
    const response = await client.responses.create({
        model: "gpt-4.1-mini", //the model of openAI we're using
        input: [ //the prompt you send to openAI, split into different sections
          {
            role:"system", //role of content is system -> will set behavior + rules for the model
            content:`
              You are an educational assistant.
              Generate a quiz ONLY from the provided notes.
              Do not invent facts.
              Use clear wording suitable for students.
              Return ONLY valid JSON that matches the schema.
            `
          },{
            role:"user", //role of content is user -> will give openAI its actual purpose/use
            content: `Create one multiple choice, ${globalThis.difficulty}-difficulty question based on these notes: ${chunk}`
          }
        ],
        //ensures openAI's response is in a JSON format, specifying properties/guidelines to provide adequate info
        response_format:{
          type: "json_schema", //constructing the "schema"/blueprint of the JSON file; prevents the AI from responding with anything but JSON
          json_schema: {
            name: "quiz_question",
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
      questions.push(questionObject);
  }
  
  return questions;
}


/*--------------CALL THE FUNCTIONS-------------//
generateQuestionBank()
  .then(() => console.log("✅ API call succeeded"))
  .catch(err => console.error("❌ Error:", err));
  */