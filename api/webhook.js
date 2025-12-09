// api/webhook.js
// 不用 linebot，直接處理 LINE Webhook + 呼叫 OpenAI + 回 LINE

const axios = require("axios");

module.exports = async (req, res) => {
  // 1) 給你測試用：用瀏覽器 GET /api/webhook 會看到這句
  if (req.method !== "POST") {
    return res.status(200).send("LINE webhook is running.");
  }

  // 2) 收集 POST body（Vercel 預設不幫我們 parse）
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      // 👉 Verify 時 body 可能是空的，或 events 是空陣列
      if (!body) {
        return res.status(200).send("OK");
      }

      const json = JSON.parse(body);
      const events = json.events || [];

      // 沒有事件（Verify 或健康檢查）一律回 OK
      if (events.length === 0) {
        return res.status(200).send("OK");
      }

      const event = events[0];

      // 只處理「文字訊息」，其他類型直接回 OK
      if (
        !event ||
        event.type !== "message" ||
        !event.message ||
        event.message.type !== "text"
      ) {
        return res.status(200).send("OK");
      }

      const userText = event.message.text;
      const replyToken = event.replyToken;

      // 預設回覆
      let replyText = "我暫時無法回覆，請稍後再試～";

      // 3) 呼叫 OpenAI 產生回覆文字
      try {
        const aiRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "你是一個親切又專業的 LINE 客服機器人。"
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

        replyText =
          aiRes.data.choices?.[0]?.message?.content || replyText;
      } catch (e) {
        console.error("OpenAI error:", e?.response?.data || e);
      }

      // 4) 回傳訊息給 LINE 使用者
      try {
        await axios.post(
          "https://api.line.me/v2/bot/message/reply",
          {
            replyToken,
            messages: [
              {
                type: "text",
                text: replyText
              }
            ]
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            }
          }
        );
      } catch (e) {
        console.error("LINE reply error:", e?.response?.data || e);
      }

      // 5) 一律回 200 OK 給 LINE（很重要，避免 timeout）
      return res.status(200).send("OK");
    } catch (e) {
      console.error("Handler error:", e);
      // 就算錯誤，也要回 200，避免 LINE 一直重送
      return res.status(200).send("OK");
    }
  });
};

