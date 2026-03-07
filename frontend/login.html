<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script>
    (function() {
      var t = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', t);
    })();
  </script>
  <title>FraudSys — Login</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&family=Rajdhani:wght@400;600;700&display=swap');
    :root{--bg:#020d0a;--panel:#040f0c;--border:#0a2a1f;--cyan:#00ffc8;--red:#ff2d6b;--muted:#2a5a48;--text:#a0d4c0;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:var(--bg);font-family:'Rajdhani',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;}
    body::after{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,255,200,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,0.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;}
    body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);pointer-events:none;z-index:10;}
    .login-box{position:relative;z-index:20;width:440px;background:var(--panel);border:1px solid var(--border);padding:48px 40px;animation:fadein 0.6s ease;}
    @keyframes fadein{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .login-box::before{content:'';position:absolute;top:-1px;left:-1px;width:16px;height:16px;border-top:2px solid var(--cyan);border-left:2px solid var(--cyan);box-shadow:0 0 10px var(--cyan);}
    .login-box::after{content:'';position:absolute;bottom:-1px;right:-1px;width:16px;height:16px;border-bottom:2px solid var(--cyan);border-right:2px solid var(--cyan);box-shadow:0 0 10px var(--cyan);}
    .logo{font-family:'Orbitron',monospace;font-size:1.8rem;font-weight:900;color:var(--cyan);text-shadow:0 0 20px var(--cyan);letter-spacing:4px;margin-bottom:4px;}
    .logo-sub{font-family:'Share Tech Mono',monospace;font-size:0.65rem;color:var(--muted);letter-spacing:3px;margin-bottom:28px;}
    .step-indicator{font-family:'Share Tech Mono',monospace;font-size:0.58rem;color:var(--muted);letter-spacing:2px;margin-bottom:24px;display:flex;gap:8px;align-items:center;}
    .step{padding:3px 8px;border:1px solid var(--border);font-size:0.55rem;white-space:nowrap;}
    .step.active{border-color:var(--cyan);color:var(--cyan);}
    .step.done{border-color:var(--muted);color:var(--muted);text-decoration:line-through;}
    label{display:block;font-family:'Share Tech Mono',monospace;font-size:0.65rem;color:var(--muted);letter-spacing:2px;margin-bottom:6px;}
    input{width:100%;background:rgba(0,0,0,0.4);border:1px solid var(--border);color:var(--text);padding:11px 14px;font-family:'Share Tech Mono',monospace;font-size:0.8rem;letter-spacing:1px;outline:none;margin-bottom:20px;transition:border 0.2s;}
    input:focus{border-color:var(--cyan);box-shadow:0 0 0 1px rgba(0,255,200,0.2);}
    .otp-input{font-size:1.5rem;letter-spacing:12px;text-align:center;padding:16px;}
    .btn{width:100%;background:transparent;border:1px solid var(--cyan);color:var(--cyan);font-family:'Orbitron',monospace;font-size:0.75rem;font-weight:700;letter-spacing:3px;padding:12px;cursor:pointer;transition:all 0.2s;}
    .btn:hover{background:rgba(0,255,200,0.08);box-shadow:0 0 20px rgba(0,255,200,0.2);}
    .btn:disabled{opacity:0.4;cursor:not-allowed;}
    .divider{display:flex;align-items:center;gap:12px;margin:24px 0;}
    .divider-line{flex:1;height:1px;background:var(--border);}
    .divider-text{font-family:'Share Tech Mono',monospace;font-size:0.6rem;color:var(--muted);letter-spacing:2px;white-space:nowrap;}
    .btn-google{width:100%;background:rgba(0,0,0,0.3);border:1px solid var(--border);color:var(--text);font-family:'Rajdhani',sans-serif;font-size:0.9rem;font-weight:600;letter-spacing:1px;padding:11px 16px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;transition:all 0.2s;}
    .btn-google:hover{border-color:rgba(0,255,200,0.4);background:rgba(0,255,200,0.05);}
    .footer-link{text-align:center;margin-top:24px;font-family:'Share Tech Mono',monospace;font-size:0.65rem;color:var(--muted);letter-spacing:1px;}
    .footer-link a{color:var(--cyan);text-decoration:none;}
    .msg{font-family:'Share Tech Mono',monospace;font-size:0.7rem;letter-spacing:1px;margin-top:-12px;margin-bottom:16px;display:none;}
    .msg.error{color:var(--red);}
    .msg.success{color:var(--cyan);}
    .hint-box{font-family:'Share Tech Mono',monospace;font-size:0.62rem;color:var(--muted);text-align:center;margin-bottom:16px;line-height:1.8;padding:12px;border:1px solid var(--border);background:rgba(0,0,0,0.2);}
    .hint-box strong{color:var(--cyan);}
    .back-btn{background:none;border:none;color:var(--muted);font-family:'Share Tech Mono',monospace;font-size:0.62rem;cursor:pointer;text-decoration:underline;margin-top:10px;display:block;width:100%;text-align:center;}
    .back-btn:hover{color:var(--cyan);}
    .qr-wrapper{text-align:center;margin:12px 0;}
    .qr-wrapper img{border:2px solid var(--cyan);padding:8px;background:#fff;}
    .secret-box{font-family:'Share Tech Mono',monospace;font-size:0.58rem;color:var(--muted);word-break:break-all;padding:10px;border:1px solid var(--border);background:rgba(0,0,0,0.3);margin-bottom:16px;text-align:center;cursor:pointer;}
    .secret-box span{color:var(--cyan);}
    .mandatory-badge{display:inline-block;background:rgba(255,45,107,0.1);border:1px solid var(--red);color:var(--red);font-family:'Share Tech Mono',monospace;font-size:0.55rem;letter-spacing:2px;padding:3px 8px;margin-bottom:14px;}
    html[data-theme="light"]{--bg:#f0f4f2;--panel:#ffffff;--border:#c8ddd6;--cyan:#007a5e;--red:#d4003a;--muted:#7aaa96;--text:#2a5a48;}
    .theme-btn{position:fixed;top:16px;right:16px;z-index:999;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'Share Tech Mono',monospace;font-size:0.6rem;letter-spacing:1px;padding:6px 12px;cursor:pointer;transition:all 0.2s;}
    .theme-btn:hover{border-color:var(--cyan);color:var(--cyan);}
  </style>
</head>
<body>

<div id="g_id_onload"
  data-client_id="141579954551-r6q36pitk0e2ob17632bggvumtebhv02.apps.googleusercontent.com"
  data-callback="handleGoogleCredential"
  data-auto_prompt="false">
</div>

<div class="login-box">
  <div class="logo">FRAUDSYS</div>
  <div class="logo-sub">// THREAT INTELLIGENCE PLATFORM</div>

  <div class="step-indicator">
    <span class="step active" id="badge1">STEP 1: CREDENTIALS</span>
    <span style="color:var(--border)">→</span>
    <span class="step" id="badge2">STEP 2: AUTHENTICATOR</span>
  </div>

  <!-- STEP 1: Email + Password -->
  <div id="step1">
    <label>EMAIL ADDRESS</label>
    <input type="email" id="email" placeholder="operative@fraudsys.io" />
    <label>ACCESS CODE</label>
    <input type="password" id="password" placeholder="••••••••••••"
      onkeydown="if(event.key==='Enter') login()" />
    <div id="msg1" class="msg error"></div>
    <button class="btn" id="loginBtn" onclick="login()">⬡ AUTHENTICATE</button>
    <div class="divider">
      <div class="divider-line"></div>
      <div class="divider-text">OR CONTINUE WITH</div>
      <div class="divider-line"></div>
    </div>
    <button class="btn-google" onclick="google.accounts.id.prompt()">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      SIGN IN WITH GOOGLE
    </button>
    <div class="footer-link">NO ACCOUNT? <a href="register.html">REQUEST ACCESS</a></div>
  </div>

  <!-- STEP 2a: TOTP login (already set up) -->
  <div id="step2totp" style="display:none">
    <div class="hint-box">
      Open <strong>Google Authenticator</strong> and enter<br>
      the 6-digit code for<br>
      <strong id="totpLoginEmail"></strong>
    </div>
    <label>AUTHENTICATOR CODE</label>
    <input type="text" id="totpLoginInput" class="otp-input" placeholder="000000"
      maxlength="6" oninput="this.value=this.value.replace(/[^0-9]/g,'')"
      onkeydown="if(event.key==='Enter') verifyTOTPLogin()" />
    <div id="msgTOTPLogin" class="msg error"></div>
    <button class="btn" id="totpLoginBtn" onclick="verifyTOTPLogin()">⬡ VERIFY &amp; ENTER</button>
    <button class="back-btn" onclick="goBack()">← Back</button>
  </div>

  <!-- STEP 2b: First login — mandatory TOTP setup -->
  <div id="step2setup" style="display:none">
    <div class="mandatory-badge">⚠ MANDATORY — REQUIRED TO ACCESS SYSTEM</div>
    <div class="hint-box">
      All accounts must have <strong>Google Authenticator</strong> enabled.<br>
      Complete setup below to access the dashboard.
    </div>
    <div id="setupLoading" style="text-align:center;padding:16px;font-family:'Share Tech Mono',monospace;font-size:0.65rem;color:var(--muted)">
      // GENERATING QR CODE...
    </div>
    <div id="setupQR" style="display:none">
      <div style="font-family:'Share Tech Mono',monospace;font-size:0.58rem;color:var(--muted);margin-bottom:10px;line-height:1.9">
        1. Install <strong style="color:var(--cyan)">Google Authenticator</strong> on your phone<br>
        2. Tap <strong style="color:var(--cyan)">+</strong> → <strong style="color:var(--cyan)">Scan a QR code</strong><br>
        3. Enter the 6-digit code shown in the app
      </div>
      <div class="qr-wrapper">
        <img id="setupQRImg" src="" width="180" height="180" />
      </div>
      <div class="secret-box" onclick="copySecret()" title="Click to copy">
        Manual key: <span id="setupSecret"></span><br>
        <span style="font-size:0.5rem;opacity:0.6">click to copy</span>
      </div>
      <label>ENTER 6-DIGIT CODE TO CONFIRM</label>
      <input type="text" id="setupTOTPInput" class="otp-input" placeholder="000000"
        maxlength="6" oninput="this.value=this.value.replace(/[^0-9]/g,'')"
        onkeydown="if(event.key==='Enter') confirmSetup()" />
      <div id="msgSetup" class="msg error"></div>
      <button class="btn" id="setupConfirmBtn" onclick="confirmSetup()">✓ ACTIVATE &amp; ENTER DASHBOARD</button>
    </div>
  </div>

</div>

<button class="theme-btn" onclick="toggleTheme()" id="themeBtnLogin">☀ LIGHT</button>

<script>
  let pendingEmail = "";
  let pendingToken = "";

  function show(id) { document.getElementById(id).style.display = 'block'; }
  function hide(id) { document.getElementById(id).style.display = 'none'; }
  function markActive(id) { document.getElementById(id).className = 'step active'; }
  function markDone(id)   { document.getElementById(id).className = 'step done'; }
  function showMsg(id, txt) {
    const el = document.getElementById(id);
    el.textContent = txt; el.style.display = 'block'; el.className = 'msg error';
  }

  // STEP 1 — password
  async function login() {
    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn      = document.getElementById("loginBtn");
    if (!email || !password) { showMsg("msg1", "Fill in all fields ❌"); return; }
    btn.disabled = true; btn.textContent = "// AUTHENTICATING...";
    try {
      const res  = await fetch("/login", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (res.ok && data.requiresTOTP) {
        pendingEmail = email;
        showTOTPLogin(email);
      } else if (res.ok && data.requiresTOTPSetup) {
        pendingEmail = data.email;
        pendingToken = data.token;
        localStorage.setItem('_pendingRole', data.role);
        showTOTPSetup();
      } else {
        showMsg("msg1", data.error || "Login failed ❌");
        btn.disabled = false; btn.textContent = "⬡ AUTHENTICATE";
      }
    } catch(e) {
      showMsg("msg1", "Server error ❌");
      btn.disabled = false; btn.textContent = "⬡ AUTHENTICATE";
    }
  }

  // STEP 2a — verify TOTP code
  function showTOTPLogin(email) {
    hide('step1'); show('step2totp');
    markDone('badge1'); markActive('badge2');
    document.getElementById("totpLoginEmail").textContent = email;
    document.getElementById("totpLoginInput").focus();
  }

  async function verifyTOTPLogin() {
    const token = document.getElementById("totpLoginInput").value.trim();
    const btn   = document.getElementById("totpLoginBtn");
    if (token.length !== 6) { showMsg("msgTOTPLogin", "Enter 6-digit code ❌"); return; }
    btn.disabled = true; btn.textContent = "// VERIFYING...";
    try {
      const res  = await fetch("/verify-totp", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email: pendingEmail, token }) });
      const data = await res.json();
      if (res.ok) {
        finalizeLogin(data);
      } else {
        showMsg("msgTOTPLogin", data.error || "Invalid code ❌");
        btn.disabled = false; btn.textContent = "⬡ VERIFY & ENTER";
        document.getElementById("totpLoginInput").value = "";
        document.getElementById("totpLoginInput").focus();
      }
    } catch(e) {
      showMsg("msgTOTPLogin", "Server error ❌");
      btn.disabled = false; btn.textContent = "⬡ VERIFY & ENTER";
    }
  }

  // STEP 2b — mandatory first-time setup
  function showTOTPSetup() {
    hide('step1'); hide('step2totp'); show('step2setup');
    markDone('badge1'); markActive('badge2');
    document.getElementById('badge2').textContent = 'STEP 2: SETUP AUTHENTICATOR';
    loadSetupQR();
  }

  async function loadSetupQR() {
    try {
      const res  = await fetch("/setup-totp", {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization":"Bearer " + pendingToken },
        body: JSON.stringify({ email: pendingEmail })
      });
      const data = await res.json();
      document.getElementById("setupQRImg").src = data.qrCode;
      document.getElementById("setupSecret").textContent = data.secret;
      hide('setupLoading'); show('setupQR');
      document.getElementById("setupTOTPInput").focus();
    } catch(e) {
      document.getElementById("setupLoading").textContent = "// FAILED — REFRESH AND TRY AGAIN";
    }
  }

  async function confirmSetup() {
    const token = document.getElementById("setupTOTPInput").value.trim();
    const btn   = document.getElementById("setupConfirmBtn");
    if (token.length !== 6) { showMsg("msgSetup", "Enter 6-digit code ❌"); return; }
    btn.disabled = true; btn.textContent = "// ACTIVATING...";
    try {
      const res  = await fetch("/enable-totp", {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization":"Bearer " + pendingToken },
        body: JSON.stringify({ email: pendingEmail, token })
      });
      const data = await res.json();
      if (res.ok) {
        // Re-fetch full login data using the temp token
        finalizeLogin({ token: pendingToken, role: localStorage.getItem('_pendingRole'), email: pendingEmail, avatar: '', name: '' });
      } else {
        showMsg("msgSetup", data.error || "Invalid code — try again ❌");
        btn.disabled = false; btn.textContent = "✓ ACTIVATE & ENTER DASHBOARD";
        document.getElementById("setupTOTPInput").value = "";
        document.getElementById("setupTOTPInput").focus();
      }
    } catch(e) {
      showMsg("msgSetup", "Server error ❌");
      btn.disabled = false; btn.textContent = "✓ ACTIVATE & ENTER DASHBOARD";
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(document.getElementById("setupSecret").textContent)
      .then(() => alert("Secret key copied ✅"));
  }

  // Google login — also enforce TOTP setup
  async function handleGoogleCredential(response) {
    try {
      const res  = await fetch("/auth/google", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ credential: response.credential }) });
      const data = await res.json();
      if (res.ok) {
        pendingEmail = data.email;
        pendingToken = data.token;
        localStorage.setItem('_pendingRole', data.role);
        const sr = await fetch("/totp-status?email=" + encodeURIComponent(data.email));
        const sd = await sr.json();
        if (sd.totpEnabled) { finalizeLogin(data); } else { showTOTPSetup(); }
      } else {
        showMsg("msg1", data.error || "Google login failed ❌");
      }
    } catch(e) { showMsg("msg1", "Server error ❌"); }
  }

  function finalizeLogin(data) {
    localStorage.setItem("token",  data.token);
    localStorage.setItem("role",   data.role || localStorage.getItem('_pendingRole'));
    localStorage.setItem("email",  data.email);
    localStorage.setItem("avatar", data.avatar || "");
    localStorage.setItem("name",   data.name   || "");
    window.location.href = "index.html";
  }

  function goBack() {
    hide('step2totp'); show('step1');
    markActive('badge1');
    document.getElementById('badge2').className = 'step';
    document.getElementById('badge2').textContent = 'STEP 2: AUTHENTICATOR';
  }

  // Theme
  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
    document.getElementById('themeBtnLogin').textContent = isDark ? '☾ DARK' : '☀ LIGHT';
  }
  (function() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeBtnLogin');
    if (btn) btn.textContent = saved === 'light' ? '☾ DARK' : '☀ LIGHT';
  })();
</script>
</body>
</html>
