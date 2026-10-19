import * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const REPORT_STATUSES = ["Pending", "Verified", "In Progress", "Completed", "Rejected"];

function getInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem("nexus-theme");
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  } catch {
    // Use the system preference when browser storage is unavailable.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={`${isDark ? "Dark" : "Light"} mode`}
      onClick={onToggle}
    >
      <span className="theme-toggle-label">{isDark ? "Dark" : "Light"} mode</span>
      <span className="theme-switch" aria-hidden="true"><span className="theme-switch-thumb" /></span>
    </button>
  );
}

function SiteHeader({ theme, onToggle }) {
  return (
    <header className="site-header">
      <nav className="navbar container" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Nexus Hub home">
          <img className="brand-logo" src="/static/images/logo.png" alt="Nexus Hub logo" />
        </a>
        <ThemeToggle theme={theme} onToggle={onToggle} />
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <div className="footer-brand-block">
          <a className="brand footer-brand" href="/" aria-label="Nexus Hub home">
            <img className="brand-logo" src="/static/images/logo.png" alt="Nexus Hub logo" />
          </a>
          <p>A tech hub for coworking, meetings, and digital skills training.</p>
        </div>
        <div className="footer-contact">
          <h2>Get in touch</h2>
          <a href="mailto:hello@nexushub.example">hello@nexusworkspace.online</a>
          <a href="tel:+234 906 149 4829">+234 906 149 4829</a>
          <span>No. 8 Bida Road, Kaduna, Nigeria</span>
        </div>
        <div className="footer-social">
          <h2>Follow Nexus Hub</h2>
          <div className="social-links">
            <a href="https://www.facebook.com/your-nexus-hub-page" target="_blank" rel="noopener noreferrer" aria-label="Nexus Hub on Facebook">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.2v3.2H10V21h3.4Z" fill="currentColor" /></svg>
            </a>
            <a href="https://x.com/thenexus_hub?s=21" target="_blank" rel="noopener noreferrer" aria-label="Nexus Hub on X">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 3H22l-6.8 7.8L23.2 21h-6.3L12 14.8 6.6 21H3.4l7.3-8.4L2.8 3h6.5l4.5 5.9L18.9 3Zm-1.1 16h1.7L8.3 4.9H6.5L17.8 19Z" fill="currentColor" /></svg>
            </a>
            <a href="https://www.instagram.com/thenexus_space?stkn=b3VoYzlyNTlra3Nj" target="_blank" rel="noopener noreferrer" aria-label="Nexus Hub on Instagram">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.6" cy="6.8" r="1.1" fill="currentColor" /></svg>
            </a>
            <a href="https://www.linkedin.com/company/the-nexus-space/" target="_blank" rel="noopener noreferrer" aria-label="Nexus Hub on LinkedIn">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 8.6H2V21h3.2V8.6ZM3.6 7.1a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8ZM22 13.9c0-3.7-2-5.5-4.7-5.5a4.1 4.1 0 0 0-3.7 2v-1.8h-3.2V21h3.2v-6.1c0-1.6.3-3.1 2.3-3.1s2 1.8 2 3.2V21H21v-7.1Z" fill="currentColor" /></svg>
            </a>
          </div>
        </div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} Nexus Hub. All rights reserved.</span></div>
    </footer>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15.5V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v4a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PublicReportPage({ theme, onToggle }) {
  const formRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("Choose a photo");
  const [formMessage, setFormMessage] = useState(null);
  const maxDate = new Date().toISOString().slice(0, 10);

  function handleFileChange(event) {
    let file = event.currentTarget.files?.[0] ?? null;
    if (file && file.size > MAX_PHOTO_BYTES) {
      event.currentTarget.value = "";
      file = null;
      setFormMessage({ type: "error", text: "Photos must be 4.2 MB or smaller." });
    } else {
      setFormMessage(null);
    }
    setFileName(file ? file.name : "Choose a photo");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormMessage(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/reports", { method: "POST", body: new FormData(formRef.current) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "We could not send your report. Please try again.");
      setSubmitted(true);
    } catch (error) {
      setFormMessage({ type: "error", text: error.message || "A connection error occurred. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function startAnotherReport() {
    formRef.current?.reset();
    setFormMessage(null);
    setFileName("Choose a photo");
    setSubmitted(false);
  }

  return (
    <>
      <SiteHeader theme={theme} onToggle={onToggle} />
      <main className="container public-main">
        <section className="intro" aria-labelledby="page-title">
          <h1 id="page-title">Nexus Hub Facility Maintenance Report</h1>
          <p className="intro-copy">Use this form to tell our team about an item or space that needs attention.</p>
        </section>

        <section className="report-card" aria-labelledby="form-title">
          {!submitted && (
            <>
              <div className="card-heading">
                <div className="heading-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M7 3.75h7l4.25 4.3v12.2H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" /><path d="M14 4v4.5h4.25M8.5 12h7m-7 3.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </div>
                <div><h2 id="form-title">Report Details</h2><p>Fields marked <span className="required">*</span> are required.</p></div>
              </div>
              <form ref={formRef} className="report-form" onSubmit={handleSubmit}>
                <div className="field-grid">
                  <label className="field"><span>Your Name <b>*</b></span><input name="name" type="text" autoComplete="name" placeholder="e.g. Munir Mohammed" minLength="2" maxLength="120" required /></label>
                  <label className="field"><span>Location <b>*</b></span><select name="location" defaultValue="" required><option value="" disabled>Select a location</option><option>Main Reception</option><option>Coworking Space</option><option>Meeting Room</option><option>Private Office</option><option>Kitchen</option><option>Restroom</option><option>Event Space</option><option>Other</option></select></label>
                  <label className="field"><span>Facility or Item <b>*</b></span><select name="facility_item" defaultValue="" required><option value="" disabled>Select an item</option><option>Chair</option><option>Desk</option><option>Air Conditioning</option><option>Lighting</option><option>Electrical Outlet</option><option>Internet / Wi-Fi</option><option>Plumbing</option><option>Door / Lock</option><option>Printer</option><option>Cleanliness</option><option>Other</option></select></label>
                  <label className="field"><span>Date Noticed <b>*</b></span><input name="date_noticed" type="date" max={maxDate} required /></label>
                  <label className="field field-full"><span>Description of Problem <b>*</b></span><textarea name="description" rows="4" minLength="10" maxLength="4000" placeholder="Describe what happened and where the team can find it…" required /></label>
                  <label className="field field-full"><span>Photo <small>(optional)</small></span>
                    <div className="upload-control">
                      <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
                      <span className="upload-icon"><UploadIcon /></span>
                      <span className="upload-copy"><strong>{fileName}</strong><small>JPG, PNG or WebP · up to 4.2 MB</small></span>
                      <span className="upload-browse">Browse</span>
                    </div>
                  </label>
                </div>
                {formMessage && <div className={`form-message ${formMessage.type}`} role="status" aria-live="polite">{formMessage.text}</div>}
                <div className="form-actions">
                  <button className="button button-primary" type="submit" disabled={submitting}>
                    <span>{submitting ? "Sending…" : "Submit report"}</span>
                    {!submitting && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                </div>
              </form>
            </>
          )}
          {submitted && (
            <div className="success-panel" role="status" aria-live="polite">
              <h2>Report submitted successfully.</h2>
              <p>Thank you for helping us maintain Nexus Hub.</p>
              <button className="button button-secondary" type="button" onClick={startAnotherReport}>Submit another report</button>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

async function requestApi(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
  } catch (error) {
    const message = error.message || "Check that the local app is running.";
    throw new Error(`Could not reach ${url}. ${message}`);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.detail || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function dateLabel(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function statusClass(value = "") {
  return value.toLowerCase().replaceAll(" ", "-");
}

function StatusPill({ status }) {
  return <span className={`status-pill ${statusClass(status)}`}>{status}</span>;
}

function AdminFooter() {
  return <footer className="admin-footer">© {new Date().getFullYear()} Nexus Hub. All rights reserved.</footer>;
}

function AdminLogin({ onLogin, error, busy }) {
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    await onLogin(password, () => setPassword(""));
  }

  return (
    <section className="admin-login-wrap">
      <section className="report-card admin-login-card" aria-labelledby="login-title">
        <div className="card-heading"><div><h2 id="login-title">Admin sign in</h2><p>Enter your password to continue.</p></div></div>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label className="field"><span>Admin password</span><input className="admin-input" type="password" autoComplete="current-password" placeholder="Enter the admin password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <div className="admin-login-error" role="alert">{error}</div>}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>
    </section>
  );
}

function ReportDetails({ report, onSave, saving }) {
  const [status, setStatus] = useState(report.status);
  const [resolutionNote, setResolutionNote] = useState(report.resolution_note || "");

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave({ status, resolution_note: resolutionNote });
  }

  return (
    <section className="admin-report-view" aria-labelledby="detail-title">
      <article className="report-card admin-report-card">
        <div className="card-heading admin-detail-heading">
          <div><h2 id="detail-title">{report.facility_item}</h2><p>{report.id}</p></div>
          <StatusPill status={report.status} />
        </div>
        <div className="admin-report-body">
          <dl className="detail-fields">
            <DetailField label="Reported by" value={report.name} />
            <DetailField label="Location" value={report.location} />
            <DetailField label="Facility / Item" value={report.facility_item} />
            <DetailField label="Date reported" value={dateLabel(report.date_reported)} />
            <DetailField label="Date noticed" value={dateLabel(report.date_noticed)} />
            <DetailField label="Current status" value={report.status} />
            <DetailField label="Description" value={report.description} full />
            <DetailField label="Resolution note" value={report.resolution_note || "No resolution note yet."} full />
            {report.photo_url && <div className="detail-field full"><dt>Attached photo</dt><dd><img className="detail-photo" src={report.photo_url} alt={`Photo attached to report ${report.id}`} /></dd></div>}
          </dl>
          <form className="detail-update" onSubmit={handleSubmit}>
            <h3>Update report</h3>
            <div className="field-grid">
              <label className="field"><span>Status</span><select className="admin-input" value={status} onChange={(event) => setStatus(event.target.value)}>{REPORT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="field field-full"><span>Resolution note <small>(optional, up to 500 characters)</small></span><textarea maxLength="500" placeholder="Add a note about the work completed or inspection…" value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} /></label>
            </div>
            <div className="form-actions admin-form-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save update"}</button></div>
          </form>
        </div>
      </article>
    </section>
  );
}

function DetailField({ label, value, full = false }) {
  return <div className={`detail-field${full ? " full" : ""}`}><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function ReportsTable({ reports, filter, onFilterChange, onOpen, loading, error, onRetry }) {
  const visibleReports = filter === "All" ? reports : reports.filter((report) => report.status === filter);

  return (
    <section className="reports-card" aria-labelledby="reports-title">
      <div className="reports-top">
        <div><h2 id="reports-title">Facility reports</h2></div>
        <select className="admin-select" aria-label="Filter reports by status" value={filter} onChange={(event) => onFilterChange(event.target.value)}>
          <option value="All">All statuses</option>{REPORT_STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
      </div>
      <div className="table-scroll"><table className="reports-table">
        <thead><tr><th>Report ID</th><th>Facility / Item</th><th>Location</th><th>Date reported</th><th>Status</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan="5" className="loading-state">Loading reports…</td></tr>}
          {!loading && error && <tr><td colSpan="5" className="empty-state">Could not load reports: {error}<br /><button className="button button-secondary" type="button" onClick={onRetry}>Retry</button></td></tr>}
          {!loading && !error && visibleReports.length === 0 && <tr><td colSpan="5" className="empty-state">{reports.length ? "No reports match this status." : "No reports have been submitted yet."}</td></tr>}
          {!loading && !error && visibleReports.map((report) => (
            <tr key={report.id}>
              <td><button className="report-link" type="button" onClick={() => onOpen(report.id)}>{report.id}</button></td>
              <td>{report.facility_item}</td><td>{report.location}</td><td>{dateLabel(report.date_reported)}</td><td><StatusPill status={report.status} /></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </section>
  );
}

function AdminPage({ theme, onToggle }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, verified: 0, in_progress: 0, completed: 0 });
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedReport, setSelectedReport] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, error = false) => {
    setToast({ message, error });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    setReportsError("");
    try {
      const data = await requestApi("/api/admin/reports", { cache: "no-store" });
      if (!Array.isArray(data?.reports) || !data.summary) throw new Error("The server returned an unexpected reports response.");
      setReports(data.reports);
      setSummary(data.summary);
      return true;
    } catch (error) {
      setReports([]);
      setReportsError(error.message);
      showToast(error.message, true);
      if (error.status === 401) {
        setAuthenticated(false);
        setSelectedReport(null);
      }
      return false;
    } finally {
      setLoadingReports(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    requestApi("/api/admin/session", { cache: "no-store" })
      .then(async (session) => {
        if (!active || !session.authenticated) return;
        setAuthenticated(true);
        await loadReports();
      })
      .catch((error) => {
        if (active && error.status !== 401) showToast(error.message, true);
      });
    return () => { active = false; window.clearTimeout(toastTimer.current); };
  }, [loadReports, showToast]);

  async function handleLogin(password, clearPassword) {
    setLoginBusy(true);
    setLoginError("");
    try {
      await requestApi("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      clearPassword();
      setAuthenticated(true);
      await loadReports();
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginBusy(false);
    }
  }

  async function openReport(id) {
    try {
      const report = await requestApi(`/api/admin/reports/${encodeURIComponent(id)}`);
      setSelectedReport(report);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (error.status === 401) {
        setAuthenticated(false);
        setSelectedReport(null);
      }
      showToast(error.message, true);
    }
  }

  async function saveReport(update) {
    if (!selectedReport) return;
    setSaving(true);
    try {
      await requestApi(`/api/admin/reports/${encodeURIComponent(selectedReport.id)}`, { method: "PATCH", body: JSON.stringify(update) });
      await loadReports();
      setSelectedReport(null);
      showToast("Report updated successfully.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (error.status === 401) {
        setAuthenticated(false);
        setSelectedReport(null);
      }
      showToast(error.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await requestApi("/api/admin/logout", { method: "POST" });
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setAuthenticated(false);
      setSelectedReport(null);
      setReports([]);
    }
  }

  const detailView = Boolean(selectedReport);
  const adminPageTitle = detailView ? "Report details" : "Report dashboard";
  const adminPageCopy = detailView ? "Review the information and update the report status." : "Review incoming reports and update their progress.";

  return (
    <>
      <SiteHeader theme={theme} onToggle={onToggle} />
      <main className="admin-main">
        {!authenticated ? <AdminLogin onLogin={handleLogin} error={loginError} busy={loginBusy} /> : (
          <section className={`admin-dashboard${detailView ? " is-detail-view" : ""}`}>
            <div className="admin-heading">
              <div><h1 id="admin-page-title">{adminPageTitle}</h1><p id="admin-page-copy">{adminPageCopy}</p></div>
              <div className="admin-heading-actions">
                {detailView && <button className="button button-secondary" type="button" onClick={() => setSelectedReport(null)}>Back to reports</button>}
                <button className="button button-quiet" type="button" onClick={handleLogout}>Log out</button>
              </div>
            </div>

            {detailView ? <ReportDetails key={selectedReport.id} report={selectedReport} onSave={saveReport} saving={saving} /> : (
              <div>
                <div className="summary-grid" aria-label="Report totals">
                  <SummaryCard label="Total reports" value={summary.total} />
                  <SummaryCard label="Pending" value={summary.pending} />
                  <SummaryCard label="Verified" value={summary.verified} />
                  <SummaryCard label="In progress" value={summary.in_progress} />
                  <SummaryCard label="Completed" value={summary.completed} />
                </div>
                <ReportsTable reports={reports} filter={filter} onFilterChange={setFilter} onOpen={openReport} loading={loadingReports} error={reportsError} onRetry={loadReports} />
              </div>
            )}
          </section>
        )}
      </main>
      <AdminFooter />
      {toast && <div className={`admin-toast${toast.error ? " error" : ""}`} role="status" aria-live="polite">{toast.message}</div>}
    </>
  );
}

function SummaryCard({ label, value = 0 }) {
  return <article className="summary-card"><span>{label}</span><strong>{value}</strong></article>;
}

function App() {
  const isAdminPage = window.location.pathname.replace(/\/+$/, "") === "/admin";
  const [theme, setTheme] = useState(getInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#151b18" : "#ffffff");
    document.title = isAdminPage ? "Facility Management | Nexus Hub" : "Facility Report | Nexus Hub";
    document.body.classList.toggle("admin-page", isAdminPage);
    if (isAdminPage) {
      let robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.append(robots);
      }
      robots.content = "noindex, nofollow";
    }
  }, [theme, isAdminPage]);

  const toggleTheme = () => setTheme((current) => {
    const nextTheme = current === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem("nexus-theme", nextTheme);
    } catch {
      // The selected theme still applies for this visit if storage is unavailable.
    }
    return nextTheme;
  });
  return isAdminPage ? <AdminPage theme={theme} onToggle={toggleTheme} /> : <PublicReportPage theme={theme} onToggle={toggleTheme} />;
}

createRoot(document.getElementById("root")).render(<App />);
