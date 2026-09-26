var API_BASE_URL =
  window.SKR_API_BASE_URL ||
  "https://skr-earning-app.onrender.com";

async function androidFetch(path, options = {}) {
  const url = API_BASE_URL + path;
  let fetchOptions = {
    method: options.method || "GET",
    headers: {
      ...(options.headers || {})
    },
    credentials: "include"
  };

  if (options.body !== undefined) {
    fetchOptions.body =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

    fetchOptions.headers["Content-Type"] =
      "application/json";
  }

  if (window.AndroidAPI) {
    const body = fetchOptions.body || "{}";

    const raw = window.AndroidAPI.request(path, body);
    const data = typeof raw === "string"
      ? JSON.parse(raw)
      : raw;

    return {
      ok: !data.error,
      success: !data.error,
      data,
      ...data,
      async json() {
        return data;
      }
    };
  }

  const response = await fetch(API_BASE_URL + path, fetchOptions);

  const data = await response.json().catch(() => ({
    error: "Invalid server response."
  }));

  return {
    ok: response.ok,
    success: response.ok && !data.error,
    data,
    ...data,
    async json() {
      return data;
    }
  };
}


async function checkLogin() {
  try {
    const response = await androidFetch("/api/me");

    if (!response.ok || response.error) {
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
    const response = await androidFetch(
      "/api/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      }
    );

    if (!response.ok || response.data?.error) {
      alert(response.data?.error || "Registration failed.");
      return;
    }

    alert("Account created. You can now log in.");

  } catch (error) {
    console.error("Registration error:", error);
    alert("Unable to connect to the server.");
  }
}


async function loginUser() {
  const username =
    document.querySelector("#loginUsername").value.trim();

  const password =
    document.querySelector("#loginPassword").value;

  try {
    const response = await androidFetch(
      "/api/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      }
    );

    if (!response.ok || response.data?.error) {
      alert(response.data?.error || "Login failed.");
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

    alert(`Welcome, ${response.data.username}!`);

  } catch (error) {
    console.error("Login error:", error);
    alert("Unable to connect to the server.");
  }
}


async function logoutUser() {
  try {
    await androidFetch("/api/logout");
  } finally {
    showLoggedOut();
    location.reload();
  }
}


document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
});
