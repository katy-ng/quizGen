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
const numberQuestionContainer = document.querySelector('.number-question-container');
const difficultySelectContainer = document.querySelector('.difficulty-select-container');
const uploadedPDFs = [];

//generate quiz button turns into a reset button, which resets entire application to before any user interaction

/*----------Num Questions & Difficulty Buttons----------*/
numberQuestionContainer.addEventListener("click",(event)=>{
  //if the clicked element in the container was a number button, then update UI and variables 
  const clickedElement = event.target; 
  if(!clickedElement.classList.contains("number-button")) return;
  document.querySelectorAll(".number-button").forEach(button=>
    button.classList.remove("number-selected")
  );
  clickedElement.classList.add("number-selected");
  globalThis.questions = Number(clickedElement.textContent);
  console.log("QUESTIONS:",globalThis.questions);
});
difficultySelectContainer.addEventListener("click",(event)=>{
  //if the clicked element in the container was a difficulty button, then update UI and variables 
  const clickedElement = event.target; 
  if(!clickedElement.classList.contains("difficulty-button")) return;
  document.querySelectorAll(".difficulty-button").forEach(button=>
    button.classList.remove("difficulty-selected")
  );
  clickedElement.classList.add("difficulty-selected");
  globalThis.difficulty = clickedElement.textContent;
  console.log("DIFFICULTY:",globalThis.difficulty);
});


/*----------Upload PDFs----------*/
uploadButton.addEventListener("click",() => {
  pdfInput.click(); 
  /*to keep the input element invisible, make button adopt its functionality while
  being able to customize the upload button's appearance*/
});

pdfInput.addEventListener("change", async () => {
  const files = pdfInput.files;
  for(const file of files){
    /*----------MAINTENANCE----------*/
    //check if file is pdf or a duplicate
    if(file.type !=="application/pdf") continue;
    const alreadyUploaded = uploadedPDFs.some(existingFile =>
      existingFile.name === file.name &&
      existingFile.size === file.size &&
      existingFile.lastModified === file.lastModified
    );
    if (alreadyUploaded) continue;
    //if file is a new pdf, then add to the array of uploaded pdfs (manually upkeep this array bc removing from pdfInput.files is impossible)
    uploadedPDFs.push(file);

    /*----------CREATE UI----------*/
    const wrapper = document.createElement("div"); //need a div wrapper over each pdf display to modify appearance
    wrapper.classList.add("pdf-wrapper");
    const canvas = document.createElement("canvas");
    const wrapperOverlay = document.createElement("div"); //shows up when user hovers over the pdf
    wrapperOverlay.classList.add("pdf-wrapper-overlay");
    wrapperOverlay.innerHTML = `
      <div>${file.name}</div>
      <button class="remove-pdf-button"> X </button>
    `;
    const removeButton = wrapperOverlay.querySelector('.remove-pdf-button');
    removeButton.addEventListener("click", () => {
      wrapper.remove();
      for(let i=0;i<uploadedPDFs.length;i++){
        let current = uploadedPDFs[i];
        if(current.name===file.name && current.size===file.size && current.lastModified===file.lastModified){
          uploadedPDFs.splice(i,1);
          break;
        }
      }
    });

    /*----------RENDER PDF DISPLAY----------*/
    //Load PDf as an ArrayBuffer. Save RAM by not using embed, show 1st pg instead of all, using PDF.js lib.
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;

    wrapper.appendChild(canvas);
    wrapper.appendChild(wrapperOverlay);
    pdfDisplayContainer.appendChild(wrapper);

    //Immediately release memory
    pdf.cleanup();
    pdf.destroy();
  }
  pdfInput.value=""; //so you can reupload the same file
});

submitButton.addEventListener("click", async () => {
  if (!uploadedPDFs.length) return;

  await uploadPDFsToServer(uploadedPDFs);
  await loadQuiz();
});


async function uploadPDFsToServer(files) {
  const formData = new FormData(); //info collected from an HTML form

  //appends each uploaded pdf to formData
  Array.from(files).forEach(file => {
    formData.append("pdfs", file); //"pdfs" must match backend field name
  });
  formData.append("questions", globalThis.questions);
  formData.append("difficulty", globalThis.difficulty);
  /*sends uploaded pdfs in formData from public browser to private server (to be parsed)
    > await ensures the rest of the code waits for the upload to finish first
    > fetch() makes HTTP request, /upload-pdfs is the server's URL endpoint and
      matches backend route, so HTTP request goes to server.js*/
  const response = await fetch("/upload-pdfs", { 
    method: "POST", //sending data request = POST, receiving data request = GET
    body: formData 
  });
}

/*questions display one by one, click next/prev buttons to navigate through quiz*/
async function loadQuiz(){
  const res = await fetch("/api/quiz");
  const data = await res.json();

  /*quizContainer.innerHTML = "";*/
}
