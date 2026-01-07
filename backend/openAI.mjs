/*NOT linked to an HTML, so everything is private (can't be seen in browser DevTools)
Purpose:
  Takes in chunked pdf text from server.js and uses them to prompt openAI to generate 
  a quiz based on the pdfs. 
*/

import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
    model: "gpt-5-nano",
    input: "Write a one-sentence bedtime story about a unicorn."
});

console.log(response.output_text);