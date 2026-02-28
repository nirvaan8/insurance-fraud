async function upload() {
  console.log("UPLOAD CLICKED");

  // RBAC guard — only admin can upload
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

    // ===== UPDATE CARDS =====
    let low = 0, mid = 0, high = 0;
    data.forEach(item => {
      if (item.risk === "Low") low++;
      else if (item.risk === "Medium") mid++;
      else high++;
    });

    document.getElementById("totalCount").innerText = data.length;
    document.getElementById("lowCount").innerText = low;
    document.getElementById("midCount").innerText = mid;
    document.getElementById("highCount").innerText = high;

    // ===== UPDATE PIE CHART =====
    pieChart.data.datasets[0].data = [low, mid, high];
    pieChart.update();

    // ===== UPDATE LINE CHART =====
    lineChart.data.labels = data.map((_, i) => "C" + (i + 1));
    lineChart.data.datasets[0].data = data.map(d => d.amount);
    lineChart.update();

    // ===== UPDATE TABLE =====
    let table = document.querySelector("#dataTable tbody");
    table.innerHTML = "";
    data.forEach(item => {
      table.innerHTML += `
        <tr>
          <td>${item.amount}</td>
          <td>${item.claims}</td>
          <td style="color:${item.risk === "High" ? "red" : item.risk === "Medium" ? "orange" : "green"}">
            ${item.risk}
          </td>
        </tr>`;
    });

    alert("Upload Success ✅");

  } catch (err) {
    console.error("ERROR:", err);
    alert("Upload failed ❌");
  }
}