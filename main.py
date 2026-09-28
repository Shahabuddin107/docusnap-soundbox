import os
import shutil
import uuid
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import SessionLocal, init_db, Receipt

app = FastAPI(title="DocuSnap Smart Soundbox")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("static", exist_ok=True)
init_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/receipts/save")
async def save_receipt(
    merchant: str = Form("Store"),
    amount: float = Form(0.0),
    bill_date: str = Form(""),
    category: str = Form("Payment Received"),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    saved_filename = ""
    if image and image.filename:
        ext = image.filename.split(".")[-1] if "." in image.filename else "jpg"
        saved_filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, saved_filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

    receipt = Receipt(
        merchant=merchant.strip() or "General Store",
        amount=amount,
        bill_date=bill_date,
        category=category,
        image_path=saved_filename
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return {"status": "success", "id": receipt.id, "amount": receipt.amount, "merchant": receipt.merchant}

@app.get("/api/receipts")
def list_receipts(db: Session = Depends(get_db)):
    return db.query(Receipt).order_by(Receipt.id.desc()).limit(15).all()

@app.get("/api/analytics/summary")
def get_summary(db: Session = Depends(get_db)):
    total = db.query(func.sum(Receipt.amount)).scalar() or 0.0
    count = db.query(func.count(Receipt.id)).scalar() or 0
    return {"total_expense": round(total, 2), "total_receipts": count}

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/", StaticFiles(directory="static", html=True), name="static")