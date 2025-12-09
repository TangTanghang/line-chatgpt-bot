// api/webhook.js
const linebot = require("linebot");
const axios = require("axios");

// 使用環境變數儲存敏感資訊（在 Vercel 後台設定）
const bot = linebot({
  channelId: process.env.LINE_CHANNEL_ID,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// 由 linebot 產生處理 LINE Webhook 的 middleware
const parser = bot.parser();

// 收到訊息事件
bot.on("message", async function (event) {
  try {
    const userText = event.message.text || "";

    // 呼叫 OpenAI Chat Completions
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "你是一個友善又專業的 LINE 客服機器人。"
          },
          {
            role: "user",
            content: userText
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const aiText =
      response.data.choices?.[0]?.message?.content ||
      "我現在有點忙碌，稍後再回覆你～";

    // 回覆給使用者
    await event.reply(aiText);
  } catch (error) {
    console.error("Error:", error?.response?.data || error);
    try {
      await event.reply("哎呀，系統剛剛打結了，等等再試看看 🙏");
    } catch (e) {
      console.error("Reply error:", e);
    }
  }
});

// 🔑 Vercel Serverless Function 入口
module.exports = (req, res) => {
  if (req.method === "POST") {
    // 交給 linebot middleware 處理簽章驗證、事件分派
    parser(req, res);
  } else {
    // 給你測試用的 GET
    res.status(200).send("LINE webhook is running.");
  }
};
