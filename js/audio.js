/* Аудиогид: играет place.audioFile, если файл есть, иначе пишет текст речью браузера (speechSynthesis). */
(function () {
  let current = null;   // {type, node/el}
  let place = null;

  function stop() {
    if (!current) return;
    if (current.type === "tts" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    } else if (current.type === "file") {
      current.el.pause();
      current.el.currentTime = 0;
    }
    document.querySelectorAll(".audio-btn.playing").forEach((b) => b.classList.remove("playing"));
    current = null;
    document.dispatchEvent(new CustomEvent("audioguide:stop"));
  }

  document.addEventListener("DOMContentLoaded", () => window.addEventListener("beforeunload", stop));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && place) stop(); });

  function setBtn(btn, on) {
    if (!btn) return;
    btn.classList.toggle("playing", on);
    btn.innerHTML = on ? "⏸ Пауза" : (btn.dataset.label || "▶ Аудиогид");
  }

  /* Вариант 1: файл (assets/audio/<id>.mp3). Падение загрузки → синтез речи. */
  function playFile(p, btn) {
    const el = new Audio(p.audioFile);
    current = { type: "file", el };
    el.play().catch(() => { current = null; playTts(p, btn); });
    el.onended = stop;
    setBtn(btn, true);
  }

  /* Вариант 2: речь браузера (ru-RU). */
  function playTts(p, btn) {
    if (!window.speechSynthesis) { alert("Аудиогид пока не работает в этом браузере."); return; }
    let text = p.audio || [p.short, p.text, p.text2].filter(Boolean).join(" ");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ru-RU";
    u.rate = 0.98;
    const ru = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith("ru"));
    if (ru) u.voice = ru;
    u.onend = stop;
    u.onerror = stop;
    current = { type: "tts" };
    window.speechSynthesis.speak(u);
    setBtn(btn, true);
  }

  function toggle(p, btn) {
    if (current) { stop(); if (place === p) { place = null; return; } }
    place = p;
    if (p.audioFile) playFile(p, btn); else playTts(p, btn);
  }

  window.AudioGuide = { toggle, stop };

  /* Кнопка: AudioGuideButton(place, labelText) → готовая <button> со стилями .audio-btn */
  window.AudioGuideButton = function (place, label) {
    const b = document.createElement("button");
    b.className = "btn audio-btn";
    b.dataset.label = label || "▶ Аудиогид";
    b.textContent = b.dataset.label;
    b.onclick = (e) => { e.preventDefault(); toggle(place, b); };
    return b;
  };

  document.addEventListener("audioguide:stop", () => { if (place) place = null; });
})();
