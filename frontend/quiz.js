/*linked to HTML file so this file is PUBLIC in browser dev tools
Purpose:
  1. Capture file input, send PDF to backend using fetch() and FormData
  2. Display each question and answer choices of the quiz
  3. Add functionality to buttons, etc.
*/

/*----------Variables----------*/
const uploadButton = document.getElementById("upload-button");
const pdfInput = document.getElementById("pdf-input");
const pdfDisplayContainer = document.querySelector('.pdf-display-container');

/*----------Upload PDF Button----------*/
uploadButton.addEventListener("click",() => {
  pdfInput.click(); /*to keep the input element invisible, make button adopt its functionality*/
});
pdfInput.addEventListener("change",() => {
  Array.from(pdfInput.files).forEach(file => {
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
  pdfInput.value=""; /*so you can reupload the same file*/
});

