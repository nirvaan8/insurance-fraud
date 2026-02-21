const { spawn } = require("child_process");

exports.runMLModel = (filePath) => {
  return new Promise((resolve, reject) => {
    const process = spawn("python", ["../ml/model.py", filePath]);

    let data = "";

    process.stdout.on("data", (chunk) => {
      data += chunk.toString();
    });

    process.stderr.on("data", (err) => {
      console.error(err.toString());
    });

    process.on("close", () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject("Invalid JSON from ML");
      }
    });
  });
};