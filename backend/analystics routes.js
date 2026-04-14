/* =================================================================
   ANALYTICS & REPORTING ROUTES
   Add these routes to server.js before the health check route
   Dependencies: npm install pdfkit
================================================================= */

const PDFDocument = require("pdfkit");

/* ─────────────────────────────────────────────────────────────
   1. PDF REPORT EXPORT
   GET /report/:uploadId  — generates full PDF for a single upload
───────────────────────────────────────────────────────────── */
app.get("/report/:uploadId", verifyToken, async (req, res) => {
  try {
    const { uploadId } = req.params;

    // Validate ObjectId
    if (!uploadId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ error: "Invalid upload ID ❌" });
    }

    // Fetch upload metadata + results in parallel
    const [upload, results] = await Promise.all([
      UploadHistory.findById(uploadId),
      Result.find({ uploadId }).lean()
    ]);

    if (!upload) return res.status(404).json({ error: "Upload not found ❌" });

    // ── Stats ──
    const total     = results.length;
    const high      = results.filter(r => r.risk === "High").length;
    const medium    = results.filter(r => r.risk === "Medium").length;
    const low       = results.filter(r => r.risk === "Low").length;
    const anomalies = results.filter(r => r.anomaly?.isAnomaly).length;
    const avgScore  = total ? (results.reduce((s, r) => s + (r.riskScore || 0), 0) / total).toFixed(2) : 0;
    const highPct   = total ? ((high / total) * 100).toFixed(1) : 0;

    // Top flags
    const flagCount = {};
    results.forEach(r => (r.flags || []).forEach(f => { flagCount[f] = (flagCount[f] || 0) + 1; }));
    const topFlags = Object.entries(flagCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Top locations by high risk
    const locMap = {};
    results.forEach(r => {
      if (!r.location) return;
      if (!locMap[r.location]) locMap[r.location] = { total: 0, high: 0 };
      locMap[r.location].total++;
      if (r.risk === "High") locMap[r.location].high++;
    });
    const topLocations = Object.entries(locMap)
      .sort((a, b) => b[1].high - a[1].high)
      .slice(0, 8);

    // ── Build PDF ──
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="fraudsys-report-${uploadId}.pdf"`);
    doc.pipe(res);

    const C = {
      bg:      "#020d0a",
      accent:  "#00ffc8",
      danger:  "#ff4444",
      warn:    "#ffaa00",
      safe:    "#00cc88",
      text:    "#e0f4ef",
      muted:   "#4a8a78",
      border:  "#0a3a28"
    };

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 100).fill("#020d0a");
    doc.fontSize(22).fillColor("#00ffc8").font("Helvetica-Bold")
       .text("FRAUDSYS", 50, 30);
    doc.fontSize(10).fillColor("#4a8a78").font("Helvetica")
       .text("FRAUD DETECTION & ANALYTICS PLATFORM", 50, 56);
    doc.fontSize(9).fillColor("#4a8a78")
       .text(`Report generated: ${new Date().toUTCString()}`, 50, 72);
    doc.fontSize(9).fillColor("#00ffc8")
       .text(`Upload: ${upload.filename}`, 300, 72, { align: "right" });

    // Divider
    doc.moveTo(50, 108).lineTo(doc.page.width - 50, 108).strokeColor("#0a3a28").lineWidth(1).stroke();

    // ── Upload Summary Box ──
    doc.y = 125;
    doc.rect(50, doc.y, doc.page.width - 100, 80).fill("#041a12");
    doc.fontSize(11).fillColor("#00ffc8").font("Helvetica-Bold")
       .text("UPLOAD SUMMARY", 65, doc.y + 12);

    const summaryY = doc.y + 30;
    const cols = [
      { label: "Total Records", value: total.toLocaleString(), color: "#e0f4ef" },
      { label: "High Risk",     value: `${high} (${highPct}%)`, color: "#ff4444" },
      { label: "Medium Risk",   value: medium.toLocaleString(), color: "#ffaa00" },
      { label: "Low Risk",      value: low.toLocaleString(),    color: "#00cc88" },
      { label: "Anomalies",     value: anomalies.toLocaleString(), color: "#ff8800" },
      { label: "Avg Risk Score",value: avgScore,                color: "#00ffc8" },
    ];
    const colW = (doc.page.width - 100) / cols.length;
    cols.forEach((c, i) => {
      const x = 50 + i * colW;
      doc.fontSize(16).fillColor(c.color).font("Helvetica-Bold").text(c.value, x, summaryY, { width: colW, align: "center" });
      doc.fontSize(8).fillColor("#4a8a78").font("Helvetica").text(c.label, x, summaryY + 22, { width: colW, align: "center" });
    });

    doc.y = 225;
    doc.moveDown(0.5);

    // ── Risk Distribution Bar ──
    doc.fontSize(11).fillColor("#00ffc8").font("Helvetica-Bold").text("RISK DISTRIBUTION", 50, doc.y);
    doc.moveDown(0.4);
    const barY   = doc.y;
    const barW   = doc.page.width - 100;
    const highW  = total ? (high   / total) * barW : 0;
    const medW   = total ? (medium / total) * barW : 0;
    const lowW   = total ? (low    / total) * barW : 0;
    doc.rect(50, barY, highW, 18).fill("#ff4444");
    doc.rect(50 + highW, barY, medW, 18).fill("#ffaa00");
    doc.rect(50 + highW + medW, barY, lowW, 18).fill("#00cc88");
    doc.fontSize(8).fillColor("#e0f4ef").font("Helvetica")
       .text(`HIGH ${highPct}%`, 55, barY + 4)
       .text(`MED ${total ? ((medium/total)*100).toFixed(1) : 0}%`, 50 + highW + 5, barY + 4)
       .text(`LOW ${total ? ((low/total)*100).toFixed(1) : 0}%`, 50 + highW + medW + 5, barY + 4);
    doc.moveDown(1.5);

    // ── Top Fraud Flags ──
    if (topFlags.length > 0) {
      doc.fontSize(11).fillColor("#00ffc8").font("Helvetica-Bold").text("TOP FRAUD INDICATORS", 50, doc.y);
      doc.moveDown(0.4);
      topFlags.forEach(([flag, count], i) => {
        const pct  = total ? ((count / total) * 100).toFixed(1) : 0;
        const fBarW = (count / (topFlags[0][1] || 1)) * (doc.page.width - 200);
        const rowY  = doc.y;
        doc.rect(50, rowY, doc.page.width - 100, 16).fill(i % 2 === 0 ? "#041a12" : "#020d0a");
        doc.rect(50, rowY, fBarW, 16).fill("#0a3a28");
        doc.fontSize(8).fillColor("#e0f4ef").font("Helvetica")
           .text(flag, 55, rowY + 4, { width: 260 });
        doc.fontSize(8).fillColor("#00ffc8").font("Helvetica-Bold")
           .text(`${count} (${pct}%)`, doc.page.width - 130, rowY + 4, { width: 80, align: "right" });
        doc.y = rowY + 16;
      });
      doc.moveDown(1);
    }

    // ── Top Locations ──
    if (topLocations.length > 0) {
      // New page if needed
      if (doc.y > 600) doc.addPage();
      doc.fontSize(11).fillColor("#00ffc8").font("Helvetica-Bold").text("TOP LOCATIONS BY HIGH-RISK CLAIMS", 50, doc.y);
      doc.moveDown(0.4);

      // Table header
      const tY = doc.y;
      doc.rect(50, tY, doc.page.width - 100, 18).fill("#0a3a28");
      doc.fontSize(8).fillColor("#00ffc8").font("Helvetica-Bold")
         .text("LOCATION", 55, tY + 5)
         .text("TOTAL", 280, tY + 5, { width: 80, align: "center" })
         .text("HIGH RISK", 360, tY + 5, { width: 80, align: "center" })
         .text("HIGH %", 440, tY + 5, { width: 80, align: "right" });
      doc.y = tY + 18;

      topLocations.forEach(([loc, data], i) => {
        const rowY2 = doc.y;
        doc.rect(50, rowY2, doc.page.width - 100, 16).fill(i % 2 === 0 ? "#041a12" : "#020d0a");
        const locPct = data.total ? ((data.high / data.total) * 100).toFixed(1) : 0;
        const hColor = parseFloat(locPct) >= 50 ? "#ff4444" : parseFloat(locPct) >= 25 ? "#ffaa00" : "#00cc88";
        doc.fontSize(8).fillColor("#e0f4ef").font("Helvetica")
           .text(loc, 55, rowY2 + 4, { width: 220 });
        doc.fontSize(8).fillColor("#e0f4ef")
           .text(data.total.toLocaleString(), 280, rowY2 + 4, { width: 80, align: "center" });
        doc.fontSize(8).fillColor("#ff4444")
           .text(data.high.toLocaleString(), 360, rowY2 + 4, { width: 80, align: "center" });
        doc.fontSize(8).fillColor(hColor).font("Helvetica-Bold")
           .text(`${locPct}%`, 440, rowY2 + 4, { width: 80, align: "right" });
        doc.y = rowY2 + 16;
      });
      doc.moveDown(1);
    }

    // ── High Risk Sample Records ──
    const highRiskSample = results.filter(r => r.risk === "High").slice(0, 15);
    if (highRiskSample.length > 0) {
      if (doc.y > 550) doc.addPage();
      doc.fontSize(11).fillColor("#00ffc8").font("Helvetica-Bold")
         .text(`HIGH-RISK RECORDS SAMPLE (top ${highRiskSample.length})`, 50, doc.y);
      doc.moveDown(0.4);

      // Header
      const hdrY = doc.y;
      doc.rect(50, hdrY, doc.page.width - 100, 18).fill("#0a3a28");
      doc.fontSize(7).fillColor("#00ffc8").font("Helvetica-Bold")
         .text("AMOUNT", 55, hdrY + 5)
         .text("CLAIMS", 130, hdrY + 5)
         .text("TYPE", 200, hdrY + 5)
         .text("SCORE", 310, hdrY + 5)
         .text("CONFIDENCE", 370, hdrY + 5)
         .text("LOCATION", 450, hdrY + 5);
      doc.y = hdrY + 18;

      highRiskSample.forEach((r, i) => {
        if (doc.y > 750) doc.addPage();
        const rY = doc.y;
        doc.rect(50, rY, doc.page.width - 100, 14).fill(i % 2 === 0 ? "#0a1a14" : "#020d0a");
        doc.fontSize(7).fillColor("#e0f4ef").font("Helvetica")
           .text(`₹${(r.amount || 0).toLocaleString()}`, 55, rY + 3)
           .text(r.claims || 0, 130, rY + 3)
           .text((r.incidentType || "—").substring(0, 14), 200, rY + 3)
           .text((r.riskScore || 0).toFixed(2), 310, rY + 3);
        doc.fontSize(7).fillColor("#ff4444").font("Helvetica-Bold")
           .text(`${((r.confidence || 0) * 100).toFixed(0)}%`, 370, rY + 3);
        doc.fontSize(7).fillColor("#4a8a78").font("Helvetica")
           .text((r.location || "—").substring(0, 18), 450, rY + 3);
        doc.y = rY + 14;
      });
    }

    // ── Footer ──
    const footerY = doc.page.height - 50;
    doc.moveTo(50, footerY - 10).lineTo(doc.page.width - 50, footerY - 10)
       .strokeColor("#0a3a28").lineWidth(1).stroke();
    doc.fontSize(8).fillColor("#4a8a78").font("Helvetica")
       .text("FRAUDSYS — Confidential Fraud Analysis Report", 50, footerY, { align: "center", width: doc.page.width - 100 });
    doc.fontSize(8).fillColor("#4a8a78")
       .text(`Generated by: ${req.user.email} | Upload ID: ${uploadId}`, 50, footerY + 12, { align: "center", width: doc.page.width - 100 });

    doc.end();

    await auditLog(req.user.email, req, "REPORT_EXPORT", uploadId, null, { filename: upload.filename, total });

  } catch (err) {
    console.error("PDF report error:", err.message);
    res.status(500).json({ error: "Failed to generate report ❌" });
  }
});

/* ─────────────────────────────────────────────────────────────
   2. COMPARATIVE ANALYSIS
   GET /compare?a=uploadId1&b=uploadId2
───────────────────────────────────────────────────────────── */
app.get("/compare", verifyToken, async (req, res) => {
  try {
    const { a, b } = req.query;

    if (!a || !b) return res.status(400).json({ error: "Two upload IDs required (a and b) ❌" });
    if (!a.match(/^[a-f\d]{24}$/i) || !b.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ error: "Invalid upload ID format ❌" });
    }

    // Fetch both uploads + results in parallel
    const [uploadA, uploadB, resultsA, resultsB] = await Promise.all([
      UploadHistory.findById(a),
      UploadHistory.findById(b),
      Result.find({ uploadId: a }).lean(),
      Result.find({ uploadId: b }).lean()
    ]);

    if (!uploadA || !uploadB) return res.status(404).json({ error: "One or both uploads not found ❌" });

    const summarize = (upload, results) => {
      const total     = results.length;
      const high      = results.filter(r => r.risk === "High").length;
      const medium    = results.filter(r => r.risk === "Medium").length;
      const low       = results.filter(r => r.risk === "Low").length;
      const anomalies = results.filter(r => r.anomaly?.isAnomaly).length;
      const avgScore  = total ? results.reduce((s, r) => s + (r.riskScore || 0), 0) / total : 0;
      const avgConf   = total ? results.reduce((s, r) => s + (r.confidence || 0), 0) / total : 0;

      // Flag frequency
      const flagCount = {};
      results.forEach(r => (r.flags || []).forEach(f => { flagCount[f] = (flagCount[f] || 0) + 1; }));
      const topFlags = Object.entries(flagCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([flag, count]) => ({ flag, count, pct: total ? +((count / total) * 100).toFixed(1) : 0 }));

      // Location breakdown
      const locMap = {};
      results.forEach(r => {
        if (!r.location) return;
        if (!locMap[r.location]) locMap[r.location] = { total: 0, high: 0 };
        locMap[r.location].total++;
        if (r.risk === "High") locMap[r.location].high++;
      });
      const topLocations = Object.entries(locMap)
        .sort((a, b) => b[1].high - a[1].high).slice(0, 5)
        .map(([location, data]) => ({ location, ...data, pct: data.total ? +((data.high / data.total) * 100).toFixed(1) : 0 }));

      // Incident type breakdown
      const incidentMap = {};
      results.forEach(r => {
        const t = r.incidentType || "unknown";
        if (!incidentMap[t]) incidentMap[t] = { total: 0, high: 0 };
        incidentMap[t].total++;
        if (r.risk === "High") incidentMap[t].high++;
      });
      const incidentBreakdown = Object.entries(incidentMap)
        .sort((a, b) => b[1].total - a[1].total).slice(0, 5)
        .map(([type, data]) => ({ type, ...data }));

      return {
        uploadId:   upload._id,
        filename:   upload.filename,
        uploadedBy: upload.uploadedBy,
        uploadedAt: upload.uploadedAt,
        total, high, medium, low, anomalies,
        highPct:    total ? +((high   / total) * 100).toFixed(1) : 0,
        mediumPct:  total ? +((medium / total) * 100).toFixed(1) : 0,
        lowPct:     total ? +((low    / total) * 100).toFixed(1) : 0,
        anomalyPct: total ? +((anomalies / total) * 100).toFixed(1) : 0,
        avgScore:   +avgScore.toFixed(3),
        avgConf:    +avgConf.toFixed(3),
        topFlags, topLocations, incidentBreakdown
      };
    };

    const summaryA = summarize(uploadA, resultsA);
    const summaryB = summarize(uploadB, resultsB);

    // Delta calculations
    const delta = {
      total:      summaryB.total      - summaryA.total,
      high:       summaryB.high       - summaryA.high,
      highPct:    +(summaryB.highPct  - summaryA.highPct).toFixed(1),
      medium:     summaryB.medium     - summaryA.medium,
      low:        summaryB.low        - summaryA.low,
      anomalies:  summaryB.anomalies  - summaryA.anomalies,
      avgScore:   +(summaryB.avgScore - summaryA.avgScore).toFixed(3),
      avgConf:    +(summaryB.avgConf  - summaryA.avgConf).toFixed(3),
    };

    // Verdict
    let verdict = "NEUTRAL";
    if (delta.highPct > 5)       verdict = "DETERIORATED";
    else if (delta.highPct < -5) verdict = "IMPROVED";
    else if (Math.abs(delta.highPct) <= 2) verdict = "STABLE";

    res.json({ a: summaryA, b: summaryB, delta, verdict });

    await auditLog(req.user.email, req, "COMPARE_ANALYSIS", `${a} vs ${b}`, null, { verdict });

  } catch (err) {
    console.error("Compare error:", err.message);
    res.status(500).json({ error: "Comparison failed ❌" });
  }
});