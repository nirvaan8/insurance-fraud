<div align="center">

```
███████╗██████╗  █████╗ ██╗   ██╗██████╗ ███████╗██╗   ██╗███████╗
██╔════╝██╔══██╗██╔══██╗██║   ██║██╔══██╗██╔════╝╚██╗ ██╔╝██╔════╝
█████╗  ██████╔╝███████║██║   ██║██║  ██║███████╗ ╚████╔╝ ███████╗
██╔══╝  ██╔══██╗██╔══██║██║   ██║██║  ██║╚════██║  ╚██╔╝  ╚════██║
██║     ██║  ██║██║  ██║╚██████╔╝██████╔╝███████║   ██║   ███████║
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝   ╚═╝   ╚══════╝
```

**// THREAT INTELLIGENCE PLATFORM**

[![Live](https://img.shields.io/badge/LIVE-railway-brightgreen?style=for-the-badge&logo=railway)](https://insurance-fraud-production.up.railway.app)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com/atlas)
[![JWT](https://img.shields.io/badge/Auth-JWT+2FA-orange?style=for-the-badge&logo=jsonwebtokens)](https://jwt.io)

</div>

---

## 🌐 Live Demo

> **[https://insurance-fraud-production.up.railway.app](https://insurance-fraud-production.up.railway.app)**

| Credential | Value |
|---|---|
| Register your own account | `/register.html` |
| Default admin role | Set during registration |

---

## 📌 Overview

FraudSys is a full-stack insurance fraud detection and threat monitoring platform built for a cybersecurity portfolio project. It combines machine learning-based risk scoring with a real-time SOC (Security Operations Center) event log — simulating enterprise-grade tools like Wazuh, Splunk, and IBM QRadar.

Upload a CSV of insurance claims → get instant risk classification, anomaly detection, confidence scores, and fraud flags — all visualized on a live dashboard.

---

## ✨ Features

### 🔐 Authentication & Security
- **JWT-based auth** — signed tokens with 8-hour expiry, auto-logout on session end
- **2FA Email OTP** — 6-digit one-time password on every login (5-minute expiry)
- **Google OAuth** — single sign-on via Google
- **Brute force protection** — account locks after 5 failed attempts (15-minute lockout)
- **Input sanitization** — NoSQL injection prevention via `express-mongo-sanitize`, XSS stripping
- **Admin unlock** — admin can manually unlock locked accounts

### 🤖 ML Fraud Detection
- **Risk classification** — Low / Medium / High per claim
- **Confidence scoring** — 0–100% confidence per prediction
- **Anomaly detection** — flags statistically unusual claims
- **Rule-based flags** — `EXTREME_AMOUNT`, `EXCESSIVE_CLAIMS`, `HIGH_AMOUNT_HIGH_CLAIMS`, `ABNORMAL_CLAIM_RATIO`
- **Batch processing** — entire CSV processed in one pass (pure JS, no Python dependency)
- **Feature engineering** — 7 derived features from amount + claims

### 📊 Dashboard
- **6 stat cards** — Total, Low, Medium, High risk, Anomalies, Avg Confidence
- **3 charts** — Claim Amount Timeline, Risk Distribution (pie), Confidence Score Distribution
- **Paginated case records** — 50 rows per page with risk badges, anomaly flags, confidence scores
- **Upload history** — clickable filenames load that upload's specific data on dashboard
- **Role-based views** — Admin gets full access; Analyst gets read-only dashboard

### 🛡️ SOC Event Log (Admin Only)
- **Live security feed** — every auth event, upload, and anomaly logged automatically
- **Severity levels** — CRITICAL / HIGH / MEDIUM / LOW / INFO
- **Event categories** — AUTH / UPLOAD / ANOMALY / SYSTEM
- **Triage workflow** — change event status: OPEN → INVESTIGATING → RESOLVED
- **Stats cards** — Critical count, High count, Open events, Last 24h activity

---

## 🗂️ Project Structure

```
insurance-fraud/
│
├── railway.json              ← Railway deployment config
├── nixpacks.toml             ← Build environment config
├── package.json              ← Root dependencies (for Railway)
├── .gitignore
│
├── backend/
│   ├── server.js             ← Express API, auth, ML pipeline, SOC logging
│   ├── predict_batch.js      ← Pure JS fraud prediction engine
│   ├── predict_batch.py      ← Python ML (local dev only)
│   ├── model.py              ← Scikit-learn model (local dev only)
│   └── package.json          ← Local dev dependencies
│
└── frontend/
    ├── index.html            ← Main dashboard (admin + analyst views)
    ├── login.html            ← 2-step login with 2FA OTP
    ├── register.html         ← Registration page
    └── auth.css              ← Auth page styles
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 20+
- MongoDB (local) or MongoDB Atlas URI
- Python 3.11+ with `pandas`, `scikit-learn`, `numpy`, `joblib` (optional — for local ML)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/insurance-fraud.git
cd insurance-fraud

# Install dependencies
npm install

# Set environment variables (create backend/.env)
MONGO_URI=mongodb://127.0.0.1:27017/fraudDB
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
EMAIL_USER=your-gmail@gmail.com      # optional — for real OTP emails
EMAIL_PASS=your-app-password         # optional

# Start MongoDB (Windows)
net start MongoDB

# Start server
node backend/server.js
```

Open `http://localhost:3000`

---

## 🔧 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `MONGO_URI` | MongoDB Atlas connection string | ✅ |
| `JWT_SECRET` | Secret key for signing JWT tokens | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ |
| `PORT` | Server port (Railway sets automatically) | ❌ |
| `EMAIL_USER` | Gmail address for OTP emails | ❌ |
| `EMAIL_PASS` | Gmail app password | ❌ |

> If `EMAIL_USER` is not set, OTP codes are printed to the server console (development mode).

---

## 📁 CSV Format

Your upload CSV must have these columns:

```csv
amount,claims
95000,3
450000,12
1800000,25
```

| Column | Description |
|---|---|
| `amount` | Claim amount in ₹ (INR) |
| `claims` | Number of claims submitted |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, Chart.js, Google Fonts |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT, bcryptjs, Google OAuth, Nodemailer |
| ML Engine | Pure JavaScript (rule-based + statistical) |
| Deployment | Railway (backend + frontend), MongoDB Atlas |
| Security | express-mongo-sanitize, XSS prevention, brute force protection |

---

## 🔮 Future Improvements

### 🤖 ML & Analytics
- [ ] **Retrain on uploaded data** — let the model learn from each new CSV uploaded
- [ ] **Trend analysis** — week-over-week fraud rate charts
- [ ] **Geo heatmap** — visualize fraud hotspots by region (requires location column)
- [ ] **Network graph** — visualize relationships between claimants
- [ ] **Export reports** — download fraud analysis as PDF

### 🔐 Security
- [ ] **Rate limiting** — block IPs after too many requests (express-rate-limit)
- [ ] **WebSocket live feed** — real-time SOC event stream without polling
- [ ] **SIEM integration** — forward events to real Wazuh/Splunk via webhook
- [ ] **IP geolocation** — show location of login attempts on SOC feed
- [ ] **2FA via authenticator app** — TOTP support (Google Authenticator)
- [ ] **Audit trail** — immutable log of every admin action

### 🎨 UI/UX
- [ ] **Dark/light mode toggle**
- [ ] **Mobile responsive layout**
- [ ] **Notification system** — real-time alerts for CRITICAL events
- [ ] **Upload drag-and-drop** — drag CSV directly onto dashboard
- [ ] **Dashboard customization** — rearrange cards and charts

### 🏗️ Infrastructure
- [ ] **Docker Compose** — local one-command setup
- [ ] **CI/CD pipeline** — auto-deploy on push via GitHub Actions
- [ ] **Redis caching** — cache frequent MongoDB queries
- [ ] **Multi-tenant** — separate data per organization

---

## 👥 Team

Built by a team of cybersecurity and big data students at **NIIT University** as a part of their capstone project.

| Role | Focus |Name|
|---|---|---|
| Big Data | ML model, data pipeline, batch prediction|KAVYA CHAWLA
| Cybersecurity | Auth security|UDIT PUNIA
| Cybersecurity | SOC logging, backend,deployment|NIRVAAN KATYAL
| Cybersecurity | FRONTEND               |MUSKAN
---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">

**Built with ⚡ for the SOC analyst community**

`// SYSTEM ACTIVE` `// THREAT INTELLIGENCE ONLINE` `// FRAUDSYS v1.0`

</div>
