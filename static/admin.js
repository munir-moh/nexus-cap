const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const reportsBody = document.querySelector("#reports-body");
const reportView = document.querySelector("#report-view");
const dashboardContent = document.querySelector("#dashboard-content");
const backToReports = document.querySelector("#back-to-reports");
const pageTitle = document.querySelector("#admin-page-title");
const pageCopy = document.querySelector("#admin-page-copy");
const toast = document.querySelector("#admin-toast");
let reports = [];
let toastTimer;

document.querySelector("#admin-year").textContent = new Date().getFullYear();

function showToast(message, error = false) {
  toast.textContent = message;
  toast.className = `admin-toast${error ? " error" : ""}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  } catch (error) {
    throw new Error(`Could not reach ${url}. ${error.message || "Check that the local app is running."}`);
  }
  if (response.status === 401) {
    dashboardView.hidden = true;
    reportView.hidden = true;
    dashboardView.classList.remove("is-detail-view");
    backToReports.hidden = true;
    loginView.hidden = false;
    throw new Error("Your session expired. Please log in again.");
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.detail || "The request could not be completed.");
  return data;
}

function dateLabel(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function statusClass(value) {
  return value.toLowerCase().replaceAll(" ", "-");
}

function renderReports() {
  const selected = document.querySelector("#status-filter").value;
  const visible = selected === "All" ? reports : reports.filter((report) => report.status === selected);
  reportsBody.replaceChildren();
  if (!visible.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-state";
    cell.textContent = reports.length ? "No reports match this status." : "No reports have been submitted yet.";
    row.append(cell);
    reportsBody.append(row);
    return;
  }
  for (const report of visible) {
    const row = document.createElement("tr");
    const values = [report.id, report.facility_item, report.location, dateLabel(report.date_reported)];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 0) {
        const open = document.createElement("button");
        open.type = "button";
        open.className = "report-link";
        open.textContent = value;
        open.addEventListener("click", () => openReport(report.id));
        cell.append(open);
      } else cell.textContent = value;
      row.append(cell);
    });
    const statusCell = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `status-pill ${statusClass(report.status)}`;
    pill.textContent = report.status;
    statusCell.append(pill);
    row.append(statusCell);
    reportsBody.append(row);
  }
}

async function loadDashboard() {
  reportsBody.replaceChildren();
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 5;
  loadingCell.className = "loading-state";
  loadingCell.textContent = "Loading reports…";
  loadingRow.append(loadingCell);
  reportsBody.append(loadingRow);

  try {
    const data = await api("/api/admin/reports", { cache: "no-store" });
    if (!Array.isArray(data?.reports) || !data.summary) {
      throw new Error("The server returned an unexpected reports response.");
    }
    reports = data.reports;
    for (const [key, value] of Object.entries(data.summary)) {
      const element = document.querySelector(`#count-${key}`);
      if (element) element.textContent = value;
    }
    renderReports();
  } catch (error) {
    reports = [];
    reportsBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-state";
    cell.textContent = `Could not load reports: ${error.message}`;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button button-secondary";
    retry.textContent = "Retry";
    retry.addEventListener("click", loadDashboard);
    cell.append(document.createElement("br"), retry);
    row.append(cell);
    reportsBody.append(row);
    showToast(error.message, true);
  }
}

function addDetailField(container, label, value, full = false) {
  const wrapper = document.createElement("div");
  wrapper.className = `detail-field${full ? " full" : ""}`;
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value || "—";
  wrapper.append(term, description);
  container.append(wrapper);
  return description;
}

async function openReport(id) {
  try {
    const report = await api(`/api/admin/reports/${encodeURIComponent(id)}`);
    document.querySelector("#detail-title").textContent = report.facility_item;
    document.querySelector("#detail-id").textContent = report.id;
    const status = document.querySelector("#detail-status");
    status.className = `status-pill ${statusClass(report.status)}`;
    status.textContent = report.status;
    const fields = document.querySelector("#detail-fields");
    fields.replaceChildren();
    addDetailField(fields, "Reported by", report.name);
    addDetailField(fields, "Location", report.location);
    addDetailField(fields, "Facility / Item", report.facility_item);
    addDetailField(fields, "Date reported", dateLabel(report.date_reported));
    addDetailField(fields, "Date noticed", dateLabel(report.date_noticed));
    addDetailField(fields, "Current status", report.status);
    addDetailField(fields, "Description", report.description, true);
    addDetailField(fields, "Resolution note", report.resolution_note || "No resolution note yet.", true);
    if (report.photo_url) {
      const photoContainer = document.createElement("div");
      photoContainer.className = "detail-field full";
      const label = document.createElement("dt");
      label.textContent = "Attached photo";
      const image = document.createElement("img");
      image.className = "detail-photo";
      image.src = report.photo_url;
      image.alt = `Photo attached to report ${report.id}`;
      const imageDescription = document.createElement("dd");
      imageDescription.append(image);
      photoContainer.append(label, imageDescription);
      fields.append(photoContainer);
    }
    document.querySelector("#report-status").value = report.status;
    document.querySelector("#resolution-note").value = report.resolution_note || "";
    document.querySelector("#status-form").dataset.reportId = report.id;
    dashboardContent.hidden = true;
    reportView.hidden = false;
    dashboardView.classList.add("is-detail-view");
    backToReports.hidden = false;
    pageTitle.textContent = "Report details";
    pageCopy.textContent = "Review the information and update the report status.";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    showToast(error.message, true);
  }
}

function showReportList() {
  reportView.hidden = true;
  dashboardContent.hidden = false;
  dashboardView.classList.remove("is-detail-view");
  backToReports.hidden = true;
  pageTitle.textContent = "Report dashboard";
  pageCopy.textContent = "Review incoming reports and update their progress.";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  showReportList();
  await loadDashboard();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.querySelector("#login-error");
  const button = loginForm.querySelector("button");
  errorEl.hidden = true;
  button.disabled = true;
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: document.querySelector("#admin-password").value }) });
    document.querySelector("#admin-password").value = "";
    await showDashboard();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  } finally { button.disabled = false; }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST" }); } catch (error) { showToast(error.message, true); }
  dashboardView.hidden = true;
  loginView.hidden = false;
  reportView.hidden = true;
});

document.querySelector("#status-filter").addEventListener("change", renderReports);
backToReports.addEventListener("click", showReportList);

document.querySelector("#status-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.querySelector("#save-status");
  button.disabled = true;
  try {
    await api(`/api/admin/reports/${encodeURIComponent(form.dataset.reportId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: document.querySelector("#report-status").value, resolution_note: document.querySelector("#resolution-note").value }),
    });
    await loadDashboard();
    showReportList();
    showToast("Report updated successfully.");
  } catch (error) { showToast(error.message, true); }
  finally { button.disabled = false; }
});

(async () => {
  try {
    const session = await api("/api/admin/session");
    if (session.authenticated) await showDashboard();
    else loginView.hidden = false;
  } catch { loginView.hidden = false; }
})();
