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
const speakeasy      = require("speakeasy");
const rateLimit      = require("express-rate-limit");
const QRCode         = require("qrcode");

const app = express();
app.set("trust proxy", 1); // Trust Railway/Docker/Nginx reverse proxy
app.use(cors());
app.use(express.json());

const PDFDocument = require("pdfkit");

/* ================= RATE LIMITING ================= */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: "Too many requests — slow down ❌" },
  standardHeaders: true, legacyHeaders: false
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter for auth endpoints
  message: { error: "Too many login attempts — try again later ❌" }
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // max 5 uploads per minute
  message: { error: "Upload rate limit exceeded ❌" }
});

app.use(globalLimiter);

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

async function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token — access denied ❌" });

  // Check IP blacklist
  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const blocked = await IPBlacklist.findOne({ ip });
  if (blocked) return res.status(403).json({ error: "Access denied — IP blocked ❌" });

  // Check token revocation
  const revoked = await RevokedToken.findOne({ token });
  if (revoked) return res.status(401).json({ error: "Session revoked — please login again ❌", expired: true });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req._token = token; // store for logout
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired — please login again ❌", expired: true });
    }
    return res.status(403).json({ error: "Invalid token ❌" });
  }
}

/* ================= EMAIL / OTP CONFIG ================= */
const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || ""
  }
});

const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(email, otp) {
  const hasEmail = process.env.EMAIL_USER && process.env.EMAIL_PASS;
  if (!hasEmail) {
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
  twoFAEnabled:  { type: Boolean, default: true },
  pendingOTP:    { type: String,  default: null },
  otpExpiresAt:  { type: Date,    default: null },
  totpSecret:    { type: String,  default: null },
  totpEnabled:   { type: Boolean, default: false }
});
const User = mongoose.model("User", UserSchema);

const ResultSchema = new mongoose.Schema({
  amount: Number, claims: Number,
  age: Number, policyDuration: Number,
  incidentType: String, witnesses: Number,
  policeReport: Boolean, premiumAmount: Number, vehicleAge: Number,
  location: { type: String, default: "" },
  risk: String, confidence: Number, riskScore: Number,
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
const SecurityEventSchema = new mongoose.Schema({
  severity:    { type: String, enum: ["CRITICAL","HIGH","MEDIUM","LOW","INFO"], default: "INFO" },
  category:    { type: String, enum: ["AUTH","UPLOAD","ACCESS","SYSTEM","ANOMALY"], default: "SYSTEM" },
  title:       String,
  description: String,
  actor:       String,
  ip:          String,
  metadata:    mongoose.Schema.Types.Mixed,
  status:      { type: String, enum: ["OPEN","INVESTIGATING","RESOLVED"], default: "OPEN" },
  timestamp:   { type: Date, default: Date.now }
});
const SecurityEvent = mongoose.model("SecurityEvent", SecurityEventSchema);

/* ================= IP BLACKLIST MODEL ================= */
const IPBlacklistSchema = new mongoose.Schema({
  ip:        { type: String, unique: true },
  reason:    { type: String, default: "" },
  blockedBy: { type: String, default: "system" },
  blockedAt: { type: Date, default: Date.now }
});
const IPBlacklist = mongoose.model("IPBlacklist", IPBlacklistSchema);

/* ================= TOKEN BLACKLIST (revoked JWTs) ================= */
const RevokedTokenSchema = new mongoose.Schema({
  token:     { type: String, unique: true },
  email:     String,
  revokedAt: { type: Date, default: Date.now, expires: 86400 }
});
const RevokedToken = mongoose.model("RevokedToken", RevokedTokenSchema);

/* ================= AUDIT TRAIL MODEL ================= */
const AuditSchema = new mongoose.Schema({
  actor:    String,
  ip:       String,
  action:   String,
  target:   String,
  before:   mongoose.Schema.Types.Mixed,
  after:    mongoose.Schema.Types.Mixed,
  timestamp:{ type: Date, default: Date.now }
});
AuditSchema.index({ timestamp: -1 });
const Audit = mongoose.model("Audit", AuditSchema);

async function auditLog(actor, req, action, target, before = null, after = null) {
  try {
    const ip = req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown";
    await Audit.create({ actor, ip, action, target, before, after });
  } catch(e) { console.error("Audit log error:", e.message); }
}

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
const ipFailMap = {};
function trackFailedIP(ip) {
  const now = Date.now();
  if (!ipFailMap[ip]) ipFailMap[ip] = [];
  ipFailMap[ip] = ipFailMap[ip].filter(t => now - t < 60_000);
  ipFailMap[ip].push(now);
  return ipFailMap[ip].length;
}

/* ================= TOTP 2FA ================= */

app.post("/setup-totp", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const secret = speakeasy.generateSecret({
      name: `FraudSys (${email})`,
      issuer: "FraudSys"
    });

    user.totpSecret  = secret.base32;
    user.totpEnabled = false;
    await user.save();

    const qrDataURL = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret:    secret.base32,
      qrCode:    qrDataURL,
      otpauth:   secret.otpauth_url
    });
  } catch (err) {
    console.error("TOTP setup error:", err);
    res.status(500).json({ error: "TOTP setup failed" });
  }
});

app.post("/enable-totp", async (req, res) => {
  try {
    const { email, token } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.totpSecret) return res.status(400).json({ error: "TOTP not set up" });

    const valid = speakeasy.totp.verify({
      secret:   user.totpSecret,
      encoding: "base32",
      token:    token.replace(/\s/g, ""),
      window:   1
    });

    if (!valid) return res.status(400).json({ error: "Invalid code — try again ❌" });

    user.totpEnabled = true;
    await user.save();
    await logEvent("INFO", "AUTH", "TOTP 2FA enabled", `${email} enabled Google Authenticator`, email, req);
    res.json({ message: "Google Authenticator enabled ✅" });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/verify-totp", authLimiter, async (req, res) => {
  try {
    const { email, token } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.totpSecret || !user.totpEnabled)
      return res.status(400).json({ error: "TOTP not enabled for this account" });

    const valid = speakeasy.totp.verify({
      secret:   user.totpSecret,
      encoding: "base32",
      token:    token.replace(/\s/g, ""),
      window:   1
    });

    if (!valid) {
      await logEvent("MEDIUM", "AUTH", "TOTP verification failed", `Invalid TOTP for ${email}`, email, req);
      return res.status(400).json({ error: "Invalid code ❌" });
    }

    user.lastLogin    = new Date();
    user.failedLogins = 0;
    await user.save();

    const jwtToken = generateToken(user);
    await logEvent("INFO", "AUTH", "TOTP login successful", `${email} authenticated via Google Authenticator`, email, req, { role: user.role });
    await auditLog(email, req, "LOGIN", email, null, { method: "TOTP", role: user.role });
    res.json({ message: "Login successful ✅", token: jwtToken, role: user.role, email: user.email, expiresIn: JWT_EXPIRY });
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/disable-totp", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    user.totpEnabled = false;
    user.totpSecret  = null;
    await user.save();
    await logEvent("INFO", "AUTH", "TOTP disabled", `${email} disabled Google Authenticator`, email, req);
    res.json({ message: "Google Authenticator disabled" });
  } catch (err) {
    res.status(500).json({ error: "Failed to disable TOTP" });
  }
});

app.get("/totp-status", async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ totpEnabled: user.totpEnabled || false });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

/* ================= FILE UPLOAD ================= */
const upload = multer({ dest: "uploads/" });

/* ================= ROOT ================= */
app.get("/", (req, res) => res.redirect("/login.html"));

/* ================= SERVE FRONTEND ================= */
app.use(express.static(path.resolve(__dirname, "../frontend")));

/* ─────────────────────────────────────────────────────────────
   AUTH ROUTES
───────────────────────────────────────────────────────────── */

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

app.post("/login", authLimiter, async (req, res) => {
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

    if (user.totpEnabled && user.totpSecret) {
      await logEvent("INFO", "AUTH", "TOTP required for login",
        `Password verified for ${email}, TOTP required`, email, req);
      return res.json({ requiresTOTP: true, email, message: "Enter your Google Authenticator code" });
    }

    const tempToken = generateToken(user);
    await logEvent("INFO", "AUTH", "First login — TOTP setup required",
      `Password verified for ${email}, redirecting to mandatory TOTP setup`, email, req);
    return res.json({ requiresTOTPSetup: true, email, token: tempToken, role: user.role, message: "Setup Google Authenticator to continue" });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login error ❌" });
  }
});

app.post("/verify-otp", authLimiter, async (req, res) => {
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
      user.googleId     = googleId;
      user.avatar       = picture;
      user.authProvider = "google";
      user.lastLogin    = new Date();
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
    const categories = await SecurityEvent.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    res.json({ total, critical, high, open, last24h, categories });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats ❌" });
  }
});

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

/* ================= IP BLACKLIST ================= */
app.get("/ip-blacklist", verifyToken, async (req, res) => {
  try {
    const list = await IPBlacklist.find().sort({ blockedAt: -1 });
    res.json(list);
  } catch(e) { res.status(500).json({ error: "Failed" }); }
});

app.post("/ip-blacklist", verifyToken, async (req, res) => {
  try {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });
    await IPBlacklist.findOneAndUpdate({ ip }, { ip, reason, blockedBy: req.user.email, blockedAt: new Date() }, { upsert: true });
    await logEvent("HIGH", "ACCESS", "IP blocked", `${req.user.email} blocked IP: ${ip} — ${reason}`, req.user.email, req);
    await auditLog(req.user.email, req, "IP_BLOCK", ip, null, { reason });
    res.json({ message: "IP blocked ✅" });
  } catch(e) { res.status(500).json({ error: "Failed to block IP" }); }
});

app.delete("/ip-blacklist/:ip", verifyToken, async (req, res) => {
  try {
    const ip = decodeURIComponent(req.params.ip);
    await IPBlacklist.deleteOne({ ip });
    await logEvent("MEDIUM", "ACCESS", "IP unblocked", `${req.user.email} unblocked IP: ${ip}`, req.user.email, req);
    await auditLog(req.user.email, req, "IP_UNBLOCK", ip);
    res.json({ message: "IP unblocked ✅" });
  } catch(e) { res.status(500).json({ error: "Failed" }); }
});

/* ================= AUDIT TRAIL ================= */
app.get("/audit-trail", verifyToken, async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 100;
    const action = req.query.action || null;
    const query  = action ? { action } : {};
    const logs   = await Audit.find(query).sort({ timestamp: -1 }).limit(limit);
    res.json(logs);
  } catch(e) { res.status(500).json({ error: "Failed" }); }
});

/* ================= REVOKED TOKENS (admin view) ================= */
app.get("/revoked-tokens", verifyToken, async (req, res) => {
  try {
    const tokens = await RevokedToken.find().sort({ revokedAt: -1 }).limit(50);
    res.json(tokens);
  } catch(e) { res.status(500).json({ error: "Failed" }); }
});

/* GEO STATS — fraud counts aggregated by location */
app.get("/geo-stats", async (req, res) => {
  try {
    const stats = await Result.aggregate([
      { $match: { location: { $ne: "", $exists: true } } },
      { $group: {
          _id: "$location",
          total:    { $sum: 1 },
          high:     { $sum: { $cond: [{ $eq: ["$risk","High"] },   1, 0] } },
          medium:   { $sum: { $cond: [{ $eq: ["$risk","Medium"] }, 1, 0] } },
          low:      { $sum: { $cond: [{ $eq: ["$risk","Low"] },    1, 0] } },
          anomalies:{ $sum: { $cond: ["$anomaly.isAnomaly", 1, 0] } },
          avgScore: { $avg: "$riskScore" }
      }},
      { $sort: { total: -1 } },
      { $limit: 200 }
    ]);
    res.json(stats);
  } catch(err) {
    console.error("Geo stats error:", err.message);
    res.status(500).json({ error: "Failed to fetch geo stats" });
  }
});

app.get("/results", async (req, res) => {
  try {
    const uploadId = req.query.uploadId;
    const query    = (uploadId && uploadId.match(/^[a-f\d]{24}$/i)) ? { uploadId } : {};
    const limit    = parseInt(req.query.limit) || 1000;
    const results  = await Result.find(query).sort({ uploadedAt: -1 }).limit(limit).lean();
    res.json(results);
  } catch (err) {
    console.error("Results fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch results ❌" });
  }
});

app.get("/upload-history", async (req, res) => {
  try {
    const history = await UploadHistory.find().sort({ uploadedAt: -1 }).limit(20);
    res.json(history);
  } catch (err) { res.status(500).json({ error: "Failed to fetch upload history ❌" }); }
});

/* UPLOAD + ML (batch prediction — fast) */
app.post("/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) {
    await logEvent("MEDIUM", "UPLOAD", "Upload attempt with no file",
      "Upload endpoint called without a file", req.body.uploadedBy || "unknown", req);
    return res.status(400).json({ error: "No file uploaded ❌" });
  }

  const uploader = (req.body && req.body.uploadedBy) ? req.body.uploadedBy : (req.user ? req.user.email : "admin");
  await logEvent("INFO", "UPLOAD", "CSV upload started",
    `${uploader} started uploading ${req.file.originalname}`,
    uploader, req, { filename: req.file.originalname, size: req.file.size });

  try {
    const { predict } = require("./predict_batch.js");
    const csvData  = fs.readFileSync(req.file.path, "utf8");
    const csvLines = csvData.trim().split("\n");
    const headers  = csvLines[0].toLowerCase().split(",").map(h => h.trim().replace(/[^a-z_]/g, ""));
    const idx      = (name) => headers.indexOf(name);

    if (idx("amount") === -1 || idx("claims") === -1) {
      return res.status(400).json({ error: "CSV must have 'amount' and 'claims' columns ❌" });
    }

    const dataLines = csvLines.slice(1).filter(l => l.trim());
    const CHUNK     = 2000;

    await Result.deleteMany({});

    const uploadRecord = await UploadHistory.create({
      filename: req.file.originalname || req.file.filename,
      totalRows: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0,
      anomalies: 0, uploadedBy: uploader
    });
    const currentUploadId = uploadRecord._id;

    let high = 0, medium = 0, low = 0, anomalies = 0;
    let summaryRows = [];

    for (let i = 0; i < dataLines.length; i += CHUNK) {
      const chunk   = dataLines.slice(i, i + CHUNK);
      const results = chunk.map(line => {
        const cols = line.split(",");
        const g    = (name) => cols[idx(name)] !== undefined ? cols[idx(name)].trim() : null;
        const policeRaw = g("police_report");
        const policeVal = policeRaw !== null
          ? (policeRaw.toLowerCase() === "yes" || policeRaw === "1" || policeRaw.toLowerCase() === "true")
          : true;
        const p = predict({
          amount:         parseFloat(g("amount"))          || 0,
          claims:         parseFloat(g("claims"))          || 0,
          age:            parseFloat(g("age"))             || 0,
          policyDuration: parseFloat(g("policy_duration")) || 0,
          incidentType:   g("incident_type")               || "unknown",
          witnesses:      g("witnesses") !== null ? parseInt(g("witnesses")) : 1,
          policeReport:   policeVal,
          premiumAmount:  parseFloat(g("premium_amount"))  || 0,
          vehicleAge:     parseFloat(g("vehicle_age"))     || 0,
          location:       (g("location") || "").trim(),
        });
        return {
          amount: p.amount, claims: p.claims, age: p.age,
          policyDuration: p.policyDuration, incidentType: p.incidentType,
          witnesses: p.witnesses, policeReport: p.policeReport,
          premiumAmount: p.premiumAmount, vehicleAge: p.vehicleAge,
          risk: p.risk, confidence: p.confidence, riskScore: p.risk_score,
          probabilities: p.probabilities,
          anomaly: { isAnomaly: p.anomaly.is_anomaly, anomalyScore: p.anomaly.anomaly_score },
          location:  p.location || "",
          flags: p.flags || [],
          uploadId: currentUploadId
        };
      });

      results.forEach(r => {
        if (r.risk === "High")   high++;
        else if (r.risk === "Medium") medium++;
        else low++;
        if (r.anomaly?.isAnomaly) anomalies++;
      });

      await Result.insertMany(results, { ordered: false });

      if (summaryRows.length < 500) {
        summaryRows = summaryRows.concat(results.slice(0, 500 - summaryRows.length));
      }
    }

    const totalRows = high + medium + low;

    await UploadHistory.findByIdAndUpdate(currentUploadId, {
      totalRows: totalRows, highRisk: high, mediumRisk: medium,
      lowRisk: low, anomalies
    });

    const highRatioPct = totalRows ? (high / totalRows) * 100 : 0;
    const isGenerated  = req.body.generated === 'true';
    const genParams    = isGenerated ? (() => { try { return JSON.parse(req.body.genParams||'{}'); } catch(e){return{};} })() : null;

    if (isGenerated) {
      const genSev = genParams.fraud >= 30 ? "HIGH" : "MEDIUM";
      await logEvent(genSev, "UPLOAD",
        `Synthetic dataset generated & uploaded`,
        `${uploader} generated ${totalRows.toLocaleString()} rows — fraud rate: ${genParams.fraud}%, profile: ${genParams.profile}, edge cases: ${genParams.addEdge}, high-risk found: ${high} (${highRatioPct.toFixed(1)}%)`,
        uploader, req, { generated: true, size: totalRows, fraudRate: genParams.fraud, profile: genParams.profile, highRisk: high, anomalies });
    } else if (highRatioPct >= 50) {
      await logEvent("HIGH", "UPLOAD", "Suspicious upload — high fraud ratio",
        `${uploader} uploaded ${req.file.originalname}: ${highRatioPct.toFixed(1)}% high-risk records (${high}/${totalRows})`,
        uploader, req, { filename: req.file.originalname, highRisk: high, total: totalRows });
    } else if (anomalies > 0) {
      await logEvent("MEDIUM", "ANOMALY", "Anomalies detected in upload",
        `${anomalies} anomalous records found in ${req.file.originalname}`,
        uploader, req, { anomalies, filename: req.file.originalname });
    } else {
      await logEvent("INFO", "UPLOAD", "Upload completed successfully",
        `${uploader} uploaded ${req.file.originalname}: ${totalRows} rows processed`,
        uploader, req, { filename: req.file.originalname, high, medium, low });
    }

    try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.json(summaryRows);
  } catch (err) {
    console.error("ML Batch Error:", err.message);
    console.error("Stack:", err.stack);
    await logEvent("HIGH", "UPLOAD", "ML batch processing failed",
      `Error: ${err.message}`, uploader, req);
    res.status(500).json({ error: "ML processing failed ❌: " + err.message });
  }
});

/* ================= HEALTH CHECK ================= */
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0:"disconnected", 1:"connected", 2:"connecting", 3:"disconnecting" }[dbState] || "unknown";
  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? "ok" : "degraded",
    db: dbStatus,
    uptime: Math.floor(process.uptime()) + "s",
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
    timestamp: new Date().toISOString()
  });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));