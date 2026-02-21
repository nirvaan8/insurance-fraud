const express = require("express");
const multer = require("multer");
const router = express.Router();
const { processFile } = require("../controllers/fraudController");

const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), processFile);

module.exports = router;