async function register() {

  console.log("Calling API..."); // ✅ INSIDE FUNCTION

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  if (!email || !password) {
    alert("Please fill all fields ❌");
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password, role })
    });

    const data = await res.json();

    console.log("Response:", data); // ✅ ADD THIS

    if (res.ok) {
      alert("Registered Successfully ✅");
      window.location.href = "login.html";
    } else {
      alert(data.error || "Registration failed ❌");
    }

  } catch (err) {
    console.error(err);
    alert("Server error ❌");
  }
}