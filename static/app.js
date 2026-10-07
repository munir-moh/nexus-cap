const form = document.querySelector("#report-form");
const formMessage = document.querySelector("#form-message");
const successPanel = document.querySelector("#success-panel");
const fileInput = document.querySelector("#photo");

document.querySelector("#year").textContent = new Date().getFullYear();
const dateField = form.elements.date_noticed;
dateField.max = new Date().toISOString().slice(0, 10);

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  document.querySelector("#file-label").textContent = file ? file.name : "Choose a photo";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.hidden = true;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Sending…";
  try {
    const response = await fetch("/api/reports", { method: "POST", body: new FormData(form) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "We could not send your report. Please try again.");
    form.hidden = true;
    document.querySelector(".card-heading").hidden = true;
    successPanel.hidden = false;
  } catch (error) {
    formMessage.textContent = error.message || "A connection error occurred. Please try again.";
    formMessage.hidden = false;
    formMessage.className = "form-message error";
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Submit report";
  }
});

document.querySelector("#new-report").addEventListener("click", () => {
  form.reset();
  formMessage.hidden = true;
  dateField.max = new Date().toISOString().slice(0, 10);
  document.querySelector("#file-label").textContent = "Choose a photo";
  form.hidden = false;
  document.querySelector(".card-heading").hidden = false;
  successPanel.hidden = true;
});
