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
const generateButton = document.querySelector('.generate-button-disabled');
const numberQuestionContainer = document.querySelector('.number-question-container');
const difficultySelectContainer = document.querySelector('.difficulty-select-container');
let numberClicked = false;
let difficultyClicked = false;
const questionsContainer = document.querySelector('.questions-container');
const uploadedPDFs = [];
let currentQuestionIndex = 0;
let questionArray = []; //array of generated quiz questions
let answerArray = []; //array of the user's selected answers

//generate quiz button turns into a reset button, which resets entire application to before any user interaction
//generate quiz button doesn't work until you've done all the prev steps

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
  numberClicked=true;
  quizReady();
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
  difficultyClicked=true;
  quizReady();
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
    quizReady();

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
          quizReady();
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

generateButton.addEventListener("click", async () => {
  if(quizReady()){
    await uploadPDFsToServer(uploadedPDFs);
    await loadQuiz();
  }
});
function quizReady(){
  if(uploadedPDFs.length>0 && numberClicked && difficultyClicked){
    generateButton.classList.add("generate-button");
    generateButton.classList.remove("generate-button-disabled");
    return true;
  } else {
    generateButton.classList.add("generate-button-disabled");
    generateButton.classList.remove("generate-button");
    return false;
  }
}


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
  if (!response.ok) { 
    throw new Error(`Server error: ${response.status}`);
  }
  return await response.json();
}

/*questions display one by one, click next/prev buttons to navigate through quiz*/
async function loadQuiz(){
  //get information from the generated JSON file (created an access point in backend by making an api)
  const res = await fetch("/api/quiz");
  //data.generatedQuestions gives you the array of question objects
  const data = await res.json();
  questionArray = data.generatedQuestions;
  if(questionArray.length==0){ //error message
    questionsContainer.innerHTML=`
    <div class="generate-error">
      <p>Sorry! We had trouble generating a quiz for you.</p>
      <p>Did you do all of the following?</p>
      <ol>
        <li>Upload at least one text-based PDF.</li>
        <li>Select the total number of questions for your quiz.</li>
        <li>Select the difficulty for your quiz.</li>
      </ol>
    </div>
    `
  }
  displayQuestion(currentQuestionIndex);
}
/*design question display:
  > dynamically design how the choices are displayed
  > String.fromCharCode() converts numbers to letters, to get letter choices
  > .join("") merges previous code into one HTML string
  > "disabled" makes button not functional, style with "inactive" in CSS*/
async function displayQuestion(index){
  const current = questionArray[index];
  if (!current) {
    console.error("❌ Tried to display a null question");
    return;
  }
  questionsContainer.innerHTML = `
    <div class="quiz-title-container">
      <h1>QUIZ</h1>
      <div class="rectangle-element"></div>
    </div>
    <div class="quiz-question-container">
      <div class="square-element">${index+1}</div>
      <p>${current.question}</p>
    </div>
    <div class="options-flex-container">
      <div class="options-grid-container">
        ${current.choices.map((choice, i) => `
          <button class="option-button" id="${String.fromCharCode(65+i)}">${String.fromCharCode(65+i)}</button> 
          <p>${choice}</p> 
        `).join("")}
      </div>
    </div>
    <div class="answer-explanation-container">
      <h2>Explanation:</h2>
      <p>${current.explanation}</p>
    </div>
    <div class="back-next-container">
      <button class="back-next-button" id="back">BACK</button>
      <button class="back-next-button" id="next">NEXT</button>
    </div>
  `;
  document.getElementById("back").addEventListener("click", () => { 
    if(currentQuestionIndex > 0){
      currentQuestionIndex--;
    } else if(currentQuestionIndex == 0){
      currentQuestionIndex = questionArray.length-1;
    }
    displayQuestion(currentQuestionIndex);
  }); 
  document.getElementById("next").addEventListener("click", () => {
    if(currentQuestionIndex < questionArray.length - 1){ 
      currentQuestionIndex++; 
    } else if(currentQuestionIndex == questionArray.length-1){
      currentQuestionIndex = 0;
    }
    displayQuestion(currentQuestionIndex);
  });
}


