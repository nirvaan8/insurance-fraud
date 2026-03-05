// Railway: resolve modules from root node_modules
const Module = require('module');
Module.globalPaths.push(require('path').join(__dirname, '..', 'node_modules'));

const express        = require("express");
const cors           = require("cors");
const multer         = require("multer");
const mongoose       = require("mongoose");
const fs             = require("fs");
const csv            = require("csv-parser");
const { execSync }   = require("child_process");
const bcrypt         = require("bcryptjs");
const path           = require("path");
const jwt            = require("jsonwebtoken");
const nodemailer     = require("nodemailer");
const mongoSanitize  = require("express-mongo-sanitize");
const { OAuth2Client } = require("google-auth-library");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= SECURITY MIDDLEWARE ================= */
// Sanitize MongoDB queries — prevents NoSQL injection ($where, $gt attacks)
app.use(mongoSanitize());
// Strip dangerous characters from req.body strings (XSS prevention)
app.use((req, res, next) => {
  const sanitizeStr = (str) => typeof str === "string"
    ? str.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
         .replace(/<[^>]+>/g, "")
         .replace(/[<>'"]/g, c => ({ "<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]))
    : str;
  const sanitizeObj = (obj) => {
    if (typeof obj !== "object" || !obj) return obj;
    Object.keys(obj).forEach(k => {
      if (typeof obj[k] === "string") obj[k] = sanitizeStr(obj[k]);
      else if (typeof obj[k] === "object") sanitizeObj(obj[k]);
    });
    return obj;
  };
  if (req.body) sanitizeObj(req.body);
  next();
});

/* ================= JWT CONFIG ================= */
const JWT_SECRET  = process.env.JWT_SECRET  || "fraudsys-super-secret-jwt-key-2024";
const JWT_EXPIRY  = process.env.JWT_EXPIRY  || "8h"; // token expires in 8 hours

function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: "No token — access denied ❌" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired — please login again ❌", expired: true });
    }
    return res.status(403).json({ error: "Invalid token ❌" });
  }
}

/* ================= EMAIL / OTP CONFIG ================= */
// Uses Gmail. Set EMAIL_USER and EMAIL_PASS in .env
// For testing: use a Gmail app password (not your real password)
// If no email configured, OTP will be printed to console for testing
const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || ""
  }
});

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

async function sendOTP(email, otp) {
  const hasEmail = process.env.EMAIL_USER && process.env.EMAIL_PASS;
  if (!hasEmail) {
    // Development mode — print to console
    console.log(`\n[OTP DEBUG] Code for ${email}: ${otp}\n`);
    return;
  }
  await emailTransporter.sendMail({
    from: `"FraudSys Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "FraudSys — Your 2FA Login Code",
    html: `
      <div style="font-family:monospace;background:#020d0a;color:#00ffc8;padding:30px;border:1px solid #0a2a1f">
        <h2 style="letter-spacing:4px">FRAUDSYS // 2FA</h2>
        <p style="color:#a0d4c0">Your one-time login code:</p>
        <div style="font-size:2.5rem;font-weight:bold;letter-spacing:8px;color:#00ffc8;margin:20px 0">${otp}</div>
        <p style="color:#2a5a48;font-size:12px">Expires in 5 minutes. Do not share this code.</p>
      </div>`
  });
}

/* ================= GOOGLE OAUTH ================= */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
  "141579954551-r6q36pitk0e2ob17632bggvumtebhv02.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/* ================= MONGODB ================= */
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fraudDB";
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch(err => console.log("Mongo Error ❌:", err));

/* ================= MODELS ================= */

const UserSchema = new mongoose.Schema({
  email:        String,
  password:     String,
  role:         { type: String, default: "analyst" },
  googleId:     String,
  avatar:       String,
  authProvider: { type: String, default: "local" },
  failedLogins: { type: Number, default: 0 },
  lockedUntil:  { type: Date,   default: null },
  lastLogin:    { type: Date,   default: null },
  twoFAEnabled: { type: Boolean, default: true },
  pendingOTP:   { type: String,  default: null },
  otpExpiresAt: { type: Date,    default: null }
});
const User = mongoose.model("User", UserSchema);

const ResultSchema = new mongoose.Schema({
  amount: Number, claims: Number, risk: String,
  confidence: Number, riskScore: Number,
  probabilities: { Low: Number, Medium: Number, High: Number },
  anomaly: { isAnomaly: Boolean, anomalyScore: Number },
  flags: [String],
  uploadId: { type: mongoose.Schema.Types.ObjectId, ref: "UploadHistory", default: null },
  uploadedAt: { type: Date, default: Date.now }
});
const Result = mongoose.model("Result", ResultSchema);

const UploadHistorySchema = new mongoose.Schema({
  filename: String, totalRows: Number,
  highRisk: Number, mediumRisk: Number, lowRisk: Number,
  anomalies: Number,
  uploadedBy: String,
  uploadedAt: { type: Date, default: Date.now }
});
const UploadHistory = mongoose.model("UploadHistory", UploadHistorySchema);

/* ================= SECURITY EVENT MODEL ================= */
/*
  severity:  CRITICAL | HIGH | MEDIUM | LOW | INFO
  category:  AUTH | UPLOAD | ACCESS | SYSTEM | ANOMALY
  status:    OPEN | INVESTIGATING | RESOLVED
*/
const SecurityEventSchema = new mongoose.Schema({
  severity:    { type: String, enum: ["CRITICAL","HIGH","MEDIUM","LOW","INFO"], default: "INFO" },
  category:    { type: String, enum: ["AUTH","UPLOAD","ACCESS","SYSTEM","ANOMALY"], default: "SYSTEM" },
  title:       String,
  description: String,
  actor:       String,   // email or "anonymous"
  ip:          String,
  metadata:    mongoose.Schema.Types.Mixed,  // extra context
  status:      { type: String, enum: ["OPEN","INVESTIGATING","RESOLVED"], default: "OPEN" },
  timestamp:   { type: Date, default: Date.now }
});
const SecurityEvent = mongoose.model("SecurityEvent", SecurityEventSchema);

/* ================= SOC LOGGER (helper) ================= */
async function logEvent(severity, category, title, description, actor, req, metadata = {}) {
  try {
    const ip = req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown";
    await SecurityEvent.create({ severity, category, title, description, actor, ip, metadata });
    console.log(`[SOC][${severity}] ${title} — ${actor}`);
  } catch (err) {
    console.error("SOC log error:", err.message);
  }
}

/* ================= BRUTE FORCE TRACKER (in-memory) ================= */
// Tracks failed attempts per IP per minute
const ipFailMap = {};
function trackFailedIP(ip) {
  const now = Date.now();
  if (!ipFailMap[ip]) ipFailMap[ip] = [];
  ipFailMap[ip] = ipFailMap[ip].filter(t => now - t < 60_000); // keep last 60s
  ipFailMap[ip].push(now);
  return ipFailMap[ip].length;
}

/* ================= FILE UPLOAD ================= */
const upload = multer({ dest: "uploads/" });

/* ================= ROOT ================= */
app.get("/", (req, res) => res.redirect("/register.html"));

/* ================= SERVE FRONTEND ================= */
app.use(express.static(path.resolve(__dirname, "../frontend")));

/* ─────────────────────────────────────────────────────────────
   AUTH ROUTES
───────────────────────────────────────────────────────────── */

/* REGISTER */
app.post("/register", async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      await logEvent("LOW", "AUTH", "Registration attempt — email exists",
        `Someone tried to register with already-used email: ${email}`,
        email, req, { email });
      return res.status(400).json({ error: "User already exists ❌" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user   = new User({ email, password: hashed, role, authProvider: "local" });
    await user.save();
    await logEvent("INFO", "AUTH", "New user registered",
      `${email} registered as ${role}`, email, req, { role });
    res.json({ message: "Registered successfully ✅" });
  } catch (err) {
    res.status(500).json({ error: "Registration failed ❌" });
  }
});

/* LOGIN — Step 1: verify password, send OTP */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const ip = req?.socket?.remoteAddress || "unknown";
  try {
    const user = await User.findOne({ email });

    if (!user) {
      const attempts = trackFailedIP(ip);
      await logEvent("MEDIUM", "AUTH", "Login failed — unknown user",
        `Login attempt for non-existent account: ${email}`,
        email || "anonymous", req, { attempts_from_ip: attempts });
      return res.status(401).json({ error: "Invalid credentials ❌" });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await logEvent("HIGH", "AUTH", "Login attempt on locked account",
        `Locked account login attempt: ${email}`, email, req, { locked_until: user.lockedUntil });
      return res.status(403).json({ error: "Account locked. Try again in 15 minutes ❌" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      const attempts = trackFailedIP(ip);
      if (user.failedLogins >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60_000);
        await user.save();
        await logEvent("CRITICAL", "AUTH", "Account locked — brute force detected",
          `Account ${email} locked after ${user.failedLogins} failed attempts`,
          email, req, { failed_attempts: user.failedLogins, ip_attempts: attempts });
        return res.status(403).json({ error: "Account locked after too many failed attempts ❌" });
      }
      if (user.failedLogins >= 3) {
        await logEvent("HIGH", "AUTH", "Multiple failed login attempts",
          `${user.failedLogins} failed attempts for ${email}`, email, req, { failed_attempts: user.failedLogins });
      } else {
        await logEvent("MEDIUM", "AUTH", "Failed login — wrong password",
          `Incorrect password for ${email}`, email, req, { failed_attempts: user.failedLogins });
      }
      await user.save();
      return res.status(401).json({ error: "Invalid credentials ❌" });
    }

    // Password correct — generate and send OTP
    const otp = generateOTP();
    user.pendingOTP   = await bcrypt.hash(otp, 8); // store hashed OTP
    user.otpExpiresAt = new Date(Date.now() + 5 * 60_000); // 5 min expiry
    user.failedLogins = 0;
    user.lockedUntil  = null;
    await user.save();

    await sendOTP(email, otp);
    await logEvent("INFO", "AUTH", "OTP sent for 2FA",
      `Password verified for ${email}, OTP dispatched`, email, req);

    // Return partial — frontend must now submit OTP
    res.json({ requiresOTP: true, email, message: "OTP sent to your email ✅" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login error ❌" });
  }
});

/* LOGIN — Step 2: verify OTP, issue JWT */
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.pendingOTP) {
      return res.status(400).json({ error: "No OTP pending for this account ❌" });
    }
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      user.pendingOTP = null;
      await user.save();
      await logEvent("MEDIUM", "AUTH", "OTP expired",
        `Expired OTP used for ${email}`, email, req);
      return res.status(400).json({ error: "OTP expired — please login again ❌" });
    }
    const otpMatch = await bcrypt.compare(otp, user.pendingOTP);
    if (!otpMatch) {
      await logEvent("HIGH", "AUTH", "Invalid OTP attempt",
        `Wrong OTP entered for ${email}`, email, req);
      return res.status(401).json({ error: "Invalid OTP ❌" });
    }

    // OTP correct — clear it, issue JWT
    user.pendingOTP   = null;
    user.otpExpiresAt = null;
    user.lastLogin    = new Date();
    await user.save();

    const token = generateToken(user);
    await logEvent("INFO", "AUTH", "2FA login successful",
      `${email} completed 2FA and logged in as ${user.role}`, email, req, { role: user.role });

    res.json({
      message:  "Login successful ✅",
      token,
      role:     user.role,
      email:    user.email,
      avatar:   user.avatar || null,
      expiresIn: JWT_EXPIRY
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    res.status(500).json({ error: "OTP verification failed ❌" });
  }
});

/* GOOGLE LOGIN */
app.post("/auth/google", async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket  = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    const requestedRole = req.body.role || "analyst";

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    const isNew = !user;
    if (!user) {
      user = new User({ email, googleId, avatar: picture, role: requestedRole, authProvider: "google" });
    } else {
      user.googleId = googleId;
      user.avatar   = picture;
      user.authProvider = "google";
      user.role     = requestedRole;
      user.lastLogin = new Date();
    }
    await user.save();

    await logEvent("INFO", "AUTH",
      isNew ? "New Google user registered" : "Google login successful",
      `${email} authenticated via Google as ${user.role}`,
      email, req, { role: user.role, isNew, authProvider: "google" });

    const token = generateToken(user);
    res.json({ message: "Google login successful ✅", token, role: user.role, email: user.email, name, avatar: picture, expiresIn: JWT_EXPIRY });
  } catch (err) {
    console.error("Google Auth Error:", err.message);
    await logEvent("HIGH", "AUTH", "Google auth failure",
      `Google token verification failed: ${err.message}`, "anonymous", req);
    res.status(401).json({ error: "Google authentication failed ❌" });
  }
});

/* ─────────────────────────────────────────────────────────────
   SECURITY EVENTS API
───────────────────────────────────────────────────────────── */

/* GET events (admin SOC feed) */
app.get("/security-events", async (req, res) => {
  try {
    const { severity, category, status, limit = 100 } = req.query;
    const filter = {};
    if (severity) filter.severity = severity;
    if (category) filter.category = category;
    if (status)   filter.status   = status;
    const events = await SecurityEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events ❌" });
  }
});

/* GET security stats */
app.get("/security-stats", async (req, res) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60_000);
    const [total, critical, high, open, last24h] = await Promise.all([
      SecurityEvent.countDocuments(),
      SecurityEvent.countDocuments({ severity: "CRITICAL" }),
      SecurityEvent.countDocuments({ severity: "HIGH" }),
      SecurityEvent.countDocuments({ status: "OPEN" }),
      SecurityEvent.countDocuments({ timestamp: { $gte: since24h } })
    ]);
    // Category breakdown
    const categories = await SecurityEvent.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    res.json({ total, critical, high, open, last24h, categories });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats ❌" });
  }
});

/* UPDATE event status */
app.patch("/security-events/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const event = await SecurityEvent.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    );
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: "Failed to update event ❌" });
  }
});

/* ─────────────────────────────────────────────────────────────
   DATA ROUTES
───────────────────────────────────────────────────────────── */

app.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "email role authProvider avatar lastLogin failedLogins lockedUntil");
    res.json(users);
  } catch (err) { res.status(500).json({ error: "Failed to fetch users ❌" }); }
});

/* UNLOCK ACCOUNT */
app.post("/unlock-account", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found ❌" });
    user.failedLogins = 0;
    user.lockedUntil  = null;
    await user.save();
    await logEvent("INFO", "AUTH", "Account manually unlocked",
      `Admin unlocked account: ${email}`, "admin", req, { unlockedEmail: email });
    res.json({ message: `Account ${email} unlocked ✅` });
  } catch (err) {
    console.error("Unlock error:", err.message);
    res.status(500).json({ error: "Failed to unlock account ❌" });
  }
});

app.get("/results", async (req, res) => {
  try {
    const results = await Result.find().sort({ uploadedAt: -1 });
    res.json(results);
  } catch (err) { res.status(500).json({ error: "Failed to fetch results ❌" }); }
});

app.get("/upload-history", async (req, res) => {
  try {
    const history = await UploadHistory.find().sort({ uploadedAt: -1 }).limit(20);
    res.json(history);
  } catch (err) { res.status(500).json({ error: "Failed to fetch upload history ❌" }); }
});

/* UPLOAD + ML (batch prediction — fast) */
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    await logEvent("MEDIUM", "UPLOAD", "Upload attempt with no file",
      "Upload endpoint called without a file", req.body.uploadedBy || "unknown", req);
    return res.status(400).json({ error: "No file uploaded ❌" });
  }

  const uploader = req.body.uploadedBy || "admin";
  await logEvent("INFO", "UPLOAD", "CSV upload started",
    `${uploader} started uploading ${req.file.originalname}`,
    uploader, req, { filename: req.file.originalname, size: req.file.size });

  try {
    // Pure JS batch prediction — no Python needed
    const { predict } = require("./predict_batch.js");
    const csvData = fs.readFileSync(req.file.path, "utf8");
    const csvLines = csvData.trim().split("\n");
    const headers  = csvLines[0].toLowerCase().split(",").map(h => h.trim());
    const amtIdx   = headers.indexOf("amount");
    const clmIdx   = headers.indexOf("claims");

    if (amtIdx === -1 || clmIdx === -1) {
      return res.status(400).json({ error: "CSV must have 'amount' and 'claims' columns ❌" });
    }

    const predictions = csvLines.slice(1)
      .filter(l => l.trim())
      .map(line => {
        const cols   = line.split(",");
        const amount = parseFloat(cols[amtIdx]) || 0;
        const claims = parseFloat(cols[clmIdx]) || 0;
        return predict(amount, claims);
      });

    const results = predictions.map(p => ({
      amount:        p.amount,
      claims:        p.claims,
      risk:          p.risk,
      confidence:    p.confidence,
      riskScore:     p.risk_score,
      probabilities: p.probabilities,
      anomaly:       { isAnomaly: p.anomaly.is_anomaly, anomalyScore: p.anomaly.anomaly_score },
      flags:         p.flags || []
    }));


    await Result.deleteMany({});
    await Result.insertMany(results);

    const high      = results.filter(r => r.risk === "High").length;
    const medium    = results.filter(r => r.risk === "Medium").length;
    const low       = results.filter(r => r.risk === "Low").length;
    const anomalies = results.filter(r => r.anomaly?.isAnomaly).length;

    await UploadHistory.create({
      filename: req.file.originalname || req.file.filename,
      totalRows: results.length, highRisk: high, mediumRisk: medium, lowRisk: low,
      anomalies, uploadedBy: uploader
    });

    const highRatioPct = results.length ? (high / results.length) * 100 : 0;
    if (highRatioPct >= 50) {
      await logEvent("HIGH", "UPLOAD", "Suspicious upload — high fraud ratio",
        `${uploader} uploaded ${req.file.originalname}: ${highRatioPct.toFixed(1)}% high-risk records (${high}/${results.length})`,
        uploader, req, { filename: req.file.originalname, highRisk: high, total: results.length });
    } else if (anomalies > 0) {
      await logEvent("MEDIUM", "ANOMALY", "Anomalies detected in upload",
        `${anomalies} anomalous records found in ${req.file.originalname}`,
        uploader, req, { anomalies, filename: req.file.originalname });
    } else {
      await logEvent("INFO", "UPLOAD", "Upload completed successfully",
        `${uploader} uploaded ${req.file.originalname}: ${results.length} rows processed`,
        uploader, req, { filename: req.file.originalname, high, medium, low });
    }

    res.json(results);
  } catch (err) {
    console.error("ML Batch Error:", err.message);
    await logEvent("HIGH", "UPLOAD", "ML batch processing failed",
      `Error: ${err.message}`, uploader, req);
    res.status(500).json({ error: "ML processing failed ❌: " + err.message });
  }
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
