async function login() {

  console.log("Login clicked");

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Please fill all fields ❌");
    return;
  }

  try {
    console.log("Sending request...");

    const res = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    console.log("Response:", data);

    if (res.ok) {
      localStorage.setItem("role", data.role);
      alert("Login Successful ✅");
      window.location.href = "index.html";
    } else {
      alert(data.error || "Login failed ❌");
    }

  } catch (err) {
    console.error("ERROR:", err);
    alert("Server error ❌");
  }
}
