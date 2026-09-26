const crypto = require("crypto");

async function createPayout({ withdrawalId, amount, upiId }) {
  const provider = process.env.PAYOUT_PROVIDER || "sandbox";

  if (provider === "sandbox") {
    const payoutId =
      "sandbox_" +
      withdrawalId +
      "_" +
      crypto.randomBytes(6).toString("hex");

    return {
      success: true,
      provider: "sandbox",
      payoutId,
      status: "processing"
    };
  }

  throw new Error("Payout provider is not configured.");
}

module.exports = {
  createPayout
};
