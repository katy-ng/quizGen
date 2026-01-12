/*linked to HTML file so this file is PUBLIC in browser dev tools
Purpose:
  1. Capture file input, send PDF to backend using fetch() and FormData
  2. Display each question and answer choices of the quiz
  3. Add functionality to buttons, etc.
*/

/*----------Variables----------*/
globalThis.questions = 5;
globalThis.difficulty = "easy";
const uploadButton = document.getElementById("upload-button");
const pdfInput = document.getElementById("pdf-input");
const pdfDisplayContainer = document.querySelector('.pdf-display-container');

/*----------Upload PDF Button----------*/
uploadButton.addEventListener("click",() => {
  pdfInput.click(); 
  /*to keep the input element invisible, make button adopt its functionality while
  being able to customize the upload button's appearance*/
});

pdfInput.addEventListener("change",() => {
  const files = pdfInput.files;
  Array.from(files).forEach(file => {
    if(file.type !=="application/pdf") return; /*ensure you only get pdfs*/
    const url = URL.createObjectURL(file);
    const wrapper = document.createElement("div"); /*need a div wrapper over each pdf display to modify appearance*/
    wrapper.classList.add("pdf-wrapper");
    const embed = document.createElement("embed");
    embed.src = url;
    embed.type = "application/pdf";

    wrapper.appendChild(embed);
    pdfDisplayContainer.appendChild(wrapper);
  });
  uploadPDFsToServer(files); //send files to server.js to be handled
  pdfInput.value=""; //so you can reupload the same file
  loadQuiz();  
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

  quizContainer.innerHTML = "";
}
