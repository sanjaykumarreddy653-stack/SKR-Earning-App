async function androidFetch(path, options = {}) {
  const url = API_BASE_URL + path;
  if (window.AndroidAPI) {
    const body = options.body || "{}";

    const result = JSON.parse(
      window.AndroidAPI.request(path, body)
    );

    return {
      ok: !result.error,
      data: result,
      async json() {
        return result;
      }
    };
  }

  const response = await fetch(API_BASE_URL + path, options);
  const data = await response.json();

  return {
    ok: response.ok,
    data,
    async json() {
      return data;
    }
  };
}

let currentTask = null;

async function loadWallet() {
  try {
    const response = await androidFetch("/api/wallet");

    if (!response.ok) return;

    const wallet = await response.json();

    document.querySelector(".amount").textContent =
      `₹${Number(wallet.balance).toFixed(2)}`;

    document.querySelector(".limit").textContent =
      `Today's earnings: ₹${Number(wallet.todayEarnings).toFixed(2)} / ₹${Number(wallet.dailyLimit).toFixed(2)}`;
  } catch (error) {
    console.error("Wallet error:", error);
  }
}

async function loadTransactions() {
  try {
    const response = await androidFetch("/api/transactions");

    if (!response.ok) return;

    const data = await response.json();
    const history = document.querySelector("#transactionHistory");

    if (!data.transactions || !data.transactions.length) {
      history.innerHTML = "<p>No transactions yet.</p>";
      return;
    }

    history.innerHTML = data.transactions.map(transaction => `
      <div style="padding:12px 0;border-bottom:1px solid #283244;">
        <strong>
          ${Number(transaction.amount) >= 0 ? "+" : ""}₹${Number(transaction.amount).toFixed(2)}
        </strong>
        <br>
        <span style="color:#9ca8bb">
          ${escapeHtml(transaction.description || transaction.type)}
        </span>
        <br>
        <small style="color:#68758a">
          ${escapeHtml(transaction.created_at)}
        </small>
      </div>
    `).join("");
  } catch (error) {
    console.error("Transaction error:", error);
  }
}

async function startTypingJob() {
  try {
    const response = await androidFetch("/api/task");
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Unable to get a typing task.");
      return;
    }

    currentTask = data;

    document.querySelector("#typingTask")?.remove();

    const taskBox = document.createElement("section");
    taskBox.id = "typingTask";
    taskBox.className = "card";

    taskBox.innerHTML = `
      <h2>⌨️ Typing Job</h2>

      <p style="white-space:pre-line;line-height:1.7;background:#080b12;padding:14px;border-radius:10px;">
${escapeHtml(data.text)}
      </p>

      <textarea
        id="typingInput"
        rows="7"
        placeholder="Type the 3 lines exactly as shown..."
        style="
          width:100%;
          padding:12px;
          margin:10px 0;
          border-radius:10px;
          border:1px solid #303b4f;
          background:#080b12;
          color:white;
          font-size:16px;
          resize:vertical;
        "
      ></textarea>

      <div id="typingCount" style="color:#9ca8bb;margin-bottom:10px;">
        Characters: 0
      </div>

      <button class="primary" id="submitTyping">
        Submit Task — ₹${Number(data.reward).toFixed(2)}
      </button>

      <button class="secondary" id="cancelTyping">
        Cancel
      </button>
    `;

    document.querySelector("#appContent").prepend(taskBox);

    const input = document.querySelector("#typingInput");

    input.addEventListener("input", () => {
      document.querySelector("#typingCount").textContent =
        `Characters: ${input.value.length}`;
    });

    document
      .querySelector("#submitTyping")
      .addEventListener("click", submitTypingTask);

    document
      .querySelector("#cancelTyping")
      .addEventListener("click", () => {
        taskBox.remove();
        currentTask = null;
      });

    input.focus();

  } catch (error) {
    console.error("Typing job error:", error);
    alert("Unable to connect to the server.");
  }
}

async function submitTypingTask() {
  if (!currentTask) return;

  const input = document.querySelector("#typingInput");
  const button = document.querySelector("#submitTyping");

  if (!input.value.trim()) {
    alert("Please type the task before submitting.");
    return;
  }

  button.disabled = true;
  button.textContent = "Submitting...";

  try {
    const response = await androidFetch("/api/task/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        taskId: currentTask.taskId,
        typedText: input.value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Task could not be completed.");
      button.disabled = false;
      button.textContent =
        `Submit Task — ₹${Number(currentTask.reward).toFixed(2)}`;
      return;
    }

    document.querySelector("#typingTask")?.remove();
    currentTask = null;

    await loadWallet();
    await loadTransactions();

    alert(
      `Task completed!\n₹${Number(data.reward).toFixed(2)} added.\n\n` +
      `Today's earnings: ₹${Number(data.todayEarnings).toFixed(2)} / ₹${Number(data.dailyLimit).toFixed(2)}`
    );

  } catch (error) {
    console.error("Submit error:", error);
    alert("Unable to connect to the server.");

    button.disabled = false;
    button.textContent =
      `Submit Task — ₹${Number(currentTask.reward).toFixed(2)}`;
  }
}

// Refresh wallet and transaction data every 15 seconds while logged in.
setInterval(async () => {
  try {
    const me = await androidFetch("/api/me");

    if (!me.ok) return;

    await loadWallet();
    await loadTransactions();
    await loadWithdrawals();
  } catch (error) {
    console.error("Auto-refresh error:", error);
  }
}, 15000);

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function requestWithdrawal() {
  const amount = Number(
    document.querySelector("#withdrawAmount").value
  );

  const upiId = document
    .querySelector("#upiId")
    .value
    .trim();

  if (!Number.isFinite(amount) || amount < 10) {
    alert("Minimum withdrawal amount is ₹10.");
    return;
  }

  if (!upiId) {
    alert("Enter your UPI ID.");
    return;
  }

  try {
    const response = await androidFetch("/api/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount,
        upiId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Withdrawal request failed.");
      return;
    }

    document.querySelector("#withdrawalStatus").innerHTML = `
      <p>
        Withdrawal #${data.withdrawalId} submitted.
        <br>
        Status: <strong>${escapeHtml(data.status)}</strong>
      </p>
    `;

    document.querySelector("#withdrawAmount").value = "";
    document.querySelector("#upiId").value = "";

    await loadWallet();
    await loadTransactions();
    await loadWithdrawals();

  } catch (error) {
    console.error("Withdrawal error:", error);
    alert("Unable to connect to the server.");
  }
}

async function loadWithdrawals() {
  try {
    const response = await androidFetch("/api/withdrawals");

    if (!response.ok) return;

    const data = await response.json();
    const history = document.querySelector("#withdrawalHistory");

    if (!data.withdrawals || !data.withdrawals.length) {
      history.innerHTML = "<p>No withdrawals yet.</p>";
      return;
    }

    history.innerHTML = data.withdrawals.map(w => `
      <div style="padding:12px 0;border-bottom:1px solid #283244;">
        <strong>₹${Number(w.amount).toFixed(2)}</strong>
        <br>
        <span>UPI: ${escapeHtml(w.upi_id)}</span>
        <br>
        <span>Status: <strong>${
        w.status === "pending"
          ? "Pending"
          : w.status === "processing"
            ? "Processing"
            : w.status === "completed"
              ? "Completed"
              : w.status === "paid"
                ? "Paid"
                : w.status === "rejected"
                  ? "Rejected"
                  : escapeHtml(w.status)
      }</strong></span>
        <br>
        <small style="color:#68758a">
          ${escapeHtml(w.created_at)}
        </small>
      </div>
    `).join("");

  } catch (error) {
    console.error("Withdrawal history error:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.querySelector("#startJob");

  if (startButton) {
    startButton.addEventListener("click", startTypingJob);
  }

  const withdrawButton =
    document.querySelector("#withdrawButton");

  if (withdrawButton) {
    withdrawButton.addEventListener(
      "click",
      requestWithdrawal
    );
  }

  loadWallet();
  loadTransactions();
  loadWithdrawals();
});
