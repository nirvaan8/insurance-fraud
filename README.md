# ⬡ FraudSys — Insurance Fraud Detection Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-46E3B7?style=for-the-badge&logo=render)](https://insurance-fraud-kgp9.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> A production-grade, full-stack insurance fraud detection platform featuring real-time ML scoring, SOC event monitoring, geo-fraud heatmaps, TOTP 2FA, synthetic data generation (100k rows in ~10s), and an AI-powered SOC assistant — built as a 4-person collaborative project.

---

## 👥 Team

| Member | Role | Responsibilities |
|---|---|---|
| **Kavya** | ML Engineer | Fraud detection engine, prediction logic, flag design, scoring algorithms |
| **Nirvaan** | Backend & DevOps | Express API, MongoDB, JWT auth, TOTP, Docker, Jenkins CI/CD, Render deployment |
| **Muskan** | Frontend | Dashboard UI, Chart.js visualizations, Leaflet heatmap, GSAP animations, Three.js |
| **Udit** | Cybersecurity | Rate limiting, IP blacklisting, audit trail, SOC events, XSS/NoSQL injection prevention |

---

## 🌐 Live Demo

**URL:** [https://insurance-fraud-kgp9.onrender.com](https://insurance-fraud-kgp9.onrender.com)

> ⚠️ Hosted on Render free tier — first load may take ~30 seconds to wake up from idle.

**Test Credentials:**

| Role | Email | Password |
|---|---|---|
| Admin | admin@fraudsys.com | admin123 |
| Analyst | analyst@fraudsys.com | analyst123 |

> Both accounts require Google Authenticator (TOTP) on first login.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Features](#-features)
- [Role-Based Access Control](#-role-based-access-control)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Local Setup](#-local-setup)
- [Docker](#-docker)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment-render)
- [Roadmap](#-roadmap)

---

## 🔍 Overview

FraudSys processes CSV datasets of insurance claims and classifies each record as **Low**, **Medium**, or **High** risk using a custom rule-based + statistical ML engine (`predict_batch.js`). It features a real-time SOC dashboard, India geo-fraud heatmap, ultra-fast synthetic data generation (100k rows in ~10 seconds), and an AI assistant powered by Claude.

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| MongoDB + Mongoose | Database & ODM |
| JWT (jsonwebtoken) | Stateless authentication (8h expiry) |
| bcryptjs | Password hashing (salt rounds = 10) |
| speakeasy + QRCode | TOTP 2FA (Google Authenticator) |
| helmet | HTTP security headers (CSP, HSTS, XSS) |
| express-rate-limit | Tiered rate limiting (global, auth, upload) |
| express-mongo-sanitize | NoSQL injection prevention |
| multer | CSV file upload handling |
| nodemailer | Email OTP delivery |
| google-auth-library | Google OAuth 2.0 |

### Frontend
| Technology | Purpose |
|---|---|
| Vanilla JS + HTML/CSS | Dashboard UI |
| Chart.js | Line, doughnut & bar charts |
| Leaflet.js + Leaflet.heat | Interactive India geo-fraud heatmap |
| Three.js | Particle background on login page |
| GSAP | Counter animations & UI transitions |
| Orbitron + Share Tech Mono | Cyberpunk terminal typography |

### DevOps & Infrastructure
| Technology | Purpose |
|---|---|
| Docker + docker-compose | Containerization |
| Jenkins | 8-stage CI/CD pipeline |
| Render | Cloud deployment (free tier) |
| MongoDB Atlas | Cloud database (M0 free tier) |

### AI
| Technology | Purpose |
|---|---|
| Anthropic Claude API | Floating SOC AI assistant |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────┐
│                  BROWSER CLIENT                   │
│  index.html │ Chart.js │ Leaflet │ Three.js │ GSAP│
└────────────────────┬─────────────────────────────┘
                     │ HTTPS
┌────────────────────▼─────────────────────────────┐
│             EXPRESS.JS REST API                   │
│                                                   │
│  helmet → cors → rate-limit → mongo-sanitize      │
│  → XSS-strip → verifyToken (JWT + IP check)       │
│                                                   │
│  Routes: /login /upload /generate-data /results   │
│          /geo-stats /security-events /audit-trail │
└──────────┬───────────────────┬────────────────────┘
           │                   │
┌──────────▼──────┐  ┌─────────▼──────────────────┐
│  MongoDB Atlas  │  │  predict_batch.js  (ML)     │
│  ─────────────  │  │  ─────────────────────────  │
│  Users          │  │  Rule-based scoring         │
│  Results        │  │  Statistical anomaly detect │
│  UploadHistory  │  │  10 fraud flag rules        │
│  SecurityEvents │  │  Ensemble risk score 0-100  │
│  AuditLogs      │  └────────────────────────────┘
│  IPBlacklist    │
│  RevokedTokens  │
└─────────────────┘
```

---

## ✨ Features

### ⚡ Ultra-Fast Synthetic Data Generation
- One-click generation of up to **200,000 rows** server-side
- No file upload needed — direct MongoDB bulk insert
- `POST /generate-data` → calls `fast_generator.js` → ML scores → DB insert
- **100k rows in ~10 seconds** (5,000-row bulk insert chunks)
- Configurable fraud rate (0–100%)
- Dashboard auto-refreshes after generation

### 🤖 ML Fraud Detection (`predict_batch.js` — Kavya)
Rule-based + statistical scoring engine processing CSV uploads in chunks of 5,000 rows.

**10 Fraud Flags:**

| Flag | Trigger |
|---|---|
| `EXTREME_AMOUNT` | Claim > ₹15,00,000 |
| `EXCESSIVE_CLAIMS` | Claims count > 20 |
| `HIGH_AMOUNT_HIGH_CLAIMS` | Both amount AND claims high simultaneously |
| `ABNORMAL_CLAIM_RATIO` | Amount/claims ratio is a statistical outlier |
| `PREMIUM_CLAIM_MISMATCH` | Claim > 20× annual premium |
| `NEW_POLICY_LARGE_CLAIM` | Large claim within 3 months of policy start |
| `NO_WITNESS_HIGH_CLAIM` | Zero witnesses on high-value claim |
| `NO_POLICE_REPORT` | No police report on large claim |
| `OLD_VEHICLE_HIGH_CLAIM` | Claim disproportionate to vehicle age |
| `YOUNG_DRIVER_HIGH_CLAIM` | Driver under 25 with large claim |

**Risk Classification:** Low (0–39) / Medium (40–69) / High (70–100)

### 🔐 Authentication & Security (Nirvaan + Udit)

**Multi-layer login flow:**
```
Password → bcrypt verify → Account lock check
       → TOTP enabled? → Google Authenticator code
       → Not set up?   → Mandatory TOTP setup
       → JWT issued (8h)
```

| Security Feature | Implementation |
|---|---|
| Password hashing | bcrypt, salt rounds = 10 |
| JWT auth | 8h expiry, revocation via MongoDB TTL |
| TOTP 2FA | speakeasy, Google Authenticator QR |
| Google OAuth | google-auth-library ID token verification |
| Brute force protection | 5 failures → 15 min account lock |
| IP blacklisting | Admin-managed, checked on every request |
| Rate limiting | 200/15min global, 20/15min auth, 5/min upload |
| NoSQL injection prevention | express-mongo-sanitize |
| XSS prevention | Custom middleware strips script tags |
| HTTP security headers | helmet (HSTS, X-Frame-Options, CSP) |
| JWT revocation | RevokedToken collection, auto-expires 24h |
| Audit trail | Every privileged action logged with actor + IP |

### 📊 SOC Dashboard (Muskan + Udit)
- Real-time stats: total cases, risk breakdown, anomalies, avg confidence
- Claim amount timeline (Chart.js line chart)
- Risk distribution doughnut chart
- Confidence score bar chart
- Case records table with risk badges and fraud flags
- SOC events log with severity levels (CRITICAL/HIGH/MEDIUM/LOW/INFO)
- Audit trail viewer
- IP blacklist management panel
- User management (admin only)

### 🗺 Geo Fraud Heatmap (Muskan)
- Dark CartoDB tile map of India via Leaflet.js
- `leaflet.heat` renders fraud intensity by city
- City markers with popups: total cases, high-risk count, fraud rate %, avg score
- 40+ Indian cities supported
- Accessible to **both Admin and Analyst** roles

### 🤖 AI SOC Assistant
- Floating chat panel powered by **Anthropic Claude**
- Injects live dashboard stats as context on every message
- Multi-turn conversation history (last 20 messages)
- Explains fraud flags, anomaly patterns, escalation guidance

---

## 👥 Role-Based Access Control

| Feature | Admin | Analyst |
|---|---|---|
| Dashboard (charts + cases) | ✅ | ✅ |
| Upload CSV | ✅ | ❌ |
| Generate synthetic data | ✅ | ❌ |
| Upload history | ✅ | ✅ |
| User management | ✅ | ❌ |
| SOC Events log | ✅ | ❌ |
| Audit trail | ✅ | ❌ |
| IP blacklist | ✅ | ❌ |
| Geo Fraud Heatmap | ✅ | ✅ |
| AI SOC Assistant | ✅ | ✅ |
| Account / TOTP settings | ✅ | ✅ |

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register new user |
| POST | `/login` | Step 1: password verify |
| POST | `/verify-totp` | Step 2: TOTP verify → JWT |
| POST | `/auth/google` | Google OAuth login |
| POST | `/setup-totp` | Generate TOTP secret + QR |
| POST | `/enable-totp` | Confirm and enable TOTP |
| POST | `/disable-totp` | Disable TOTP |
| GET  | `/totp-status` | TOTP status for user |
| POST | `/logout` | Revoke JWT |

### Data
| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload` | Upload CSV + ML scoring |
| POST | `/generate-data` | Generate synthetic dataset |
| GET  | `/results` | Paginated results |
| GET  | `/upload-history` | Upload records |
| GET  | `/geo-stats` | Fraud stats by city |

### Security (Admin)
| Method | Endpoint | Description |
|---|---|---|
| GET    | `/security-events` | SOC events (filterable) |
| PATCH  | `/security-events/:id` | Update event status |
| GET    | `/security-stats` | SOC summary stats |
| GET    | `/audit-trail` | Audit logs |
| GET    | `/ip-blacklist` | Blocked IPs |
| POST   | `/ip-blacklist` | Block an IP |
| DELETE | `/ip-blacklist/:ip` | Unblock an IP |
| GET    | `/users` | All users |
| POST   | `/unlock-account` | Unlock locked account |

### System
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | DB status, uptime, memory |

---

## 📁 Project Structure

```
insurance-fraud/
├── backend/
│   ├── server.js            # Main Express app (all routes + middleware)
│   ├── predict_batch.js     # ML fraud scoring engine (Kavya)
│   ├── fast_generator.js    # Synthetic data generator (100k rows/10s)
│   └── uploads/             # Temp CSV storage (auto-cleared)
├── frontend/
│   ├── index.html           # Main dashboard
│   ├── login.html           # Login + register
│   ├── totp-setup.html      # TOTP setup flow
│   └── style.css            # Global dark cyber theme
├── Dockerfile               # Docker build
├── docker-compose.yml       # Multi-container setup
├── Jenkinsfile              # 8-stage CI/CD pipeline
├── package.json
└── README.md
```

---

## 💻 Local Setup

```bash
# 1. Clone
git clone https://github.com/nirvaan8/insurance-fraud.git
cd insurance-fraud

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Fill in your values

# 4. Start
node backend/server.js

# 5. Open http://localhost:3000
```

---

## 🐳 Docker

```bash
# Build & run
docker build -t fraudsys .
docker run -p 3000:3000 --env-file .env fraudsys

# Or with docker-compose
docker-compose up --build
```

---

## 🔧 CI/CD Pipeline (Jenkins)

```
Stage 1: Checkout      → Clone from GitHub
Stage 2: Install       → npm install
Stage 3: Lint          → ESLint on server.js
Stage 4: Unit Tests    → Jest test suite
Stage 5: Docker Build  → docker build -t fraudsys .
Stage 6: Docker Push   → Push to Docker Hub (nirvaan8tk/fraudsys)
Stage 7: Health Check  → Verify /health returns 200
Stage 8: Deploy        → Trigger Render deploy hook
```

---

## 🔑 Environment Variables

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/fraudDB
JWT_SECRET=your-super-secret-64-char-key
JWT_EXPIRY=8h
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
ANTHROPIC_API_KEY=sk-ant-your-key
PORT=3000
NODE_ENV=production
```

---

## 🚀 Deployment (Render)

1. Connect `nirvaan8/insurance-fraud` repo to [render.com](https://render.com)
2. New Web Service → Docker runtime
3. Add all environment variables in Render dashboard
4. MongoDB Atlas: set Network Access to `0.0.0.0/0`
5. Hit **Create Web Service** → auto-deploys on every push to `main`

**Live URL:** `https://insurance-fraud-kgp9.onrender.com`

---

## 🗺 Roadmap

### ML (Kavya)
- [ ] K-Means clustering scatter plot visualization
- [ ] Analyst feedback loop (mark predictions correct/wrong)
- [ ] Ensemble scoring (rule-based + statistical + ML)
- [ ] Time-series fraud spike chart by hour/day/week

### Security (Udit)
- [ ] Anomaly alert threshold (admin-configurable %)
- [ ] Active session management panel
- [ ] SIEM integration (push events to Splunk / Elastic)

### Infrastructure (Nirvaan)
- [ ] Kubernetes manifests (replace Docker Compose)
- [ ] GitHub Actions parallel CI/CD
- [ ] Prometheus + Grafana metrics dashboard
- [ ] Redis caching for `/results` and `/geo-stats`

### Testing
- [ ] API integration tests (supertest)
- [ ] Load testing (k6 — 1000 concurrent uploads)
- [ ] Mutation testing on ML prediction logic

---

## 👤 Authors

**Kavya** · **Nirvaan Katyal** · **Muskan** · **Udit**

B.Tech Cybersecurity — NIIT University, Neemrana (2027)

[![GitHub](https://img.shields.io/badge/GitHub-nirvaan8-181717?style=flat-square&logo=github)](https://github.com/nirvaan8)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-nirvaan--katyal-0077B5?style=flat-square&logo=linkedin)](https://linkedin.com/in/nirvaan-katyal-a8571928a)

---

<div align="center"><sub>Built with ⬡ by Team FraudSys — NIIT University 2025–26</sub></div>
