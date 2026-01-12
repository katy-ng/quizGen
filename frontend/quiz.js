/*linked to HTML file so this file is PUBLIC in browser dev tools
Purpose:
  1. Capture file input, send PDF to backend using fetch() and FormData
  2. Display each question and answer choices of the quiz
  3. Add functionality to buttons, etc.
*/

/*----------Variables----------*/
globalThis.questions = 5;
globalThis.difficulty = "easy";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const uploadButton = document.getElementById("upload-button");
const pdfInput = document.getElementById("pdf-input");
const pdfDisplayContainer = document.querySelector('.pdf-display-container');
const submitButton = document.querySelector('.submit-button');

/*----------Upload PDF Button----------*/
uploadButton.addEventListener("click",() => {
  pdfInput.click(); 
  /*to keep the input element invisible, make button adopt its functionality while
  being able to customize the upload button's appearance*/
});

pdfInput.addEventListener("change", async () => {
  const files = pdfInput.files;
  for(const file of files){
    if(file.type !=="application/pdf") continue;
    const wrapper = document.createElement("div"); /*need a div wrapper over each pdf display to modify appearance*/
    wrapper.classList.add("pdf-wrapper");
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    pdfDisplayContainer.appendChild(wrapper);

    /*Load PDf as an ArrayBuffer.
      Save RAM by not using embed, show 1st pg instead of all, using PDF.js lib. */
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;

    //Immediately release memory
    pdf.cleanup();
    pdf.destroy();
  }
  /*pdfInput.value=""; //so you can reupload the same file*/
});

submitButton.addEventListener("click", async () => {
  const files = pdfInput.files;
  if (!files.length) return;

  await uploadPDFsToServer(files);
  await loadQuiz();
});


async function uploadPDFsToServer(files) {
  const formData = new FormData(); //info collected from an HTML form

  //appends each uploaded pdf to formData
  Array.from(files).forEach(file => {
    formData.append("pdfs", file); //"pdfs" must match backend field name
  });
  /*sends uploaded pdfs in formData from public browser to private server (to be parsed)
    > await ensures the rest of the code waits for the upload to finish first
    > fetch() makes HTTP request, /upload-pdfs is the server's URL endpoint and
      matches backend route, so HTTP request goes to server.js*/
  const response = await fetch("/upload-pdfs", { 
    method: "POST", //sending data request = POST, receiving data request = GET
    body: formData 
  });
}

async function loadQuiz(){
  const res = await fetch("/api/quiz");
  const data = await res.json();

  /*quizContainer.innerHTML = "";*/
}
