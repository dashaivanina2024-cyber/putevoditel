/* Квиз: 5 вопросов, «генерация» и заготовленный маршрут. */
const QUESTIONS = [
  { q: "Сколько у вас времени?", opts: ["2–3 часа", "полдня", "целый день", "2 дня и больше"] },
  { q: "Что вам интереснее всего?", opts: ["космос", "история", "современное", "область", "всё понемногу"] },
  { q: "С кем вы путешествуете?", opts: ["один", "пара", "с детьми", "с друзьями", "с пожилыми родственниками"] },
  { q: "Что важнее в поездке?", opts: ["узнать новое", "красивые фото", "еда и атмосфера", "спокойный отдых"] },
  { q: "Готовы выехать за город?", opts: ["да, с удовольствием", "только если недалеко", "нет, остаёмся в Калуге"] }
];

const answers = [];
let step = 0;

function quizStep() {
  document.getElementById("quiz-counter").textContent = "Вопрос " + (step + 1) + " из " + QUESTIONS.length;
  document.getElementById("quiz-q").textContent = QUESTIONS[step].q;
  const box = document.getElementById("quiz-opts");
  box.innerHTML = "";
  QUESTIONS[step].opts.forEach((o) => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => {
      [...box.children].forEach((c) => c.classList.remove("selected"));
      b.classList.add("selected");
      answers[step] = o;
      document.getElementById("quiz-next").classList.add("show");
    };
    box.appendChild(b);
  });
  document.getElementById("quiz-next").textContent = step === QUESTIONS.length - 1 ? "Результат ✓" : "Дальше →";
}

function quizAdvance() {
  if (!document.getElementById("quiz-next").classList.contains("show")) return;
  step += 1;
  document.getElementById("quiz-next").classList.remove("show");
  if (step < QUESTIONS.length) { quizStep(); return; }
  showRoute();
}

function showRoute() {
  document.getElementById("quiz-questions").style.display = "none";
  const loading = document.getElementById("route-loading");
  loading.style.display = "flex";
  setTimeout(() => {
    loading.style.display = "none";
    document.getElementById("route-result").classList.add("show");
    renderRoute();
  }, 1800);
}

function pickPlaces() {
  const t = answers[0];
  const interest = (answers[1] || "").toLowerCase();
  const farChoice = answers[4] || "";
  const far = farChoice.startsWith("да");
  const near = farChoice.startsWith("только");

  let soft = [];
  let pool;
  if (interest === "область") {
    pool = PLACES.filter((p) => p.section === "oblast");
  } else if (interest === "космос" || interest === "история" || interest === "современное") {
    pool = PLACES.filter((p) => p.section === (interest === "история" ? "istoriya" : interest));
  } else {
    pool = PLACES.filter((p) => p.section !== "oblast");
  }

  if (!far && !near) {
    // остаёмся в городе: область в маршрут не включаем, только мягкая рекомендация
    soft = PLACES.filter((p) => p.section === "oblast").slice(0, 2);
    pool = pool.filter((p) => p.section !== "oblast");
  } else if (near) {
    // недалеко: только Полотняный Завод или Обнинск
    soft = PLACES.filter((p) => p.section === "oblast" && ["oblast-polo", "oblast-obninsk"].includes(p.id));
    if (interest !== "область") pool = pool.concat(soft.slice(0, 1));
    soft = soft.filter((p) => !pool.includes(p));
  }

  const limit = { "2–3 часа": 3, "полдня": 4, "целый день": 5, "2 дня и больше": 6 }[t] || 4;
  return { list: pool.slice(0, limit), soft };
}

function renderRoute() {
  const { list, soft } = pickPlaces();
  const map = L.map("route-map", { scrollWheelZoom: false });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap, &copy; CARTO", subdomains: "abcd", maxZoom: 19
  }).addTo(map);

  if (list.length) {
    const pts = list.map((p) => [p.lat, p.lon]);
    L.polyline(pts, { color: "#17140e", weight: 2.5, dashArray: "7 7" }).addTo(map);
    pts.forEach((pt, i) => {
      L.marker(pt, {
        icon: L.divIcon({ className: "", html: '<div class="pin-ico"></div>', iconSize: [28, 40], iconAnchor: [14, 40] })
      }).addTo(map).bindTooltip((i + 1) + ". " + list[i].name, { direction: "top", offset: [0, -34] });
    });
    map.fitBounds(L.latLngBounds(pts).pad(0.35));
  }

  const ul = document.getElementById("route-list");
  ul.innerHTML = "";
  list.forEach((p, i) => {
    const a = document.createElement("a");
    a.className = "route-item";
    a.href = "place.html?id=" + p.id;
    a.innerHTML =
      '<span class="n">' + (i + 1) + '</span>' +
      '<span><span class="t">' + p.name + '</span><small>' + p.short + " · " + p.visit + "</small></span>";
    ul.appendChild(a);
  });

  const note = document.getElementById("soft-note");
  if (soft.length) {
    note.innerHTML =
      "А за город у нас есть ещё вот это — на другой раз: " +
      soft.map((p) => '<a href="place.html?id=' + p.id + '">' + p.name + "</a>").join(", ") + ".";
    note.style.display = "";
  } else {
    note.style.display = "none";
  }
}

quizStep();
document.getElementById("quiz-next").onclick = quizAdvance;
