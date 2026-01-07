/*NOT linked to an HTML, so everything is private (can't be seen in browser DevTools)
Purpose:
  1. Import OpenAI
  2. Send extracted pdf text as a prompt
*/

//-------------SEND UPLOADED FILES TO SERVER-------------//
//import modules (using the require() function)
const express = require("express");
const multer = require("multer");
const pdfParse = require('pdf-parse');
console.log("pdfParse type:", typeof pdfParse);

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
const path = require("path");
app.use(express.static(
  path.join(__dirname,"../frontend")
));

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
    const results = []; //array for each pdf's filename and chunked text
    for (const file of req.files) { //looks at each uploaded file stored in req.files
      if (file.mimetype !== "application/pdf") {
        continue; //if current file isn't a pdf, skip to the next file
      }
      console.log("Filename:", file.originalname);
      console.log("Mimetype:", file.mimetype);
      console.log("Size:", file.size);
      const data = await pdfParse(file.buffer); //pass in PDF binary (by using .buffer on each file) to be parsed
      console.log("Extracted text length:", data.text.length);
      
      if (!data.text || data.text.trim().length < 50) {
        results.push({
          filename: file.originalname,
          error: "PDF contains little or no extractable text"
        });
        continue;
      }
      
      const chunks = chunkText(data.text, 700); //chunk the parsed data every 700 words
      console.log("Number of chunks:", chunks.length);
      console.log("First chunk preview:", chunks[0]?.slice(0, 200));

      //store each file's name and chunked text in array results
      results.push({
        filename: file.originalname,
        chunks
      });
    }

    //sends array results to frontend as a JSON file, if try code is successful
    res.json({
      success: true,
      results
    });

    } catch (err) {
    console.error("PDF PARSE ERROR:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ error: "Failed to parse PDFs", details: err.message });
  }
});


//-------------START THE SERVER-------------//
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

