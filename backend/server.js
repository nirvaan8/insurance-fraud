const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const { execSync } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= MONGODB ================= */
mongoose.connect("mongodb://mongo:27017/fraudDB")
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log(err));

/* ================= USER MODEL ================= */
const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: String
});

const User = mongoose.model("User", UserSchema);

/* ================= FILE UPLOAD ================= */
const upload = multer({ dest: "uploads/" });

/* ================= TEST ROUTE ================= */
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

/* ================= REGISTER ================= */
app.post("/register", async (req, res) => {
  const { email, password, role } = req.body;

  console.log("Incoming Data:", email, password, role); // 👈 ADD THIS

  try {
    const existing = await User.findOne({ email });

    if (existing) {
      console.log("User already exists");
      return res.status(400).json({ error: "User already exists ❌" });
    }

    const user = new User({ email, password, role });

    await user.save();
    console.log("User saved in DB ✅"); // 👈 ADD THIS

    res.json({ message: "Registered successfully ✅" });

  } catch (err) {
    console.log("ERROR:", err); // 👈 ADD THIS
    res.status(500).json({ error: "Registration failed ❌" });
  }
});

/* ================= LOGIN ================= */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, password });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials ❌" });
    }

    res.json({
      message: "Login successful ✅",
      role: user.role
    });

  } catch (err) {
    res.status(500).json({ error: "Login error ❌" });
  }
});

/* ================= ML UPLOAD ================= */
app.post("/upload", upload.single("file"), (req, res) => {

  let results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {

      let amount = Number(row.amount);
      let claims = Number(row.claims);

      try {
        let output = execSync(`python3 model.py ${amount} ${claims}`)
          .toString()
          .trim();

        results.push({ amount, claims, risk: output });

      } catch (err) {
        console.error(err);
      }

    })
    .on("end", () => {
      res.json(results);
    });

});


/* ================= START ================= */
app.listen(3000, () => {
  console.log("Server running on port 3000 🚀");
});