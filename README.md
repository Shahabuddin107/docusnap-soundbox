# 🔊 DocuSnap Smart Soundbox & Instant Ledger

A lightweight, standalone, and client-side AI-powered **Smart Payment Soundbox & Ledger** application designed for merchants and shopkeepers. It replicates hardware payment soundboxes directly inside any mobile browser using OCR and browser synthesis APIs.

🌐 **Live Demo:** [DocuSnap Soundbox](https://Shahabuddin107.github.io/docusnap-soundbox/)

---

## ✨ Key Features

- 📸 **Direct Live OCR Detection:** Auto-captures and scans transaction slips or phone screens targeting payer name and amount using `Tesseract.js`.
- 🗣️ **Natural Hindi Voice Alerts:** Instantly announces confirmed transactions in natural Hindi (*"[Payer] se [Amount] rupaye prapt hue. Received by Shahabuddin Store. Dhanyawad!"*).
- 🚨 **Fraud & Old Screenshot Detection:** Cross-verifies transaction dates against current timestamps to flag old/reused payment screenshots.
- 🔦 **Hardware Torch Control:** Integrated flashlight trigger using the `MediaStream ImageCapture API` for low-light environments.
- 📄 **1-Click Verified PDF Generation:** Generates styled receipts with captured proof images using `jsPDF`.
- 💬 **Direct WhatsApp Sharing:** Formats customized transaction receipts with instant one-tap WhatsApp redirection.
- 📊 **Daily Ledger CSV Export:** Single-click export of stored payments for accounting and end-of-day tallying.
- 💾 **100% Client-Side & Serverless:** Zero server maintenance, ultra-fast latency, and persistence via browser `localStorage`.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Modern Glassmorphism & Cyberpunk Mobile HUD)
- **Computer Vision / OCR:** Tesseract.js
- **Audio Feedback:** Web Speech Synthesis API & Web Audio API
- **Document Engine:** jsPDF
- **Camera Stream:** MediaDevices API (Environment facing with Torch constraint)
- **Hosting & Deployment:** GitHub Pages

---

## 🚀 How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Shahabuddin107/docusnap-soundbox.git](https://github.com/Shahabuddin107/docusnap-soundbox.git)
   cd docusnap-soundbox
