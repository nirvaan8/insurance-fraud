const express   = require("express");
const cors      = require("cors");
const multer    = require("multer");
const mongoose  = require("mongoose");
const fs        = require("fs");
const csv       = require("csv-parser");
const { execSync } = require("child_process");
const bcrypt    = require("bcryptjs");
const path      = require("path");
const { OAuth2Client } = require("google-auth-library");

const app = express();
app.use(cors());
app.use(express.json());

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
  lastLogin:    { type: Date,   default: null }
});
const User = mongoose.model("User", UserSchema);

const ResultSchema = new mongoose.Schema({
  amount: Number, claims: Number, risk: String,
  confidence: Number, riskScore: Number,
  probabilities: { Low: Number, Medium: Number, High: Number },
  anomaly: { isAnomaly: Boolean, anomalyScore: Number },
  flags: [String],
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

/* LOGIN */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const ip = req?.socket?.remoteAddress || "unknown";
  try {
    const user = await User.findOne({ email });

    // Unknown email
    if (!user) {
      const attempts = trackFailedIP(ip);
      await logEvent("MEDIUM", "AUTH", "Login failed — unknown user",
        `Login attempt for non-existent account: ${email}`,
        email || "anonymous", req, { attempts_from_ip: attempts });
      return res.status(401).json({ error: "Invalid credentials ❌" });
    }

    // Account locked?
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await logEvent("HIGH", "AUTH", "Login attempt on locked account",
        `Locked account login attempt: ${email}`,
        email, req, { locked_until: user.lockedUntil });
      return res.status(403).json({ error: "Account locked. Try again in 15 minutes ❌" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      const attempts = trackFailedIP(ip);

      // Lock after 5 failed attempts
      if (user.failedLogins >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60_000);
        await user.save();
        await logEvent("CRITICAL", "AUTH", "Account locked — brute force detected",
          `Account ${email} locked after ${user.failedLogins} failed attempts`,
          email, req, { failed_attempts: user.failedLogins, ip_attempts: attempts });
        return res.status(403).json({ error: "Account locked after too many failed attempts ❌" });
      }

      // Warn on 3+ attempts
      if (user.failedLogins >= 3) {
        await logEvent("HIGH", "AUTH", "Multiple failed login attempts",
          `${user.failedLogins} failed attempts for ${email}`,
          email, req, { failed_attempts: user.failedLogins });
      } else {
        await logEvent("MEDIUM", "AUTH", "Failed login — wrong password",
          `Incorrect password for ${email}`,
          email, req, { failed_attempts: user.failedLogins });
      }

      await user.save();
      return res.status(401).json({ error: "Invalid credentials ❌" });
    }

    // Success — reset counters
    user.failedLogins = 0;
    user.lockedUntil  = null;
    user.lastLogin    = new Date();
    await user.save();
    await logEvent("INFO", "AUTH", "Successful login",
      `${email} logged in as ${user.role}`, email, req, { role: user.role, authProvider: "local" });

    res.json({ message: "Login successful ✅", role: user.role, email: user.email, avatar: user.avatar || null });
  } catch (err) {
    res.status(500).json({ error: "Login error ❌" });
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

    res.json({ message: "Google login successful ✅", role: user.role, email: user.email, name, avatar: picture });
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
    const users = await User.find({}, "email role authProvider avatar lastLogin failedLogins");
    res.json(users);
  } catch (err) { res.status(500).json({ error: "Failed to fetch users ❌" }); }
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
    // Run batch prediction — one Python call for ALL rows
    const scriptPath = path.join(__dirname, "predict_batch.py");
    const output = execSync(
      `python "${scriptPath}" "${req.file.path}"`,
      { cwd: __dirname, maxBuffer: 50 * 1024 * 1024, timeout: 120000 }
    ).toString().trim();

    const predictions = JSON.parse(output);

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
app.listen(3000, () => console.log("Server running on port 3000 🚀"));
