async function androidRequest(path, body = {}) {
  if (!window.AndroidAPI) {
    throw new Error("Android API is unavailable.");
  }

  const result = window.AndroidAPI.request(
    path,
    JSON.stringify(body)
  );

  return JSON.parse(result);
}

async function checkLogin() {
  try {
    const data = await androidRequest("/api/me");

    if (!data.success) {
      showLoggedOut();
      return false;
    }

    showLoggedIn();

    if (typeof loadWallet === "function") {
      await loadWallet();
    }

    if (typeof loadTransactions === "function") {
      await loadTransactions();
    }

    if (typeof loadWithdrawals === "function") {
      await loadWithdrawals();
    }

    return true;

  } catch (error) {
    console.error("Session check failed:", error);
    showLoggedOut();
    return false;
  }
}

function showLoggedIn() {
  const auth = document.querySelector("#auth");
  const app = document.querySelector("#appContent");

  if (auth) auth.style.display = "none";
  if (app) app.style.display = "block";
}

function showLoggedOut() {
  const auth = document.querySelector("#auth");
  const app = document.querySelector("#appContent");

  if (auth) auth.style.display = "block";
  if (app) app.style.display = "none";
}

async function registerUser() {
  const username =
    document.querySelector("#registerUsername").value.trim();

  const password =
    document.querySelector("#registerPassword").value;

  try {
    const data = await androidRequest(
      "/api/register",
      { username, password }
    );

    if (!data.success) {
      alert(data.error || "Registration failed.");
      return;
    }

    alert("Account created. You can now log in.");

  } catch (error) {
    console.error("Registration error:", error);
    alert("Unable to register.");
  }
}

async function loginUser() {
  const username =
    document.querySelector("#loginUsername").value.trim();

  const password =
    document.querySelector("#loginPassword").value;

  try {
    const data = await androidRequest(
      "/api/login",
      { username, password }
    );

    if (!data.success) {
      alert(data.error || "Login failed.");
      return;
    }

    showLoggedIn();

    if (typeof loadWallet === "function") {
      await loadWallet();
    }

    if (typeof loadTransactions === "function") {
      await loadTransactions();
    }

    if (typeof loadWithdrawals === "function") {
      await loadWithdrawals();
    }

    alert(`Welcome, ${data.username}!`);

  } catch (error) {
    console.error("Login error:", error);
    alert("Unable to connect to Android database.");
  }
}

async function logoutUser() {
  try {
    await androidRequest("/api/logout");
  } finally {
    showLoggedOut();
    location.reload();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
});
