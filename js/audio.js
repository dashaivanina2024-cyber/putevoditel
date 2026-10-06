/* Аудиогид: играет place.audioFile, если файл есть, иначе пишет текст речью браузера (speechSynthesis).
   Текст читается по предложениям — с паузами, ударениями и правильно выбранным русским голосом. */
(function () {
  let current = null;   // {type, el?}
  let place = null;
  let queue = [];       // предложения к озвучке
  let qi = 0;
  let paused = false;
  let voicesReady = false;

  const STRESS = [
    ["Полотняный", "по́лотняный"],
    ["богоявленскую", "богоявле́нскую"],
    ["Богоявленскую", "богоявле́нскую"],
    ["богоявленская", "богоявле́нская"],
    ["Богоявленская", "богоявле́нская"],
    ["Березуевский", "берёзу́евский"],
    ["Березуевском", "берёзу́евском"],
    ["Этномир", "этноми́р"],
    ["КотМузей", "Кот музей"],
    ["цПКиО", "парк"]
  ];

  function forSpeech(text) {
    let t = text;
    STRESS.forEach(([from, to]) => {
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      t = t.replace(re, to);
    });
    /* паузы на тире и точках, чтоб речь не сливалась */
    t = t.replace(/ — /g, ". ").replace(/ё/g, "ё");
    return t;
  }

  function splitSentences(t) {
    const parts = t.split(/([.!?…]+)(\s|$)/);
    const out = [];
    let cur = "";
    for (let i = 0; i < parts.length; i++) {
      cur += parts[i];
      if (i < parts.length - 1 && /^[.!?…]+$/.test(parts[i] || "")) {
        if (cur.trim()) out.push(cur.trim());
        cur = "";
      }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function pickVoice(list) {
    const ru = (list || []).filter((v) => v.lang && String(v.lang).toLowerCase().replace("_", "-").slice(0, 3) === "ru");
    const preferred = ["google русский", "milena", "yuri", "alyona", "tatyana", "irina", "elena", "alexander"];
    for (const p of preferred) {
      const v = ru.find((x) => x.name.toLowerCase().includes(p));
      if (v) return v;
    }
    return ru[0] || null;
  }

  function getVoices(cb) {
    if (!window.speechSynthesis) { cb([]); return; }
    const tryNow = () => speechSynthesis.getVoices();
    let list = tryNow();
    if (list && list.length) { voicesReady = true; cb(list); return; }
    let tries = 0;
    const h = setInterval(() => {
      list = tryNow();
      if ((list && list.length) || ++tries > 12) {
        clearInterval(h);
        voicesReady = true;
        cb(list || []);
      }
    }, 400);
  }

  document.addEventListener("DOMContentLoaded", () => window.addEventListener("beforeunload", stop));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && place) stop(); });

  function setBtn(btn) {
    if (!btn) return;
    btn.classList.toggle("playing", !!current && !paused);
    btn.innerHTML = !current
      ? (btn.dataset.label || "▶ Аудиогид")
      : (paused ? "▶ Продолжить" : "⏸ Пауза");
  }

  function stop() {
    if (current) {
      if (current.type === "tts" && window.speechSynthesis) window.speechSynthesis.cancel();
      else if (current.type === "file") { current.el.pause(); current.el.currentTime = 0; }
    }
    current = null; queue = []; qi = 0; paused = false;
    document.querySelectorAll(".audio-btn.playing").forEach((b) => b.classList.remove("playing"));
    document.dispatchEvent(new CustomEvent("audioguide:stop"));
  }

  /* Вариант 1: файл (assets/audio/<id>.mp3). Падение загрузки → синтез речи. */
  function playFile(p, btn) {
    const el = new Audio(p.audioFile);
    current = { type: "file", el };
    el.play().catch(() => { current = null; playTts(p, btn); });
    el.onended = stop;
    setBtn(btn);
  }

  /* Вариант 2: речь браузера (ru-RU), по предложениям — с ударениями и паузами. */
  function playTts(p, btn) {
    if (!window.speechSynthesis) { alert("Аудиогид пока не работает в этом браузере."); return; }
    let text = p.audio || [p.short, p.text, p.text2].filter(Boolean).join(" ");
    text = forSpeech(text);
    queue = splitSentences(text);
    qi = 0;
    current = { type: "tts" };
    getVoices((list) => {
      if (!current || current.type !== "tts") return;
      const v = pickVoice(list);
      if (!v) alert("Русский голос не найден в системе. Установите его в настройках языка и речи браузера.");
      speakNext(v);
    });
  }

  function speakNext(v) {
    speechSynthesis.cancel();
    for (let i = qi; i < queue.length; i++) {
      const u = new SpeechSynthesisUtterance(queue[i]);
      u.lang = "ru-RU";
      u.rate = 0.95;
      u.pitch = 1;
      if (v) u.voice = v;
      u.onend = i === queue.length - 1 ? stop : null;
      u.onerror = stop;
      speechSynthesis.speak(u);
    }
  }

  function toggle(p, btn) {
    if (current && place === p) {
      if (current.type === "tts") {
        if (paused) { paused = false; window.speechSynthesis.resume(); }
        else { paused = true; window.speechSynthesis.pause(); }
        setBtn(btn);
        return;
      }
      stop(); place = null; return;
    }
    if (current) stop();
    place = p; paused = false;
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
