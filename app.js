const video = document.getElementById("camera-stream");
const canvas = document.getElementById("photo-canvas");
const viewfinder = document.querySelector(".viewfinder-card");
const liveMerchant = document.getElementById("live-merchant");
const liveAmount = document.getElementById("live-amount");
const liveStatus = document.getElementById("live-status");
const liveReceiver = document.getElementById("live-receiver");
const fraudBanner = document.getElementById("fraud-warning-banner");

const receiptsContainer = document.getElementById("receipts-container");
const instantPdfBtn = document.getElementById("instant-pdf-btn");
const whatsappBtn = document.getElementById("whatsapp-share-btn");
const torchBtn = document.getElementById("torch-toggle-btn");
const excelBtn = document.getElementById("export-excel-btn");
const refreshBtn = document.getElementById("clear-view-btn");

let isProcessing = false;
let lastDetectedSignature = "";
let currentTrack = null;
let isTorchOn = false;
let allTransactions = [];

const RECEIVER_STORE = "Shahabuddin Store";

let currentReceiptData = {
  payer: "Grahak",
  receiver: RECEIVER_STORE,
  amount: 0.0,
  date: "",
  imageData: null
};

window.addEventListener("DOMContentLoaded", () => {
  liveReceiver.innerText = `Receiver: ${RECEIVER_STORE}`;
  loadSummary();
  loadReceipts();
  startDirectCamera();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
});

// 1. Digital Beep / Soundbox Chime
function playSoundboxChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {}
}

// 2. Direct Pronunciation Soundbox Voice Alert (Spelling nahi, pura word bolega)
function speakSoundboxAlert(payerName, amount) {
  if (!('speechSynthesis' in window)) return;
  playSoundboxChime();

  setTimeout(() => {
    let cleanName = payerName
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .toLowerCase();

    cleanName = cleanName
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    if (!cleanName || cleanName.length < 3) {
      cleanName = "Grahak";
    }

    const intAmount = Math.round(amount);
    const announcement = `${cleanName} se ${intAmount} rupaye prapt hue. Received by ${RECEIVER_STORE}. Dhanyawad!`;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(announcement);

    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang.includes("hi") || v.lang.includes("IN"));
    if (hindiVoice) {
      utterance.voice = hindiVoice;
    }

    utterance.lang = "hi-IN";
    utterance.rate = 0.90;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  }, 350);
}

// 3. Camera Setup & Stream
async function startDirectCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
    currentTrack = stream.getVideoTracks()[0];
    liveStatus.innerText = "Camera active - Target me receipt rakhein";

    setInterval(autoScanPaymentFrame, 1900);
  } catch (err) {
    liveStatus.innerText = "Camera permission allow karein!";
  }
}

// 4. Torch Control
torchBtn.addEventListener("click", async () => {
  if (!currentTrack) return;
  const capabilities = currentTrack.getCapabilities ? currentTrack.getCapabilities() : {};

  if (!capabilities.torch) {
    alert("Device me Torch control supported nahi hai.");
    return;
  }

  isTorchOn = !isTorchOn;
  await currentTrack.applyConstraints({
    advanced: [{ torch: isTorchOn }]
  });
  torchBtn.innerText = isTorchOn ? "🔦 Off" : "🔦 Torch";
});

// 5. Live Frame Capture & OCR
async function autoScanPaymentFrame() {
  if (isProcessing || video.videoWidth === 0) return;

  isProcessing = true;
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    const { data: { text } } = await Tesseract.recognize(canvas, "eng");
    extractPayerAndAmount(text);
  } catch (err) {
  } finally {
    isProcessing = false;
  }
}

// 6. Strict Data Extraction Logic
function extractPayerAndAmount(rawText) {
  if (!rawText || rawText.trim().length === 0) return;

  const rawClean = rawText.replace(/\r/g, "");
  const lines = rawClean.split("\n").map(l => l.trim()).filter(Boolean);

  let detectedAmount = null;
  const amountWithKeyword = rawClean.match(/(?:₹|rs\.?|inr|total|paid|amount|received)[\s:]*([0-9,]+\.?[0-9]{0,2})/i);
  if (amountWithKeyword && amountWithKeyword[1]) {
    const parsed = parseFloat(amountWithKeyword[1].replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 0) detectedAmount = parsed;
  }

  if (!detectedAmount) {
    const numbers = rawClean.match(/\b\d+(\.\d{2})?\b/g);
    if (numbers) {
      const candidates = numbers
        .map(Number)
        .filter(n => n >= 5 && n <= 500000 && n !== 2024 && n !== 2025 && n !== 2026);
      if (candidates.length > 0) detectedAmount = Math.max(...candidates);
    }
  }

  if (!detectedAmount || detectedAmount <= 0) {
    liveStatus.innerText = "Payment amount dhoond raha hai...";
    return;
  }

  // Fraud / Old Date Check
  const dateMatch = rawClean.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  const todayStr = new Date().toLocaleDateString();
  let isPotentialOldScreenshot = false;

  if (dateMatch && dateMatch[0]) {
    const extractedDate = dateMatch[0].replace(/-/g, "/").replace(/\./g, "/");
    if (extractedDate !== todayStr && !extractedDate.includes("2026")) {
      isPotentialOldScreenshot = true;
    }
  }

  if (isPotentialOldScreenshot) {
    fraudBanner.style.display = "block";
    fraudBanner.innerText = `⚠️ Alert: Puraani payment date (${dateMatch[0]}) detect hui!`;
  } else {
    fraudBanner.style.display = "none";
  }

  // Clean Name Detection
  let detectedPayer = "";
  const payerRegex = /(?:from|paid by|sender|by|debited from|payer)[\s:]*([A-Za-z ]{3,25})/i;
  const payerMatch = rawClean.match(payerRegex);

  if (payerMatch && payerMatch[1]) {
    const candidate = payerMatch[1].trim();
    if (!/account|bank|upi|wallet|card|phonepe|paytm|gpay/i.test(candidate)) {
      detectedPayer = candidate;
    }
  }

  if (!detectedPayer) {
    for (let line of lines) {
      if (/^[A-Za-z\s]{3,22}$/.test(line)) {
        if (!/total|amount|paid|receipt|date|invoice|payment|successful|completed|rs|rupees|inr/i.test(line)) {
          detectedPayer = line.trim();
          break;
        }
      }
    }
  }

  if (detectedPayer) {
    detectedPayer = detectedPayer
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } else {
    detectedPayer = "Grahak";
  }

  const signature = `${detectedPayer}_${detectedAmount}`;

  liveMerchant.innerHTML = `Bheja: <span class="hud-payer-highlight">${detectedPayer}</span>`;
  liveAmount.innerText = `₹ ${detectedAmount.toFixed(2)}`;
  liveStatus.innerText = `Payment Verified (${detectedPayer}) ✓`;

  currentReceiptData = {
    payer: detectedPayer,
    receiver: RECEIVER_STORE,
    amount: detectedAmount,
    date: todayStr,
    imageData: canvas.toDataURL("image/jpeg", 0.8)
  };

  if (signature !== lastDetectedSignature) {
    lastDetectedSignature = signature;

    if (viewfinder) {
      viewfinder.classList.add("success-flash");
      setTimeout(() => viewfinder.classList.remove("success-flash"), 1200);
    }

    speakSoundboxAlert(detectedPayer, detectedAmount);
    savePaymentToCloud(detectedPayer, detectedAmount, todayStr);
  }
}

// 7. Auto Save to Backend
async function savePaymentToCloud(payer, amount, date) {
  const formData = new FormData();
  formData.append("merchant", `${payer} (To: ${RECEIVER_STORE})`);
  formData.append("amount", amount);
  formData.append("bill_date", date);
  formData.append("category", "Payment Received");

  canvas.toBlob(async (blob) => {
    if (blob) formData.append("image", blob, "receipt.jpg");

    try {
      const res = await fetch("/api/receipts/save", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.status === "success") {
        loadSummary();
        loadReceipts();
      }
    } catch (err) {}
  }, "image/jpeg", 0.8);
}

// 8. 1-Click WhatsApp Share
whatsappBtn.addEventListener("click", () => {
  if (!currentReceiptData.amount || currentReceiptData.amount === 0) {
    alert("Pehle koi payment scan hone dein!");
    return;
  }

  const phone = prompt("Customer ka WhatsApp Number enter karein (e.g. 919876543210):", "91");
  if (!phone || phone.trim() === "91") return;

  const message = `*Payment Receipt - ${RECEIVER_STORE}*\n\n` +
    `Namaste ${currentReceiptData.payer} ji,\n` +
    `Aapki payment prapt ho gayi hai.\n\n` +
    `Amount: *Rs. ${currentReceiptData.amount}*\n` +
    `Status: *SUCCESS / VERIFIED*\n` +
    `Date: ${currentReceiptData.date}\n\n` +
    `Dhanyawad! 🙏`;

  const waUrl = `https://wa.me/${phone.trim()}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
});

// 9. Instant PDF Download
instantPdfBtn.addEventListener("click", () => {
  if (!currentReceiptData.amount || currentReceiptData.amount === 0) {
    alert("Pehle payment scan hone dein!");
    return;
  }
  generatePdf(
    currentReceiptData.payer,
    currentReceiptData.receiver,
    currentReceiptData.amount,
    currentReceiptData.date,
    currentReceiptData.imageData
  );
});

// 10. Excel / CSV Export
excelBtn.addEventListener("click", () => {
  if (allTransactions.length === 0) {
    alert("Koi transactions record nahi mila!");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "ID,Merchant / Payer,Amount (INR),Date,Category\n";

  allTransactions.forEach((row) => {
    csvContent += `"${row.id}","${row.merchant}","${row.amount}","${row.bill_date}","${row.category}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Ledger_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

refreshBtn.addEventListener("click", () => {
  loadSummary();
  loadReceipts();
});

function generatePdf(payer, receiver, amount, date, imgBase64) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Official Payment Acknowledgement", 14, 18);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Paid By (Sender)   : ${payer}`, 14, 45);
  doc.text(`Received By (Store): ${receiver}`, 14, 55);
  doc.text(`Amount Received    : Rs. ${amount}`, 14, 65);
  doc.text(`Transaction Status : SUCCESS / VERIFIED`, 14, 75);
  doc.text(`Date & Time        : ${date || new Date().toLocaleString()}`, 14, 85);

  if (imgBase64) {
    doc.text("Scanned Slip / Proof:", 14, 100);
    doc.addImage(imgBase64, "JPEG", 14, 105, 120, 90);
  }

  doc.save(`Receipt_${payer}_Rs${amount}.pdf`);
}

async function loadSummary() {
  try {
    const res = await fetch("/api/analytics/summary");
    const data = await res.json();
    document.getElementById("stat-total").innerText = `₹ ${data.total_expense}`;
    document.getElementById("stat-count").innerText = data.total_receipts;
  } catch (err) {}
}

async function loadReceipts() {
  try {
    const res = await fetch("/api/receipts");
    const list = await res.json();
    allTransactions = list;
    receiptsContainer.innerHTML = "";
    list.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="bill-info">
          <strong>${item.merchant}</strong>
          <small style="color: #94a3b8;">${item.bill_date || "Today"}</small>
        </div>
        <div class="bill-side">
          <span style="color:#34d399; font-weight: bold;">₹ ${item.amount}</span>
          <button class="dl-small-btn" onclick="downloadRowReceipt('${item.merchant}', ${item.amount}, '${item.bill_date}')">PDF</button>
        </div>
      `;
      receiptsContainer.appendChild(li);
    });
  } catch (err) {}
}

window.downloadRowReceipt = function(merchantTitle, amount, date) {
  generatePdf(merchantTitle, RECEIVER_STORE, amount, date, null);
};