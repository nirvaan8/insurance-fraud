const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// UPLOAD ROUTE
app.post("/upload", upload.single("file"), (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  let results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {

      let amount = Number(row.amount) || 0;
      let claims = Number(row.claims) || 0;

      let risk = "Low";
      if (amount > 70000 || claims > 2) risk = "High";
      else if (amount > 30000) risk = "Medium";

      results.push({ amount, claims, risk });
    })
    .on("end", () => {
      res.json(results);
    })
    .on("error", () => {
      res.status(500).json({ error: "Error processing file" });
    });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});