const form = document.querySelector("#ask-form");
const answer = document.querySelector("#answer");
const submitButton = document.querySelector("#submit-button");
const copyButton = document.querySelector("#copy-button");

let lastAnswer = "";

function setAnswer(text, state = "normal") {
  answer.textContent = text;
  answer.className = `answer ${state === "empty" ? "empty" : ""} ${state === "error" ? "error" : ""}`.trim();
  lastAnswer = state === "normal" ? text : "";
  copyButton.disabled = !lastAnswer;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const topic = String(formData.get("topic") || "").trim();
  const level = String(formData.get("level") || "beginner");
  const language = String(formData.get("language") || "Arabic");

  if (window.location.protocol === "file:") {
    setAnswer(
      "افتح المشروع من http://localhost:3000 وليس بفتح ملف index.html مباشرة. الذكاء الاصطناعي يحتاج السيرفر حتى يرسل الطلب بأمان.",
      "error"
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "جار التفكير...";
  setAnswer("يتم تجهيز الإجابة الآن...", "empty");

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, level, language })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "حدث خطأ غير متوقع.");
    }

    setAnswer(data.answer);
  } catch (error) {
    setAnswer(
      `${error.message}\n\nتأكد أن السيرفر يعمل، وأن OPENAI_API_KEY موجود قبل تشغيل npm.cmd start.`,
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "اسأل الذكاء الاصطناعي";
  }
});

copyButton.addEventListener("click", async () => {
  if (!lastAnswer) return;
  await navigator.clipboard.writeText(lastAnswer);
  copyButton.textContent = "تم النسخ";
  setTimeout(() => {
    copyButton.textContent = "نسخ";
  }, 1200);
});
