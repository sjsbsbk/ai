import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;

// این مقدار را داخل Railway Variables بگذار، نه داخل GitHub
const API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

// Base URL پروکسی شما
const BASE_URL = (
  process.env.LLM_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  "https://freellmapi-production-ae0b.up.railway.app/v1"
).replace(/\/$/, "");

// مدل پیش‌فرض روی auto
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "auto";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// فرانت‌اند
app.use(express.static(path.join(__dirname, "public")));

// تست سلامت سرور
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    model: DEFAULT_MODEL
  });
});

// API چت
app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "API key is missing. Set LLM_API_KEY in Railway Variables."
      });
    }

    const {
      message,
      messages,
      model = DEFAULT_MODEL,
      temperature = 0.7,
      max_tokens = 1000
    } = req.body || {};

    let finalMessages;

    if (Array.isArray(messages)) {
      finalMessages = messages;
    } else {
      if (!message || !String(message).trim()) {
        return res.status(400).json({
          error: "Message is required."
        });
      }

      finalMessages = [
        {
          role: "system",
          content: "You are a helpful assistant."
        },
        {
          role: "user",
          content: String(message)
        }
      ];
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        temperature,
        max_tokens
      })
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Upstream API error",
        status: response.status,
        details: data
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      data?.output_text ||
      data?.content?.[0]?.text ||
      null;

    res.json({
      answer,
      raw: data
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
