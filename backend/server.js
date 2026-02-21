const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const uploadRoute = require("./routes/upload");
app.use("/api", uploadRoute);
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

function downloadData() {
  const table = document.getElementById("resultTable").outerHTML;
  const blob = new Blob([table], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fraud_report.html";
  a.click();
}

function toggleTheme() {
  document.body.classList.toggle("light");
}
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});