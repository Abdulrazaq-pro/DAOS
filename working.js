const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot details
const TELEGRAM_BOT_TOKEN = "7304378262:AAFbIBG9WkWnRA2zx3BNCAY-Jet4RhuKGWE";
const TELEGRAM_CHAT_ID = "7164618172";

// DAO Treasury Addresses
const TREASURY_ADDRESSES = {
  RWOK: "0x1836908bfe22f50edf39432d242c5f4c50e83ce4",
  HARD: "0x123a7adf66c45d72e2f87ea6e6438cda15b076be",
  AR: "0x767e095f6549050b4e9a3bcce18aadd28bef486f",
  TEST: "0x00000000219ab540356cBB839Cbe05303d7705Fa",
  BOT: "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549",
};

// Monitored Assets
const MONITORED_ASSETS = new Set(["ETH", "wstETH", "WETH", "bitcoin"]);

app.use(express.json());

// CoinGecko Price Fetching Function
async function getCryptoPrices() {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price",
      {
        params: {
          ids: "ethereum,bitcoin,wrapped-steth",
          vs_currencies: "usd",
        },
      }
    );
    return {
      ETH: response.data.ethereum.usd,
      WETH: response.data.ethereum.usd,
      wstETH: response.data["wrapped-steth"].usd,
      bitcoin: response.data.bitcoin.usd,
    };
  } catch (error) {
    console.error("Error fetching crypto prices:", error);
    return null;
  }
}

app.post("/webhook", async (req, res) => {
  console.log("Received webhook payload:", JSON.stringify(req.body, null, 2));

  try {
    const { event } = req.body;
    if (!event || !Array.isArray(event.activity)) {
      console.error("Invalid event format:", req.body);
      return res.sendStatus(400);
    }

    let prices = await getCryptoPrices();
    if (!prices) {
      console.error("Failed to fetch crypto prices.");
      return res.sendStatus(500);
    }

    let messages = [];

    event.activity.forEach((tx) => {
      console.log("Transaction received:", tx);
      console.log("Asset:", tx.asset);
      console.log("DAO Name:", daoName);

      if (!tx.asset || !MONITORED_ASSETS.has(tx.asset)) {
        console.log(`Ignoring unmonitored asset: ${tx.asset}`);
        return {};
      }

      if (!tx.value || !tx.toAddress || !tx.fromAddress || !tx.hash) {
        console.error("Missing transaction data:", JSON.stringify(tx, null, 2));
        return;
      }

      let daoName = Object.keys(TREASURY_ADDRESSES).find(
        (key) =>
          TREASURY_ADDRESSES[key].toLowerCase() ===
            tx.toAddress.toLowerCase() ||
          TREASURY_ADDRESSES[key].toLowerCase() === tx.fromAddress.toLowerCase()
      );

      if (!daoName) {
        console.log(`Ignoring transaction, no matching DAO: ${tx.hash}`);
        return;
      }

      let action =
        TREASURY_ADDRESSES[daoName].toLowerCase() === tx.toAddress.toLowerCase()
          ? "Received"
          : "Sent";
      let usdValue = (tx.value * prices[tx.asset]).toFixed(2);

      let message =
        `📢 *${daoName} Treasury Update*\n\n` +
        `🔹 Asset: ${tx.asset}\n` +
        `🔹 Amount: ${tx.value}\n` +
        `💰 USD Value: $${usdValue}\n` +
        `🔹 Action: ${action}\n` +
        `🔹 [View Transaction](https://etherscan.io/tx/${tx.hash})`;

      messages.push(message);
    });

    if (messages.length === 0) {
      console.log("No valid transactions to notify.");
      return res.sendStatus(200);
    }

    for (let msg of messages) {
      await sendMessageToTelegram(msg);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.sendStatus(500);
  }
});

async function sendMessageToTelegram(message) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }
    );
    console.log("Telegram message response:", response.data);
  } catch (error) {
    console.error(
      "Error sending message to Telegram:",
      error.response ? error.response.data : error.message
    );
  }
}

app.all("/test", async (req, res) => {
  try {
    const testMessage = "🚀 Test message from your webhook server!";
    await sendMessageToTelegram(testMessage);
    res.send("Test message sent to Telegram!");
  } catch (error) {
    console.error("Error sending test message:", error);
    res.status(500).send("Failed to send test message.");
  }
});

app.get("/", (req, res) => {
  res.send("Webhook server is running!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
