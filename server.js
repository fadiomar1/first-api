import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");

function loadDotEnv() {
  try {
    const envPath = join(__dirname, ".env");
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional. Environment variables still work normally.
  }
}

loadDotEnv();

const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || "gpt-5.5";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) {
      throw new Error("REQUEST_TOO_LARGE");
    }
  }
  return JSON.parse(body || "{}");
}

async function askOpenAI(topic, level, language) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("MISSING_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a helpful AI study assistant. Give clear, practical, structured answers. Avoid long introductions."
        },
        {
          role: "user",
          content: `Topic: ${topic}\nLevel: ${level}\nLanguage: ${language}\n\nCreate a useful study answer with: short explanation, key points, practical example, and 3 review questions.`
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || "OpenAI request failed.";
    throw new Error(message);
  }

  return data.output_text || "No text was returned.";
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/ask") {
    try {
      const { topic, level = "beginner", language = "Arabic" } = await readRequestJson(req);

      if (!topic || String(topic).trim().length < 3) {
        sendJson(res, 400, { error: "اكتب سؤالا أو موضوعا أطول قليلا." });
        return;
      }

      const answer = await askOpenAI(String(topic).trim(), level, language);
      sendJson(res, 200, { answer, model });
    } catch (error) {
      const message =
        error.message === "MISSING_API_KEY"
          ? "ضع مفتاح OpenAI API في متغير البيئة OPENAI_API_KEY ثم شغل المشروع من جديد."
          : error.message === "REQUEST_TOO_LARGE"
            ? "الرسالة طويلة جدا."
            : error.message;
      sendJson(res, 500, { error: message });
    }
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`AI Study Assistant is running at http://localhost:${port}`);
});
