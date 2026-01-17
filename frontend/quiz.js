/*linked to HTML file so this file is PUBLIC in browser dev tools
Purpose:
  1. Capture file input, send PDF to backend using fetch() and FormData
  2. Display each question and answer choices of the quiz
  3. Add functionality to buttons, etc.
*/

/*----------Variables----------*/
globalThis.questions=5;
globalThis.difficulty="easy";
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
const progressTitleContainer = document.querySelector('.progress-title-container');
const answersContainer = document.querySelector('.answers-container');
const scoreTitleContainer = document.querySelector('.score-title-container');
const pdfMessage = document.querySelector('.pdf-message');

let uploadedSizeSum = 0;
const uploadedPDFs = [];
let currentQuestionIndex = 0;
let questionArray = []; //array of generated quiz questions
let answerArray = []; //array of the user's selected answers
let scoreArray = []; //array of whether the user got the corresponding index question right or wrong 
let score = 0;
let progress = 0;
let submitted = false;

//generate quiz button turns into a reset button, which resets entire application to before any user interaction
//generate quiz button doesn't work until you've done all the prev steps

//send message to server.js every time quiz.html reloads (to reset backend, like clearing questions.json)
//IF MULTIPLE PEOPLE USE THIS SITE AND LOAD QUIZ.HTML, THEY WILL CLEAR EACH OTHER'S QUESTIONS
window.addEventListener("load", async () => {
  await fetch("/clear-questions", { method: "POST" });
  console.log("🧹 Cleared questions.json on page refresh");
});

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
  let problem = false;
  uploadedSizeSum = uploadedPDFs.reduce(
    (sum, f) => sum + f.size,
    0
  );
  let successfulUploads = 0;
  for(const file of files){
    /*----------MAINTENANCE----------*/
    //check if file is pdf or a duplicate
    if(file.type !=="application/pdf"){
      problem=true;
      continue;
    }
    const alreadyUploaded = uploadedPDFs.some(existingFile =>
      existingFile.name === file.name &&
      existingFile.size === file.size &&
      existingFile.lastModified === file.lastModified
    );
    if(file.size+uploadedSizeSum > 5*1024*1024 || alreadyUploaded){ //5MB file size upload cap
      problem=true;
      continue;
    }
    //if file is a new and adequately sized pdf, then add to the array of uploaded pdfs (manually upkeep this array bc removing from pdfInput.files is impossible)
    uploadedPDFs.push(file);
    uploadedSizeSum+=file.size;
    successfulUploads++;
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
          uploadedSizeSum-=current.size;
          pdfMessage.innerHTML = `
            <p>${(uploadedSizeSum/1024/1024).toFixed(2)} / 5MB <br>
              Successfully deleted file(s)</p>
          `
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
  if(problem){
      pdfMessage.innerHTML = `
        <p>${(uploadedSizeSum/1024/1024).toFixed(2)} / 5MB <br>
          Some files could not be uploaded (invalid file type, duplicate, or max file size reached) <br>
          Successfully uploaded ${successfulUploads} file(s)!</p>
        `
    } else {
      pdfMessage.innerHTML = `
        <p>${(uploadedSizeSum/1024/1024).toFixed(2)} / 5MB <br>
          Successfully uploaded ${successfulUploads} file(s)!</p>
      `
    }
  pdfInput.value=""; //so you can reupload the same file
});

generateButton.addEventListener("click", async () => {
  //reset prev gen quiz
  score = 0;
  progress = 0;
  submitted = false;
  answerArray = [];
  scoreArray = [];
  currentQuestionIndex = 0;

  //gen button only works if user selected all settings
  if(quizReady()){
    await uploadPDFsToServer(uploadedPDFs);
    await loadQuiz();
  }
});

function quizReady(){
  if(uploadedPDFs.length>0 && numberClicked && difficultyClicked){
    generateButton.classList.add("generate-button");
    generateButton.classList.remove("generate-button-disabled");
    console.log("Quiz Ready!")
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
  console.log(questionArray);
  displayQuestion(currentQuestionIndex);
  displayStats();
}

function getCorrectChoice(question){
  for(let i=0;i<question.choices.length;i++){
    if(question.choices[i]===question.correct_answer){
      return(String.fromCharCode(65+i));
    }
  }
  return("--");
}

/*design stats sidebar*/
async function displayStats(){
  //progress stat
  if(questionArray.length < 1){
    progressTitleContainer.innerHTML = `
      <h1>PROGRESS</h1>
      <h2>--/--</h2>
    `
  } else {
    progressTitleContainer.innerHTML = `
      <h1>PROGRESS</h1>
      <h2>${progress} / ${globalThis.questions}</h2>
    `
  }

  //menu showing overview of the questions (what you answered, and correct answers after submitting)
  answersContainer.innerHTML = ""; //clear container so calling function again doesn't append new children
  for(let i=0;i<questionArray.length;i++){
    let answersIndividualContainer = document.createElement('div');
    answersIndividualContainer.classList.add("answers-individual-container");
    
    let chosenAnswer = "--";
    if(answerArray[i] != null){
      chosenAnswer = answerArray[i];
    }
    answersIndividualContainer.innerHTML = `
      <div class="answers-question-unchosen">${i+1}</div>
      <div class="answers-answer">${chosenAnswer}</div>
      <div class="answers-correct">${getCorrectChoice(questionArray[i])}</div>
    `
    //question number boxes light up yellow if you've answered them, gray otherwise
    let numberBox = answersIndividualContainer.querySelector(".answers-question-unchosen");
    if(answerArray[i] != null){
      numberBox.classList.add("answers-question-chosen");
      numberBox.classList.remove("answers-question-unchosen");
    } else {
      numberBox.classList.add("answers-question-unchosen");
      numberBox.classList.remove("answers-question-chosen");
    }

    //after submission, correct answers become visible and their question number boxes turn green/red if right/wrong
    let correctAnswers = answersIndividualContainer.querySelector(".answers-correct");
    if(!submitted){
      correctAnswers.style.opacity=0;
    } else {
      correctAnswers.style.opacity=1;
      if(scoreArray[i]==="right"){
        numberBox.classList.add("answers-question-correct");
      } else {
        numberBox.classList.add("answers-question-incorrect");
      }
    }

    answersContainer.appendChild(answersIndividualContainer);
  }

  //score stat
  if(submitted){
    scoreTitleContainer.innerHTML = `
      <h1>SCORE</h1>
      <h2>${score} / ${globalThis.questions}</h2>
    `
  } else {
    scoreTitleContainer.innerHTML = `
      <h1>SCORE</h1>
      <h2>--/--</h2>
    `
  }
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
          <button class="option-button" data-choice="${String.fromCharCode(65+i)}">${String.fromCharCode(65+i)}</button> 
          <p>${choice}</p> 
        `).join("")}
      </div> 
    </div>
    <div class="answer-explanation-container"></div>
    <div class="back-next-container">
      <button class="back-next-button" id="back">BACK</button>
      <button class="back-next-button" id="next">NEXT</button>
    </div>
  `;
  //after submission, correct answers become visible
  let explanations = questionsContainer.querySelector(".answer-explanation-container");
  if(submitted){
    explanations.innerHTML=`
      <h2>Explanation:</h2>
      <p>${current.explanation}</p>
    `
  } 

  if(answerArray[currentQuestionIndex] != null){
    const selectedButton = document.querySelector(
      `.option-button[data-choice="${answerArray[currentQuestionIndex]}"]`
    );

    if (selectedButton) {
      selectedButton.classList.add("option-selected");
    }
  }
  document.querySelector('.options-grid-container').addEventListener("click",(event) => {
    const clickedElement = event.target;
    if(submitted){
      if(clickedElement.classList.contains("option-button")) return;
    } else {
      if(!clickedElement.classList.contains("option-button")) return;
      document.querySelectorAll(".option-button").forEach(button =>
        button.classList.remove("option-selected")
      );
      clickedElement.classList.add("option-selected");
      if(answerArray[currentQuestionIndex] == null){
        progress++;
      }
      answerArray[currentQuestionIndex] = clickedElement.dataset.choice;
      console.log("Chose",clickedElement.dataset.choice,"for question",currentQuestionIndex);
      console.log("Current questions answered:",answerArray);
      displayStats();
    }
  });
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

  console.log("Displayed question",currentQuestionIndex);
}

submitButton.addEventListener("click",()=>{
  submitted = true; //lock changing answers; display explanations, score, and correct answers
  console.log("Quiz successfully submitted!");

  //grading
  for(let i=0;i<answerArray.length;i++){
    if(answerArray[i]===getCorrectChoice(questionArray[i])){
      scoreArray[i]="right";
      score++;
    } else {
      scoreArray[i]="wrong";
    }
  }
  console.log("Score:",score,scoreArray);

  displayQuestion(currentQuestionIndex);
  displayStats();
});

