/*NOT linked to an HTML, so everything is private (can't be seen in browser DevTools)
Purpose: the application's traffic controller between files, frontend and backend
  1. Receives uploaded pdfs from frontend, parses + chunks, sends chunks to openAI.mjs
  2. Receives structured quiz data from openAI.mjs and converts it into a JSON file in backend.

  follows ES Module, not CommonJS
  */

//-------------SEND UPLOADED FILES TO SERVER-------------//
//import modules (ES Module uses import/export, commonJS uses require() )
import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { generateQuestionBank } from "./openAI.mjs";
import "dotenv/config"; //loads .env variables into process.env

/*express() function creates an Express application object, so app is
  the server, which listens and responds to HTTP requests
    > app can be used for app.get(), .post(), .use(), .listen()*/
const app = express();

/*multer() function creates an upload handler, which processes multipart/form-data
  requests, aka file uploads. multer() takes in a parameter for where to put the 
  uploaded files -> by sending them to multer's memoryStorage(), the files are kept in
  RAM and not to the disk + are accessible through var upload*/
const upload = multer({storage:multer.memoryStorage()});

/*express.static() tells browser where to look first for a file -> you want
  the frontend html/css/js to appear for users, so enter the frontend folder 
  -> just entering "../frontend" only works localled, not on other people's
  computers -> use path.join() to connect __dirname (the absolute path to "backend/"),
  with "../frontend". */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(
  path.join(__dirname,"../frontend")
));
app.use(express.json());
const QUESTIONS_FILE = path.join(__dirname, "questions.json");

//-------------PARSE AND CHUNK PDFS-------------//
//chunk the parsed text from the pdfs
function chunkText(text, maxWords) {
  //split text on every space/tab/nl, turning large string of parsed text into large array of individual words
  const words = text.split(/\s+/); 
  const chunks = [];
  let currentChunk = [];

  for (const word of words) { //for each element in array words, aka every word in the parsed text
    currentChunk.push(word); //building chunks word by word

    /*when currentChunk goes over word count, joins each individual string collected into a single
      long string -> pushes it to array chunks -> clears currentChunk to start on next chunk*/
    if (currentChunk.length >= maxWords) {
      chunks.push(currentChunk.join(" ")); 
      currentChunk = [];
    }
  }

  //if there are still words remaining (total word count isn't divisible by maxWords), chunk that text
  if (currentChunk.length) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}

/*parse pdfs for text: app.post() listends for POST requests at /upload-pdfs,
  upload.array() looks for files with field name "pdfs" and sends the pdfs to req.files*/
app.post("/upload-pdfs", upload.array("pdfs"), async (req, res) => {
  try {
    console.log("FILES RECEIVED:", req.files.length);
    let chunkedPDFs = []; //array for each pdf's filename and chunked text
    for (const file of req.files) { //looks at each uploaded file stored in req.files
      if (file.mimetype !== "application/pdf") {
        continue; //if current file isn't a pdf, skip to the next file
      }
      console.log("Filename:", file.originalname);
      console.log("Mimetype:", file.mimetype);
      console.log("Size:", file.size);
      const parsedPDFs = await pdfParse(file.buffer); //pass in PDF binary (by using .buffer on each file) to be parsed
      console.log("Extracted text length:", parsedPDFs.text.length);
      
      //if current pdf contains little to no text, skip over it and continue to the next pdf
      if (!parsedPDFs.text || parsedPDFs.text.trim().length < 50) {
        chunkedPDFs.push({
          filename: file.originalname,
          error: "PDF contains little or no extractable text"
        });
        continue;
      }
      
      /*AI will gen a question based on each chunk, so by dividing the text by # of questions, it's
        guaranteed that there enough chunks to gen questions from (in fact, there will usually be a remainder
        after this division, there will be 1 more question than needed -> treat the JSON file AI generates as
        a question bank, pull questions at random from it to ensure all questions can be used)*/
        // or just combine the remainder with the last chunk? risk that last chunk being too long though
      const wordCap = parsedPDFs.text.length / globalThis.questions;
      if(wordCap > 1000){ wordCap = 1000 } //prompts cannot be more than 1000 words long
      const chunks = chunkText(parsedPDFs.text, wordCap); //chunk the parsed data every (wordCap) words
      console.log("Number of chunks:", chunks.length);
      console.log("First chunk preview:", chunks[0]?.slice(0, 200));

      //store each file's name and chunked text in array results
      chunkedPDFs.push({
        filename: file.originalname,
        chunks
      });
    }

    //calls openAI.mjs to generate the question bank using the chunked PDF text from array that was just filled
    const generatedQuestions = await generateQuestionBank(chunkedPDFs);

    let quizData = {generatedQuestions:[]}; //generateQuestionBank should return an array of JS objects, as quizData is initialized 
    //if there's already a JSON file, get the existing questions, then merge the generated questions with the existing ones
    if(fs.existsSync(QUESTIONS_FILE)){ 
      quizData = JSON.parse(fs.readFileSync(QUESTIONS_FILE,"utf-8"));
    }
    quizData.generatedQuestions.push(...generatedQuestions); //merges newly gen questions with prev gen questions (or with nothing, if no prev gen questions)

    //rewrite JSON (or create new JSON if it didn't exist before) with the newly generated questions (pretty-printed)
    fs.writeFileSync(
      QUESTIONS_FILE,
      JSON.stringify(quizData, null, 2) //JSON.stringify converts JS objects to JSON text (bc files can only store text/bytes)
    );

    //if try code is successful, sends "success response" with quizData array
    res.json({
      success: true,
      quizData
    });

  } catch (err) {
    console.error("PDF PARSE ERROR:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ error: "Failed to generate quiz", details: err.message });
  }
});


// ----------------QUIZ API---------------- //
/*Creates a GET endpoint for the frontend to access the question bank JSON file
  by "exposing" the JSON file as an API.*/
app.get("/api/quiz", (req, res) => {
  if (!fs.existsSync(QUESTIONS_FILE)) {
    return res.json({ generatedQuestions: [] });
  }
  //converts JSON file text (actual contents) back to JS objects (memory) in order to send the info to frontend
  const data = JSON.parse(fs.readFileSync(QUESTIONS_FILE, "utf-8"));
  res.json(data);
});


//-------------START THE SERVER-------------//
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

