const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const reportsBody = document.querySelector("#reports-body");
const detailOverlay = document.querySelector("#report-detail");
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
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  if (response.status === 401) {
    dashboardView.hidden = true;
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
  const data = await api("/api/admin/reports");
  reports = data.reports;
  for (const [key, value] of Object.entries(data.summary)) {
    const element = document.querySelector(`#count-${key}`);
    if (element) element.textContent = value;
  }
  renderReports();
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
      photoContainer.append(label, image);
      fields.append(photoContainer);
    }
    document.querySelector("#report-status").value = report.status;
    document.querySelector("#resolution-note").value = report.resolution_note || "";
    document.querySelector("#status-form").dataset.reportId = report.id;
    detailOverlay.hidden = false;
    document.querySelector("#close-detail").focus();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
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
  detailOverlay.hidden = true;
});

document.querySelector("#status-filter").addEventListener("change", renderReports);
document.querySelector("#close-detail").addEventListener("click", () => { detailOverlay.hidden = true; });
detailOverlay.addEventListener("click", (event) => { if (event.target === detailOverlay) detailOverlay.hidden = true; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") detailOverlay.hidden = true; });

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
    detailOverlay.hidden = true;
    await loadDashboard();
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
