const express        = require("express");
const cors           = require("cors");
const multer         = require("multer");
const mongoose       = require("mongoose");
const fs             = require("fs");
const bcrypt         = require("bcryptjs");
const path           = require("path");
const jwt            = require("jsonwebtoken");
const nodemailer     = require("nodemailer");
const mongoSanitize  = require("express-mongo-sanitize");
const { OAuth2Client } = require("google-auth-library");
const otplib         = require("otplib");
const authenticator  = otplib.authenticator;
const rateLimit      = require("express-rate-limit");
const QRCode         = require("qrcode");
const helmet         = require("helmet");

authenticator.options = { window: 1 };

const app = express();
app.set("trust proxy", 1);

/* ================= HELMET ================= */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://fonts.googleapis.com"],
      connectSrc:  ["'self'", "https://accounts.google.com", "https://apis.google.com", "https://www.google.com", "https://oauth2.googleapis.com"],
      frameSrc:    ["'self'", "https://accounts.google.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc:      ["'self'", "data:", "https:", "blob:"],
      objectSrc:   ["'none'"],
      workerSrc:   ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(express.json());

/* ================= RATE LIMITING ================= */
const globalLimiter = rateLimit({ windowMs: 15*60*1000, max: 200, message: { error: "Too many requests ❌" }, standardHeaders: true, legacyHeaders: false });
const authLimiter   = rateLimit({ windowMs: 15*60*1000, max: 20,  message: { error: "Too many login attempts ❌" } });
const uploadLimiter = rateLimit({ windowMs: 60*1000,    max: 10,  message: { error: "Rate limit exceeded ❌" } });
const aiLimiter     = rateLimit({ windowMs: 60*1000,    max: 20,  message: { error: "AI rate limit exceeded ❌" } });

app.use(globalLimiter);

/* ================= SECURITY MIDDLEWARE ================= */
app.use(mongoSanitize());
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

/* ================= JWT ================= */
const JWT_SECRET = process.env.JWT_SECRET || "fraudsys-super-secret-jwt-key-2024";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "8h";

function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

async function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token ❌" });
  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const blocked = await IPBlacklist.findOne({ ip });
  if (blocked) return res.status(403).json({ error: "IP blocked ❌" });
  const revoked = await RevokedToken.findOne({ token });
  if (revoked) return res.status(401).json({ error: "Session revoked ❌", expired: true });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req._token = token;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Session expired ❌", expired: true });
    return res.status(403).json({ error: "Invalid token ❌" });
  }
}

/* ================= EMAIL ================= */
const emailTransporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER || "", pass: process.env.EMAIL_PASS || "" } });

/* ================= GOOGLE OAUTH ================= */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "141579954551-r6q36pitk0e2ob17632bggvumtebhv02.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/* ================= MONGODB ================= */
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fraudDB";
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch(err => console.log("Mongo Error ❌:", err));

/* ================= MODELS ================= */
const UserSchema = new mongoose.Schema({
  email: String, password: String,
  role:         { type: String,  default: "analyst" },
  googleId: String, avatar: String,
  authProvider: { type: String,  default: "local" },
  failedLogins: { type: Number,  default: 0 },
  lockedUntil:  { type: Date,    default: null },
  lastLogin:    { type: Date,    default: null },
  pendingOTP:   { type: String,  default: null },
  otpExpiresAt: { type: Date,    default: null },
  totpSecret:   { type: String,  default: null },
  totpEnabled:  { type: Boolean, default: false }
});
const User = mongoose.model("User", UserSchema);

const ResultSchema = new mongoose.Schema({
  amount: Number, claims: Number, age: Number, policyDuration: Number,
  incidentType: String, witnesses: Number, policeReport: Boolean,
  premiumAmount: Number, vehicleAge: Number,
  location:     { type: String, default: "" },
  risk: String, confidence: Number, riskScore: Number,
  probabilities: { Low: Number, Medium: Number, High: Number },
  anomaly: { isAnomaly: Boolean, anomalyScore: Number },
  flags: [String],
  uploadId:   { type: mongoose.Schema.Types.ObjectId, ref: "UploadHistory", default: null },
  uploadedAt: { type: Date, default: Date.now }
});
const Result = mongoose.model("Result", ResultSchema);

const UploadHistorySchema = new mongoose.Schema({
  filename: String, totalRows: Number,
  highRisk: Number, mediumRisk: Number, lowRisk: Number,
  anomalies: Number, uploadedBy: String,
  uploadedAt: { type: Date, default: Date.now }
});
const UploadHistory = mongoose.model("UploadHistory", UploadHistorySchema);

const SecurityEventSchema = new mongoose.Schema({
  severity:  { type: String, enum: ["CRITICAL","HIGH","MEDIUM","LOW","INFO"], default: "INFO" },
  category:  { type: String, enum: ["AUTH","UPLOAD","ACCESS","SYSTEM","ANOMALY"], default: "SYSTEM" },
  title: String, description: String, actor: String, ip: String,
  metadata:  mongoose.Schema.Types.Mixed,
  status:    { type: String, enum: ["OPEN","INVESTIGATING","RESOLVED"], default: "OPEN" },
  timestamp: { type: Date, default: Date.now }
});
const SecurityEvent = mongoose.model("SecurityEvent", SecurityEventSchema);

const IPBlacklistSchema = new mongoose.Schema({
  ip: { type: String, unique: true }, reason: { type: String, default: "" },
  blockedBy: { type: String, default: "system" }, blockedAt: { type: Date, default: Date.now }
});
const IPBlacklist = mongoose.model("IPBlacklist", IPBlacklistSchema);

const RevokedTokenSchema = new mongoose.Schema({
  token: { type: String, unique: true }, email: String,
  revokedAt: { type: Date, default: Date.now, expires: 86400 }
});
const RevokedToken = mongoose.model("RevokedToken", RevokedTokenSchema);

const AuditSchema = new mongoose.Schema({
  actor: String, ip: String, action: String, target: String,
  before: mongoose.Schema.Types.Mixed, after: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});
AuditSchema.index({ timestamp: -1 });
const Audit = mongoose.model("Audit", AuditSchema);

/* ================= HELPERS ================= */
async function auditLog(actor, req, action, target, before = null, after = null) {
  try {
    const ip = req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown";
    await Audit.create({ actor, ip, action, target, before, after });
  } catch(e) { console.error("Audit error:", e.message); }
}

async function logEvent(severity, category, title, description, actor, req, metadata = {}) {
  try {
    const ip = req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown";
    await SecurityEvent.create({ severity, category, title, description, actor, ip, metadata });
    console.log(`[SOC][${severity}] ${title} — ${actor}`);
  } catch (err) { console.error("SOC log error:", err.message); }
}

const ipFailMap = {};
function trackFailedIP(ip) {
  const now = Date.now();
  if (!ipFailMap[ip]) ipFailMap[ip] = [];
  ipFailMap[ip] = ipFailMap[ip].filter(t => now - t < 60_000);
  ipFailMap[ip].push(now);
  return ipFailMap[ip].length;
}

/* ================= FILE UPLOAD ================= */
const upload = multer({ dest: "uploads/" });

/* ================= STATIC ================= */
app.get("/", (req, res) => res.redirect("/login.html"));
app.use(express.static(path.resolve(__dirname, "../frontend")));

/* ─────────────────────────────────────────────────────────────
   SOC AI ASSISTANT PROXY  — POST /api/chat  (FIXED: async)
───────────────────────────────────────────────────────────── */
app.post("/api/chat", aiLimiter, verifyToken, async (req, res) => {
  try {
    const { messages, systemContext } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: "Messages array required" });

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY)
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Render environment variables" });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system:     systemContext || "You are a SOC AI assistant for FraudSys. Be concise.",
        messages:   messages.slice(-20)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return res.status(502).json({ error: data.error?.message || "Anthropic API error" });
    }
    res.json({ reply: data.content?.[0]?.text || "No response." });
  } catch (err) {
    console.error("AI proxy error:", err.message);
    res.status(500).json({ error: "AI error: " + err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   GENERATE SYNTHETIC DATA  — POST /generate-data
   Data generated server-side, no external file needed
───────────────────────────────────────────────────────────── */
app.post("/generate-data", uploadLimiter, async (req, res) => {
  try {
    const count     = Math.min(parseInt(req.body.count) || 10000, 200000);
    const fraudRate = parseInt(req.body.fraudRate) || 30;
    const uploader  = req.body.uploadedBy || "admin";

    console.log(`[DATAGEN] Generating ${count.toLocaleString()} rows at ${fraudRate}% fraud...`);
    const start = Date.now();

    /* ── Inline generator — no external file needed ── */
    const cities    = ["Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Kolkata","Pune","Ahmedabad","Jaipur","Surat","Lucknow","Kanpur","Nagpur","Indore","Thane","Bhopal","Visakhapatnam","Patna","Vadodara","Ghaziabad","Ludhiana","Agra","Nashik","Faridabad","Meerut","Rajkot","Varanasi","Ranchi","Howrah","Coimbatore","Jabalpur","Gwalior","Vijayawada","Jodhpur","Madurai","Amritsar","Allahabad","Aurangabad","Dhanbad","Srinagar"];
    const incidents = ["collision","theft","fire","other"];
    const ri = (mn,mx) => Math.floor(Math.random()*(mx-mn+1))+mn;
    const rc = (arr)   => arr[Math.floor(Math.random()*arr.length)];

    const { predict } = require("./predict_batch.js");

    await Result.deleteMany({});

    const uploadRecord = await UploadHistory.create({
      filename:  `synthetic_${count}_fraud${fraudRate}pct.csv`,
      totalRows: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0, anomalies: 0, uploadedBy: uploader
    });
    const uploadId = uploadRecord._id;

    let high = 0, medium = 0, low = 0, anomalies = 0;
    const CHUNK = 5000;

    for (let i = 0; i < count; i += CHUNK) {
      const chunkSize = Math.min(CHUNK, count - i);
      const results   = [];

      for (let j = 0; j < chunkSize; j++) {
        const isFraud = Math.random() * 100 < fraudRate;
        const rec = isFraud ? {
          amount:         ri(800000, 2500000),
          claims:         ri(15, 35),
          age:            ri(22, 65),
          policyDuration: ri(1, 4),
          incidentType:   rc(incidents),
          witnesses:      ri(0, 1),
          policeReport:   Math.random() < 0.3,
          premiumAmount:  ri(8000, 25000),
          vehicleAge:     ri(0, 15),
          location:       rc(cities)
        } : {
          amount:         ri(50000, 600000),
          claims:         ri(1, 8),
          age:            ri(22, 65),
          policyDuration: ri(12, 60),
          incidentType:   rc(incidents),
          witnesses:      ri(2, 5),
          policeReport:   Math.random() < 0.85,
          premiumAmount:  ri(15000, 60000),
          vehicleAge:     ri(0, 15),
          location:       rc(cities)
        };

        const p = predict(rec);
        if      (p.risk === "High")   high++;
        else if (p.risk === "Medium") medium++;
        else                          low++;
        if (p.anomaly?.is_anomaly)    anomalies++;

        results.push({
          amount: p.amount, claims: p.claims, age: p.age,
          policyDuration: p.policyDuration, incidentType: p.incidentType,
          witnesses: p.witnesses, policeReport: p.policeReport,
          premiumAmount: p.premiumAmount, vehicleAge: p.vehicleAge,
          location: p.location || "", risk: p.risk, confidence: p.confidence,
          riskScore: p.risk_score, probabilities: p.probabilities,
          anomaly: { isAnomaly: p.anomaly.is_anomaly, anomalyScore: p.anomaly.anomaly_score },
          flags: p.flags || [], uploadId
        });
      }

      await Result.insertMany(results, { ordered: false, rawResult: false });
      if ((i + CHUNK) % 20000 === 0) console.log(`[DATAGEN] ${i + CHUNK}/${count} done`);
    }

    const totalRows = high + medium + low;
    const totalMs   = Date.now() - start;
    await UploadHistory.findByIdAndUpdate(uploadId, { totalRows, highRisk: high, mediumRisk: medium, lowRisk: low, anomalies });
    await logEvent("INFO", "UPLOAD", "Synthetic data generated",
      `${uploader} generated ${totalRows.toLocaleString()} rows (${fraudRate}% fraud)`,
      uploader, req, { count: totalRows, fraudRate, highRisk: high, anomalies, totalMs });

    console.log(`[DATAGEN] ✅ ${totalRows.toLocaleString()} rows in ${totalMs}ms`);
    res.json({
      message: `Generated ${totalRows.toLocaleString()} records in ${(totalMs/1000).toFixed(1)}s ✅`,
      stats: { high, medium, low, anomalies, totalRows }, uploadId,
      performance: { totalMs, rowsPerSec: Math.round(totalRows / (totalMs / 1000)) }
    });
  } catch (err) {
    console.error("Data generation error:", err);
    res.status(500).json({ error: "Generation failed ❌: " + err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   TOTP 2FA
───────────────────────────────────────────────────────────── */
app.post("/setup-totp", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const secret     = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, "FraudSys", secret);
    user.totpSecret  = secret;
    user.totpEnabled = false;
    await user.save();
    const qrDataURL = await QRCode.toDataURL(otpauthUrl);
    res.json({ secret, qrCode: qrDataURL, otpauth: otpauthUrl });
  } catch (err) { res.status(500).json({ error: "TOTP setup failed" }); }
});

app.post("/enable-totp", async (req, res) => {
  try {
    const { email, token } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.totpSecret) return res.status(400).json({ error: "TOTP not set up" });
    const valid = authenticator.verify({ token: token.replace(/\s/g, ""), secret: user.totpSecret });
    if (!valid) return res.status(400).json({ error: "Invalid code ❌" });
    user.totpEnabled = true;
    await user.save();
    await logEvent("INFO", "AUTH", "TOTP enabled", `${email} enabled 2FA`, email, req);
    res.json({ message: "Google Authenticator enabled ✅" });
  } catch (err) { res.status(500).json({ error: "Verification failed" }); }
});

app.post("/verify-totp", authLimiter, async (req, res) => {
  try {
    const { email, token } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.totpSecret || !user.totpEnabled)
      return res.status(400).json({ error: "TOTP not enabled" });
    const valid = authenticator.verify({ token: token.replace(/\s/g, ""), secret: user.totpSecret });
    if (!valid) {
      await logEvent("MEDIUM", "AUTH", "TOTP failed", `Invalid TOTP for ${email}`, email, req);
      return res.status(400).json({ error: "Invalid code ❌" });
    }
    user.lastLogin = new Date();
    user.failedLogins = 0;
    await user.save();
    const jwtToken = generateToken(user);
    await logEvent("INFO", "AUTH", "Login successful", `${email} logged in`, email, req, { role: user.role });
    await auditLog(email, req, "LOGIN", email, null, { method: "TOTP", role: user.role });
    res.json({ message: "Login successful ✅", token: jwtToken, role: user.role, email: user.email, expiresIn: JWT_EXPIRY });
  } catch (err) { res.status(500).json({ error: "Verification failed" }); }
});

app.post("/disable-totp", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    user.totpEnabled = false; user.totpSecret = null;
    await user.save();
    await logEvent("INFO", "AUTH", "TOTP disabled", `${email} disabled 2FA`, email, req);
    res.json({ message: "Google Authenticator disabled" });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get("/totp-status", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.query.email });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ totpEnabled: user.totpEnabled || false });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

/* ─────────────────────────────────────────────────────────────
   AUTH ROUTES
───────────────────────────────────────────────────────────── */
app.post("/register", async (req, res) => {
  const { email, password, role } = req.body;
  try {
    if (await User.findOne({ email })) return res.status(400).json({ error: "User already exists ❌" });
    await new User({ email, password: await bcrypt.hash(password, 10), role, authProvider: "local" }).save();
    await logEvent("INFO", "AUTH", "New user registered", `${email} as ${role}`, email, req, { role });
    res.json({ message: "Registered successfully ✅" });
  } catch (err) { res.status(500).json({ error: "Registration failed ❌" }); }
});

app.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const ip = req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown";
  try {
    const user = await User.findOne({ email });
    if (!user) {
      trackFailedIP(ip);
      await logEvent("MEDIUM", "AUTH", "Login failed — unknown user", email, email||"anon", req);
      return res.status(401).json({ error: "Invalid credentials ❌" });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await logEvent("HIGH", "AUTH", "Login on locked account", email, email, req);
      return res.status(403).json({ error: "Account locked. Try again in 15 minutes ❌" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60_000);
        await user.save();
        await logEvent("CRITICAL", "AUTH", "Account locked — brute force", `${email} locked`, email, req, { attempts: user.failedLogins });
        return res.status(403).json({ error: "Account locked after too many attempts ❌" });
      }
      await user.save();
      await logEvent("MEDIUM", "AUTH", "Failed login", `Wrong password for ${email}`, email, req, { attempts: user.failedLogins });
      return res.status(401).json({ error: "Invalid credentials ❌" });
    }
    if (user.totpEnabled && user.totpSecret) {
      await logEvent("INFO", "AUTH", "TOTP required", email, email, req);
      return res.json({ requiresTOTP: true, email });
    }
    await logEvent("INFO", "AUTH", "TOTP setup required", email, email, req);
    return res.json({ requiresTOTPSetup: true, email, token: generateToken(user), role: user.role });
  } catch (err) { res.status(500).json({ error: "Login error ❌" }); }
});

app.post("/auth/google", async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket  = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    const isNew = !user;
    if (!user) {
      user = new User({ email, googleId, avatar: picture, role: "analyst", authProvider: "google" });
    } else {
      user.googleId = googleId; user.avatar = picture; user.authProvider = "google"; user.lastLogin = new Date();
    }
    await user.save();
    await logEvent("INFO", "AUTH", isNew ? "New Google user" : "Google login", `${email} as ${user.role}`, email, req);
    res.json({ message: "Google login successful ✅", token: generateToken(user), role: user.role, email: user.email, name, avatar: picture, expiresIn: JWT_EXPIRY });
  } catch (err) {
    await logEvent("HIGH", "AUTH", "Google auth failure", err.message, "anonymous", req);
    res.status(401).json({ error: "Google authentication failed ❌" });
  }
});

app.post("/logout", async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (token) {
      const decoded = jwt.decode(token);
      await RevokedToken.create({ token, email: decoded?.email }).catch(() => {});
    }
    res.json({ message: "Logged out ✅" });
  } catch (err) { res.json({ message: "Logged out ✅" }); }
});

/* ─────────────────────────────────────────────────────────────
   SECURITY EVENTS
───────────────────────────────────────────────────────────── */
app.get("/security-events", async (req, res) => {
  try {
    const { severity, category, status, limit = 100 } = req.query;
    const filter = {};
    if (severity) filter.severity = severity;
    if (category) filter.category = category;
    if (status)   filter.status   = status;
    res.json(await SecurityEvent.find(filter).sort({ timestamp: -1 }).limit(parseInt(limit)));
  } catch (err) { res.status(500).json({ error: "Failed ❌" }); }
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
    const categories = await SecurityEvent.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
    res.json({ total, critical, high, open, last24h, categories });
  } catch (err) { res.status(500).json({ error: "Failed ❌" }); }
});

app.patch("/security-events/:id", async (req, res) => {
  try {
    res.json(await SecurityEvent.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }));
  } catch (err) { res.status(500).json({ error: "Failed ❌" }); }
});

/* ─────────────────────────────────────────────────────────────
   USERS & ADMIN
───────────────────────────────────────────────────────────── */
app.get("/users", async (req, res) => {
  try { res.json(await User.find({}, "email role authProvider avatar lastLogin failedLogins lockedUntil")); }
  catch (err) { res.status(500).json({ error: "Failed ❌" }); }
});

app.post("/unlock-account", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ error: "User not found ❌" });
    user.failedLogins = 0; user.lockedUntil = null;
    await user.save();
    await logEvent("INFO", "AUTH", "Account unlocked", req.body.email, "admin", req);
    res.json({ message: `${req.body.email} unlocked ✅` });
  } catch (err) { res.status(500).json({ error: "Failed ❌" }); }
});

/* ─────────────────────────────────────────────────────────────
   IP BLACKLIST
───────────────────────────────────────────────────────────── */
app.get("/ip-blacklist", verifyToken, async (req, res) => {
  try { res.json(await IPBlacklist.find().sort({ blockedAt: -1 })); }
  catch(e) { res.status(500).json({ error: "Failed" }); }
});
app.post("/ip-blacklist", verifyToken, async (req, res) => {
  try {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });
    await IPBlacklist.findOneAndUpdate({ ip }, { ip, reason, blockedBy: req.user.email, blockedAt: new Date() }, { upsert: true });
    await logEvent("HIGH", "ACCESS", "IP blocked", `${ip} — ${reason}`, req.user.email, req);
    await auditLog(req.user.email, req, "IP_BLOCK", ip, null, { reason });
    res.json({ message: "IP blocked ✅" });
  } catch(e) { res.status(500).json({ error: "Failed" }); }
});
app.delete("/ip-blacklist/:ip", verifyToken, async (req, res) => {
  try {
    const ip = decodeURIComponent(req.params.ip);
    await IPBlacklist.deleteOne({ ip });
    await logEvent("MEDIUM", "ACCESS", "IP unblocked", ip, req.user.email, req);
    await auditLog(req.user.email, req, "IP_UNBLOCK", ip);
    res.json({ message: "IP unblocked ✅" });
  } catch(e) { res.status(500).json({ error: "Failed" }); }
});

/* ─────────────────────────────────────────────────────────────
   AUDIT TRAIL
───────────────────────────────────────────────────────────── */
app.get("/audit-trail", verifyToken, async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 100;
    const action = req.query.action || null;
    res.json(await Audit.find(action ? { action } : {}).sort({ timestamp: -1 }).limit(limit));
  } catch(e) { res.status(500).json({ error: "Failed" }); }
});
app.get("/revoked-tokens", verifyToken, async (req, res) => {
  try { res.json(await RevokedToken.find().sort({ revokedAt: -1 }).limit(50)); }
  catch(e) { res.status(500).json({ error: "Failed" }); }
});

/* ─────────────────────────────────────────────────────────────
   GEO STATS
───────────────────────────────────────────────────────────── */
app.get("/geo-stats", async (req, res) => {
  try {
    const stats = await Result.aggregate([
      { $match: { location: { $ne: "", $exists: true } } },
      { $group: {
          _id: "$location",
          total:     { $sum: 1 },
          high:      { $sum: { $cond: [{ $eq: ["$risk","High"]   }, 1, 0] } },
          medium:    { $sum: { $cond: [{ $eq: ["$risk","Medium"] }, 1, 0] } },
          low:       { $sum: { $cond: [{ $eq: ["$risk","Low"]    }, 1, 0] } },
          anomalies: { $sum: { $cond: ["$anomaly.isAnomaly", 1, 0] } },
          avgScore:  { $avg: "$riskScore" }
      }},
      { $sort: { total: -1 } },
      { $limit: 200 }
    ]);
    res.json(stats);
  } catch(err) { res.status(500).json({ error: "Failed" }); }
});

/* ─────────────────────────────────────────────────────────────
   RESULTS & HISTORY
───────────────────────────────────────────────────────────── */
app.get("/results", async (req, res) => {
  try {
    const uploadId = req.query.uploadId;
    const query    = (uploadId && uploadId.match(/^[a-f\d]{24}$/i)) ? { uploadId } : {};
    const limit    = parseInt(req.query.limit) || 1000;
    res.json(await Result.find(query).sort({ uploadedAt: -1 }).limit(limit).lean());
  } catch (err) { res.status(500).json({ error: "Failed ❌" }); }
});

app.get("/upload-history", async (req, res) => {
  try { res.json(await UploadHistory.find().sort({ uploadedAt: -1 }).limit(20)); }
  catch (err) { res.status(500).json({ error: "Failed ❌" }); }
});

/* ─────────────────────────────────────────────────────────────
   CSV UPLOAD + ML
───────────────────────────────────────────────────────────── */
app.post("/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded ❌" });
  const uploader = req.body?.uploadedBy || req.user?.email || "admin";
  await logEvent("INFO", "UPLOAD", "CSV upload started", `${uploader}: ${req.file.originalname}`, uploader, req);
  try {
    const { predict } = require("./predict_batch.js");
    const csvData   = fs.readFileSync(req.file.path, "utf8");
    const csvLines  = csvData.trim().split("\n");
    const headers   = csvLines[0].toLowerCase().split(",").map(h => h.trim().replace(/[^a-z_]/g, ""));
    const idx       = (name) => headers.indexOf(name);
    if (idx("amount") === -1 || idx("claims") === -1)
      return res.status(400).json({ error: "CSV must have 'amount' and 'claims' columns ❌" });
    const dataLines = csvLines.slice(1).filter(l => l.trim());
    const CHUNK     = 5000;
    await Result.deleteMany({});
    const uploadRecord = await UploadHistory.create({
      filename: req.file.originalname, totalRows: 0,
      highRisk: 0, mediumRisk: 0, lowRisk: 0, anomalies: 0, uploadedBy: uploader
    });
    const uploadId = uploadRecord._id;
    let high = 0, medium = 0, low = 0, anomalies = 0, summaryRows = [];
    for (let i = 0; i < dataLines.length; i += CHUNK) {
      const results = dataLines.slice(i, i + CHUNK).map(line => {
        const cols      = line.split(",");
        const g         = (name) => cols[idx(name)] !== undefined ? cols[idx(name)].trim() : null;
        const policeRaw = g("police_report");
        const policeVal = policeRaw !== null ? (policeRaw.toLowerCase() === "yes" || policeRaw === "1" || policeRaw.toLowerCase() === "true") : true;
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
          location:       (g("location") || "").trim()
        });
        return {
          amount: p.amount, claims: p.claims, age: p.age,
          policyDuration: p.policyDuration, incidentType: p.incidentType,
          witnesses: p.witnesses, policeReport: p.policeReport,
          premiumAmount: p.premiumAmount, vehicleAge: p.vehicleAge,
          risk: p.risk, confidence: p.confidence, riskScore: p.risk_score,
          probabilities: p.probabilities,
          anomaly: { isAnomaly: p.anomaly.is_anomaly, anomalyScore: p.anomaly.anomaly_score },
          location: p.location || "", flags: p.flags || [], uploadId
        };
      });
      results.forEach(r => {
        if (r.risk === "High") high++;
        else if (r.risk === "Medium") medium++;
        else low++;
        if (r.anomaly?.isAnomaly) anomalies++;
      });
      await Result.insertMany(results, { ordered: false });
      if (summaryRows.length < 500) summaryRows = summaryRows.concat(results.slice(0, 500 - summaryRows.length));
    }
    const totalRows = high + medium + low;
    await UploadHistory.findByIdAndUpdate(uploadId, { totalRows, highRisk: high, mediumRisk: medium, lowRisk: low, anomalies });
    const highPct = totalRows ? (high / totalRows * 100) : 0;
    if (highPct >= 50) await logEvent("HIGH", "UPLOAD", "Suspicious upload", `${highPct.toFixed(1)}% high-risk`, uploader, req);
    else if (anomalies > 0) await logEvent("MEDIUM", "ANOMALY", "Anomalies detected", `${anomalies} records`, uploader, req);
    else await logEvent("INFO", "UPLOAD", "Upload complete", `${totalRows} rows`, uploader, req);
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.json(summaryRows);
  } catch (err) {
    console.error("Upload error:", err.message);
    await logEvent("HIGH", "UPLOAD", "Upload failed", err.message, uploader, req);
    res.status(500).json({ error: "ML processing failed ❌: " + err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   HEALTH CHECK
───────────────────────────────────────────────────────────── */
app.get("/health", (req, res) => {
  const s = mongoose.connection.readyState;
  res.status(s === 1 ? 200 : 503).json({
    status: s === 1 ? "ok" : "degraded",
    db: { 0:"disconnected",1:"connected",2:"connecting",3:"disconnecting" }[s] || "unknown",
    uptime: Math.floor(process.uptime()) + "s",
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
    timestamp: new Date().toISOString()
  });
});

/* ─────────────────────────────────────────────────────────────
   START
───────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FraudSys running on port ${PORT} 🚀`));
