async function upload() {
  console.log("UPLOAD CLICKED");

  const role = localStorage.getItem("role");
  if (role !== "admin") {
    alert("Access Denied ❌ Only admins can upload.");
    return;
  }

  let file = document.getElementById("fileInput").files[0];
  if (!file) {
    alert("Select file first ❌");
    return;
  }

  let formData = new FormData();
  formData.append("file", file);

  try {
    let res = await fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formData
    });

    let data = await res.json();
    console.log("DATA:", data);

    // Reuse the same updateDashboard function from index.html
    updateDashboard(data);

    alert("Upload Success ✅");

  } catch (err) {
    console.error("ERROR:", err);
    alert("Upload failed ❌");
  }
}
