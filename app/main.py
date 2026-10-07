import hashlib
import hmac
import os
import secrets
import time
from datetime import date, datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Report

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "data/uploads"))
if not UPLOAD_DIR.is_absolute():
    UPLOAD_DIR = BASE_DIR / UPLOAD_DIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
APP_SECRET_KEY = os.getenv("APP_SECRET_KEY", "")
COOKIE_SECURE = os.getenv("APP_COOKIE_SECURE", "false").lower() in {"1", "true", "yes"}
SESSION_TTL_SECONDS = 12 * 60 * 60
SESSION_COOKIE = "nexus_admin_session"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
}
REPORT_STATUSES = {"Pending", "Verified", "In Progress", "Completed", "Rejected"}

app = FastAPI(title="Nexus Facility Report System", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def private_admin_responses(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/admin/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Vary"] = "Cookie"
    return response


@app.on_event("startup")
def initialize_database() -> None:
    if (
        not ADMIN_PASSWORD
        or ADMIN_PASSWORD == "replace_with_a_strong_admin_password"
        or len(APP_SECRET_KEY) < 32
        or APP_SECRET_KEY == "replace_with_a_long_random_secret"
    ):
        raise RuntimeError("Replace the ADMIN_PASSWORD and APP_SECRET_KEY placeholders in your .env file before starting the application.")
    Base.metadata.create_all(bind=engine)


def session_token() -> str:
    expires = str(int(time.time()) + SESSION_TTL_SECONDS)
    signature = hmac.new(APP_SECRET_KEY.encode(), f"admin:{expires}".encode(), hashlib.sha256).hexdigest()
    return f"{expires}.{signature}"


def is_admin(request: Request) -> bool:
    token = request.cookies.get(SESSION_COOKIE, "")
    try:
        expires, signature = token.split(".", 1)
        if int(expires) < int(time.time()):
            return False
    except (ValueError, TypeError):
        return False
    expected = hmac.new(APP_SECRET_KEY.encode(), f"admin:{expires}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


def require_admin(request: Request) -> None:
    if not is_admin(request):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please log in to continue.")


def report_data(report: Report) -> dict:
    return {
        "id": report.id,
        "name": report.name,
        "location": report.location,
        "facility_item": report.facility_item,
        "description": report.description,
        "date_noticed": report.date_noticed.isoformat(),
        "date_reported": report.created_at.isoformat(),
        "status": report.status,
        "resolution_note": report.resolution_note,
        "photo_url": f"/api/admin/reports/{report.id}/photo" if report.photo_filename else None,
    }


class LoginInput(BaseModel):
    password: str = Field(min_length=1, max_length=512)


class StatusUpdate(BaseModel):
    status: str
    resolution_note: str | None = Field(default=None, max_length=500)


@app.get("/", response_class=HTMLResponse)
def public_home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
def admin_home() -> FileResponse:
    return FileResponse(STATIC_DIR / "admin.html", headers={"X-Robots-Tag": "noindex, nofollow"})


@app.get("/robots.txt", include_in_schema=False)
def robots() -> Response:
    return Response("User-agent: *\nDisallow: /admin\nDisallow: /api/admin\n", media_type="text/plain")


@app.post("/api/reports", status_code=status.HTTP_201_CREATED)
async def create_report(
    name: str = Form(min_length=2, max_length=120),
    location: str = Form(min_length=2, max_length=100),
    facility_item: str = Form(min_length=2, max_length=100),
    description: str = Form(min_length=10, max_length=4000),
    date_noticed: date = Form(),
    photo: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> dict:
    name, location, facility_item, description = (value.strip() for value in (name, location, facility_item, description))
    if not all((name, location, facility_item, description)):
        raise HTTPException(status_code=422, detail="Please complete all required fields.")
    if date_noticed > date.today():
        raise HTTPException(status_code=422, detail="Date noticed cannot be in the future.")
    photo_filename = None
    if photo and photo.filename:
        file_type = ALLOWED_IMAGE_TYPES.get(photo.content_type or "")
        if not file_type:
            raise HTTPException(status_code=400, detail="Upload a JPG, PNG, or WebP image.")
        contents = await photo.read(MAX_UPLOAD_BYTES + 1)
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="Photos must be 5 MB or smaller.")
        extension, signature_check = file_type
        if not signature_check(contents):
            raise HTTPException(status_code=400, detail="The uploaded file does not match its image type.")
        photo_filename = f"{secrets.token_hex(20)}{extension}"
        (UPLOAD_DIR / photo_filename).write_bytes(contents)

    report_id = f"NXR-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3).upper()}"
    report = Report(
        id=report_id,
        name=name,
        location=location,
        facility_item=facility_item,
        description=description,
        date_noticed=date_noticed,
        photo_filename=photo_filename,
        status="Pending",
        created_at=datetime.now(timezone.utc),
    )
    try:
        db.add(report)
        db.commit()
    except Exception:
        db.rollback()
        if photo_filename:
            (UPLOAD_DIR / photo_filename).unlink(missing_ok=True)
        raise
    return {"message": "Report submitted successfully.", "id": report.id}


@app.post("/api/admin/login")
def admin_login(payload: LoginInput, response: Response) -> dict:
    if not hmac.compare_digest(payload.password.encode(), ADMIN_PASSWORD.encode()):
        raise HTTPException(status_code=401, detail="The password was not accepted.")
    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_token(),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        path="/api/admin",
    )
    return {"authenticated": True}


@app.post("/api/admin/logout")
def admin_logout(response: Response, _: None = Depends(require_admin)) -> dict:
    response.delete_cookie(SESSION_COOKIE, path="/api/admin", httponly=True, secure=COOKIE_SECURE, samesite="strict")
    return {"authenticated": False}


@app.get("/api/admin/session")
def admin_session(request: Request) -> dict:
    return {"authenticated": is_admin(request)}


@app.get("/api/admin/reports")
def list_reports(_: None = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    total = db.scalar(select(func.count()).select_from(Report)) or 0
    counts = dict(db.execute(select(Report.status, func.count()).group_by(Report.status)).all())
    reports = db.scalars(select(Report).order_by(Report.created_at.desc())).all()
    summary = {"total": total}
    summary.update({status.lower().replace(" ", "_"): counts.get(status, 0) for status in REPORT_STATUSES})
    return {"summary": summary, "reports": [report_data(item) for item in reports]}


@app.get("/api/admin/reports/{report_id}")
def get_report(report_id: str, _: None = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report_data(report)


@app.get("/api/admin/reports/{report_id}/photo")
def get_report_photo(report_id: str, _: None = Depends(require_admin), db: Session = Depends(get_db)) -> FileResponse:
    report = db.get(Report, report_id)
    if not report or not report.photo_filename:
        raise HTTPException(status_code=404, detail="Photo not found.")
    photo_path = UPLOAD_DIR / report.photo_filename
    if not photo_path.is_file():
        raise HTTPException(status_code=404, detail="Photo file not found.")
    return FileResponse(photo_path, headers={"Cache-Control": "private, no-store"})


@app.patch("/api/admin/reports/{report_id}")
def update_report(
    report_id: str,
    payload: StatusUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if payload.status not in REPORT_STATUSES:
        raise HTTPException(status_code=422, detail="Choose a valid report status.")
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    report.status = payload.status
    if payload.resolution_note is not None:
        report.resolution_note = payload.resolution_note.strip() or None
    db.commit()
    db.refresh(report)
    return report_data(report)
