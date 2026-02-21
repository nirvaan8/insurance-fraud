const { runMLModel } = require("../services/mlService");

exports.processFile = async (req, res) => {
  try {
    const filePath = req.file.path;

    const result = await runMLModel(filePath);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Processing failed" });
  }
};
