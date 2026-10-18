# Nexus Facility Report System

A simple facility issue reporting app for Nexus Hub. Anyone can submit a report without an account. Facility management can sign in at `/admin` to review reports and update their status.

## Requirements

- Python 3.10 or newer
- A PostgreSQL database (for example, Neon)

## Configure

1. Create a PostgreSQL project with your database provider. For Neon, open the project and select **Connect**. Choose your database and role, enable the pooled connection option, and copy its connection string.
2. Copy `.env.example` to `.env` in this folder.
3. Set `DATABASE_URL` to the full PostgreSQL connection string. The app accepts Neon’s `postgresql://` URI and configures the Psycopg driver automatically. Use the pooled connection string for serverless deployment.
4. Set `ADMIN_PASSWORD` to a strong password for the Facility Management Team.
5. Generate a unique `APP_SECRET_KEY`, for example with `python -c "import secrets; print(secrets.token_urlsafe(48))"`, and save it in `.env`.

The `.env.example` file contains placeholders only. Keep `.env` private and do not commit it. Set `APP_COOKIE_SECURE=true` when serving the app over HTTPS. Report photos are stored as binary data in PostgreSQL; the app does not use a local upload directory.

## Run locally

From this folder, create and activate a virtual environment, then install dependencies and launch the app:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000> to submit a report. Visit <http://127.0.0.1:8000/admin> directly for the admin login. On a new empty database, the first server start creates the report and photo tables. Existing Supabase reports and local photo files are not copied to Neon automatically.

## Included behavior

- Public reports start with **Pending** status. Report data is only available through admin-authenticated API routes.
- Admins can set Pending, Verified, In Progress, Completed, or Rejected and keep a resolution note with the report.
- JPG, PNG, and WebP photos up to 4 MiB (about 4.2 MB) are accepted. Photo bytes are stored in PostgreSQL, and photo reads require an admin session.
- Public social links and contact details are placeholders in `static/index.html`; replace them with Nexus Hub's official details.
