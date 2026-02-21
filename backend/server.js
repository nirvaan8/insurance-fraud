const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const uploadRoute = require("./routes/upload");
app.use("/api", uploadRoute);

app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});