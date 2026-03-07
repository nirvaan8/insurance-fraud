# ⬡ FraudSys — Insurance Fraud Detection Platform

> **Anomaly Detection & Clustering for Insurance Fraud | NIIT University Cybersecurity Project**

[![Live Demo](https://img.shields.io/badge/LIVE-Railway-brightgreen?style=for-the-badge)](https://insurance-fraud-production.up.railway.app)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com/atlas)

---

## 📌 Overview

FraudSys is a full-stack insurance fraud detection platform that uses **rule-based ML**, **anomaly detection**, and **statistical analysis** to flag suspicious insurance claims in real time. Built as a cybersecurity capstone project, it features a production-grade SOC dashboard, role-based access control, JWT + 2FA authentication, and live deployment on Railway.

---

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** — 8-hour expiry with session countdown timer
- **2FA Email OTP** — 6-digit bcrypt-hashed codes, 5-minute expiry
- **Google OAuth** — via Google Sign-In (bypasses OTP)
- **Brute Force Protection** — 5 failed attempts → 15-minute account lockout
- **Account Unlock** — Admin can manually unlock accounts
- **NoSQL Injection Prevention** — via `express-mongo-sanitize`
- **XSS Prevention** — custom sanitization middleware
- **Role-based Access Control** — Admin vs Analyst permissions

### 📊 Dashboard & Analytics
- Live stat cards: Total Cases, High/Medium/Low Risk, Anomalies, Avg Confidence
- **Claim Amount Timeline** — line chart across all records
- **Risk Distribution** — pie/donut chart
- **Confidence Distribution** — bar chart
- Dark/Light mode toggle — persists via `localStorage`
- Mobile responsive with hamburger sidebar

### 🤖 ML Fraud Detection (Pure JavaScript)
- **9-parameter model** — Amount, Claims, Age, Policy Duration, Incident Type, Witnesses, Police Report, Premium Amount, Vehicle Age
- **10 fraud detection rules** — EXTREME_AMOUNT, EXCESSIVE_CLAIMS, HIGH_AMOUNT_HIGH_CLAIMS, ABNORMAL_CLAIM_RATIO, PREMIUM_CLAIM_MISMATCH, NEW_POLICY_LARGE_CLAIM, NO_WITNESS_HIGH_CLAIM, NO_POLICE_REPORT, OLD_VEHICLE_HIGH_CLAIM, YOUNG_DRIVER_HIGH_CLAIM
- Risk scoring engine (0–100) with weighted feature contributions
- Anomaly detection via statistical isolation scoring
- Three-tier classification: **High / Medium / Low**

### 🔍 Explainability Panel
- Click **🔍 EXPLAIN** on any case row
- Human-readable breakdown of every detection reason
- Risk score gauge, probability bars, input data summary
- Specific narrative per field: *"No police report on a ₹12L claim — legitimate claims almost always involve a report"*

### 📋 Fraud Pattern Report
- Auto-generates after every CSV upload
- **Threat assessment**: CRITICAL / HIGH / MEDIUM / LOW
- Risk distribution bar, statistical summary (mean, max, min, std dev)
- High-risk amount clusters
- Most triggered fraud rules with frequency bars
- Pattern insights with auto-generated narratives

### 🛡️ SOC Event Log
- Logs every auth event, upload, anomaly detection
- Severity levels: CRITICAL / HIGH / MEDIUM / LOW / INFO
- Triage workflow: OPEN → INVESTIGATING → RESOLVED
- SOC stats dashboard with counts by severity

### 👥 User Management (Admin)
- View all registered users with role badges
- Unlock locked accounts
- See last login timestamps

### 📁 Upload History
- Clickable upload history — click any filename to view that upload's results
- Per-upload stats: total rows, high/medium/low risk, anomalies

---

## 📁 File Structure

```
insurance-fraud/
├── package.json              ← root dependencies + start script (for Railway)
├── nixpacks.toml             ← Railway build config
├── railway.json              ← Railway deploy config
├── .env                      ← environment variables (never commit)
├── .gitignore
├── README.md
├── sample_data.csv           ← 15-row test CSV
├── backend/
│   ├── server.js             ← Express API: JWT, 2FA, Google OAuth, SOC, upload
│   ├── predict_batch.js      ← Pure JS ML engine (no Python needed)
│   └── package.json          ← backend dependencies (for local dev)
└── frontend/
    ├── index.html            ← main dashboard (admin + analyst)
    ├── login.html            ← 2-step OTP login + Google OAuth
    ├── register.html         ← registration + Google sign-up
    ├── register.js           ← registration logic
    ├── auth.css              ← login/register page styles
    └── style.css             ← dashboard styles (dark/light + mobile)
```

---

## 🚀 Run Locally

### Prerequisites
- [Node.js 20+](https://nodejs.org)
- [MongoDB Community](https://www.mongodb.com/try/download/community)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/insurance-fraud.git
cd insurance-fraud

# 2. Install dependencies
npm install

# 3. Start MongoDB (Windows)
net start MongoDB

# 4. Create .env file in root
MONGO_URI=mongodb://127.0.0.1:27017/fraudDB
JWT_SECRET=fraudsys-super-secret-2024
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
PORT=3000

# 5. Start the server
node backend/server.js

# 6. Open in browser
# http://localhost:3000
```

---

## ☁️ Deploy to Railway

### Environment Variables (set in Railway dashboard)
| Variable | Value |
|----------|-------|
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | Any long random string |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `NODE_ENV` | `production` |

### Railway Config
- **Builder**: Nixpacks
- **Start Command**: `node backend/server.js`
- Root `package.json` handles all dependencies

---

## 📊 CSV Format

Upload CSV files with these columns (`amount` and `claims` are required, rest are optional but recommended):

```csv
amount,claims,age,policy_duration,incident_type,witnesses,police_report,premium_amount,vehicle_age
1800000,25,22,2,fire,0,no,50000,18
45000,2,45,36,collision,2,yes,12000,4
```

| Column | Type | Description |
|--------|------|-------------|
| `amount` | Number | Claim amount in ₹ |
| `claims` | Number | Number of claims submitted |
| `age` | Number | Claimant age |
| `policy_duration` | Number | Policy age in months |
| `incident_type` | String | `collision` / `theft` / `fire` / `other` |
| `witnesses` | Number | Number of witnesses (0, 1, 2…) |
| `police_report` | String | `yes` / `no` |
| `premium_amount` | Number | Annual premium in ₹ |
| `vehicle_age` | Number | Vehicle age in years |

---

## 🔑 Role-Based Access

| Feature | Admin | Analyst |
|---------|:-----:|:-------:|
| Dashboard & Charts | ✅ | ✅ |
| Explain Panel | ✅ | ✅ |
| Upload History (view) | ✅ | ✅ |
| Upload CSV | ✅ | ❌ |
| Users & Unlock | ✅ | ❌ |
| SOC Event Log | ✅ | ❌ |

---

## 🧠 ML Model Details

The fraud detection engine (`predict_batch.js`) uses a weighted scoring system:

| Signal | Max Points |
|--------|-----------|
| Claim amount | 20 pts |
| Claims count | 15 pts |
| Anomaly pressure (ratio) | 10 pts |
| Incident type risk | 5 pts |
| Premium-claim mismatch | 8 pts |
| No police report | 6 pts |
| No witnesses | 5 pts |
| New policy | 5 pts |
| Old vehicle | 3 pts |
| Young driver | 3 pts |
| Rule flags (×4 each) | up to 20 pts |

**Thresholds**: Score ≥ 60 → High Risk | Score ≥ 30 → Medium Risk | Score < 30 → Low Risk

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT, bcryptjs, Google OAuth |
| ML Engine | Pure JavaScript (no Python) |
| Frontend | Vanilla HTML/CSS/JS, Chart.js |
| Deployment | Railway (cloud) |
| DB Hosting | MongoDB Atlas (AWS Mumbai) |

---

## 👥 Team

Built by cybersecurity students at **NIIT University** as a capstone project on *Insurance Fraud Detection via Anomaly Detection and Clustering*.
