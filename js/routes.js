/* Страница «Маршруты» (слайд 6/6): 4 готовых маршрута + генерация по кнопке. */
const ROUTE_ANSWERS = [];
let routeStep = 0;

const QUIZ_ROUTE = [
  { q: "Сколько у вас времени?", opts: ["2–3 часа", "полдня", "целый день", "2 дня и больше"] },
  { q: "Что вам интереснее всего?", opts: ["космос", "история", "современное", "область", "всё понемногу"] },
  { q: "С кем вы путешествуете?", opts: ["один", "пара", "с детьми", "с друзьями", "с пожилыми родственниками"] },
  { q: "Что важнее в поездке?", opts: ["узнать новое", "красивые фото", "еда и атмосфера", "спокойный отдых"] },
  { q: "Готовы выехать за город?", opts: ["да, с удовольствием", "только если недалеко", "нет, остаёмся в Калуге"] }
];

const routeById = (id) => ROUTES.find((r) => r.id === id);
const placeById = (id) => PLACES.find((p) => p.id === id);

/* 4 карточки готовых маршрутов */
function buildRouteCards() {
  const grid = document.getElementById("routes-grid");
  if (!grid) return;
  ROUTES.forEach((r) => {
    const card = document.createElement("article");
    card.className = "route-card fade fade-2";
    card.dataset.routeId = r.id;
    const stops = r.stops.map(placeById).filter(Boolean);
    card.innerHTML =
      '<h3>' + r.title + '</h3>' +
      '<span class="route-tag">' + r.tag + '</span>' +
      '<p>' + r.desc + '</p>' +
      '<div class="route-features"><span>' + stops.length + ' точки</span><span>Аудиогид ▶</span></div>' +
      '<button class="btn route-open">Смотреть маршрут →</button>';
    card.querySelector(".route-open").onclick = () => openRoute(r.id);
    grid.appendChild(card);
  });
}

/* Разворачивает карточку маршрута (объект или id из ROUTES): карта + список + аудиогид */
function openRoute(routeId) {
  const r = typeof routeId === "string" ? routeById(routeId) : routeId;
  if (!r) return;
  const stops = r.stops.map((s) => (typeof s === "string" ? placeById(s) : s)).filter(Boolean);
  r.stops = stops;
  const view = document.getElementById("route-view");
  view.classList.add("show");
  view.innerHTML = "";

  const h = document.createElement("div");
  h.className = "route-result show quiz-q";
  h.textContent = r.title;
  view.appendChild(h);

  const mapDiv = document.createElement("div");
  mapDiv.className = "route-map";
  mapDiv.id = "route-map-open";
  view.appendChild(mapDiv);

  const whole = { audio: stops.map((p, i) => (i + 1) + ". " + p.name + ". " + (p.audio || p.short)).join(" ") };
  const playAll = AudioGuideButton(whole, "▶ Слушать весь маршрут");
  playAll.style.margin = "10px 0 16px";
  view.appendChild(playAll);

  const ul = document.createElement("div");
  ul.className = "route-list";
  stops.forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "route-item";
    const left = document.createElement("div");
    left.className = "route-main";
    left.innerHTML =
      '<span class="n">' + (i + 1) + '</span>' +
      '<span><span class="t">' + p.name + '</span><small>' + p.short + " · " + p.visit + '</small></span>';
    item.appendChild(left);
    const actions = document.createElement("div");
    actions.className = "route-actions";
    const playBtn = AudioGuideButton(p, "▶");
    playBtn.dataset.label = "▶";
    playBtn.textContent = "▶";
    playBtn.title = "Слушать про " + p.name;
    const link = document.createElement("a");
    link.className = "route-link";
    link.href = "place.html?id=" + p.id;
    link.textContent = "Подробнее →";
    actions.appendChild(playBtn);
    actions.appendChild(link);
    item.appendChild(actions);
    ul.appendChild(item);
  });
  view.appendChild(ul);

  const note = document.createElement("p");
  note.className = "soft-note";
  note.textContent = r.food;
  view.appendChild(note);

  const back = document.createElement("button");
  back.className = "btn";
  back.textContent = "← Свернуть";
  back.onclick = () => {
    AudioGuide.stop();
    view.classList.remove("show");
    view.innerHTML = "";
  };
  view.appendChild(back);

  renderRouteMap("route-map-open", stops);
  view.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* Карта с пронумерованными пинами и пунктирной линией */
function renderRouteMap(elId, stops) {
  if (!stops.length) return;
  const map = L.map(elId, { scrollWheelZoom: false });
  makeTiles(map);

  const pts = stops.map((p) => [p.lat, p.lon]);
  L.polyline(pts, { color: "#f6f3ec", weight: 2.5, dashArray: "7 7", opacity: .8 }).addTo(map);
  pts.forEach((pt, i) => {
    L.marker(pt, {
      icon: L.divIcon({ className: "", html: '<div class="pin-ico num"><span>' + (i + 1) + "</span></div>", iconSize: [28, 40], iconAnchor: [14, 40] })
    }).addTo(map).bindTooltip((i + 1) + ". " + stops[i].name, { direction: "top", offset: [0, -34] });
  });
  map.fitBounds(L.latLngBounds(pts).pad(0.35));
  addPoiControls(map);
}

/* --- Квиз «собрать маршрут по ответам» --- */
/* Маршрут собирается динамически: пул точек по интересам + фильтры времени/детей/загорода,
   порядок — географический жадный алгоритм. Состав не повторяет предыдущую выдачу (localStorage). */

function distKm(a, b) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/* Жадный порядок точек: начинаем с самой юго-западной, идём к ближайшей */
function orderStops(stops) {
  if (stops.length < 3) return stops;
  const left = [...stops];
  let cur = left.reduce((w, p) => (p.lon < w.lon ? p : w), left[0]);
  const out = [cur];
  left.splice(left.indexOf(cur), 1);
  while (left.length) {
    cur = left.reduce((near, p) => (distKm(out[out.length - 1], p) < distKm(out[out.length - 1], near) ? p : near), left[0]);
    out.push(cur);
    left.splice(left.indexOf(cur), 1);
  }
  return out;
}

/* История выдач — чтобы маршрут не повторялся */
function seenKeys() {
  try { return JSON.parse(localStorage.getItem("route-history") || "[]"); } catch (e) { return []; }
}
function rememberKey(key) {
  try {
    const list = seenKeys();
    list.push(key);
    localStorage.setItem("route-history", JSON.stringify(list.slice(-6)));
  } catch (e) {}
}

/* Собрать маршрут по ответам: всегда конкретный, всегда новый состав */
function buildPersonalRoute(answers) {
  const time = answers[0] || "полдня";
  const interest = (answers[1] || "").toLowerCase();
  const kids = (answers[2] || "") === "с детьми";
  const farChoice = answers[4] || "";
  const far = farChoice.startsWith("да");
  const near = farChoice.startsWith("только");
  const cityOnly = farChoice.startsWith("нет") || (interest !== "область" && answers[3] === "спокойный отдых" && !far);

  const limit = { "2–3 часа": 3, "полдня": 4, "целый день": 5, "2 дня и больше": 7 }[time] || 4;

  /* Пул: секция по интересу; при «всё понемногу» — смесь тем */
  let pool;
  if (interest === "область") pool = PLACES.filter((p) => p.section === "oblast");
  else if (["kosmos", "istoriya", "sovremennost"].includes(interest)) {
    const main = PLACES.filter((p) => p.section === (interest === "история" ? "istoriya" : interest));
    pool = main.concat(monPartList(PLACES, interest));
  } else {
    pool = PLACES.filter((p) => !p.section || p.section !== "oblast" || far || near);
  }
  if (cityOnly) pool = pool.filter((p) => p.section !== "oblast");
  else if (near && interest !== "область") pool = pool.filter((p) => p.section !== "oblast" || ["oblast-polo", "oblast-obninsk"].includes(p.id));

  /* Скоринг основной темы + дети + немного случайности; верхние limit попадают в маршрут */
  const scored = pool.map((p) => ({
    p,
    score: (matchesMain(p, interest) ? 3 : 0) + (kids && p.kids ? 1.5 : 0) + Math.random() * 0.9
  })).sort((a, b) => b.score - a.score).map((x) => x.p);
  let candidates = scored;

  /* Загород: если НЕ за город — их выкинули выше; если «только недалеко» — максимум один */
  const extra = [];
  if (near) {
    const nearSpots = PLACES.filter((p) => p.section === "oblast" && ["oblast-polo", "oblast-obninsk"].includes(p.id));
    if (nearSpots.length && candidates.some((p) => p.section !== "oblast")) extra.push(...nearSpots.slice(0, 1));
  }

  let picks = candidates.slice(0, limit);
  picks = picks.concat(extra.filter((p) => !picks.includes(p))).slice(0, limit);

  /* Состав не должен повторять прошлогоднюю выдачу */
  const seen = seenKeys();
  for (let attempt = 0; attempt < 12; attempt++) {
    const key = picks.map((p) => p.id).join("|");
    if (!seen.includes(key)) break;
    /* Заменяем случайную позицию точкой с резервной секции того же веса */
    const rest = candidates.filter((p) => !picks.includes(p));
    if (!rest.length) break;
    const fresh = rest[Math.floor(Math.random() * Math.min(rest.length, 4))];
    const pos = Math.floor(Math.random() * picks.length);
    picks = picks.slice(); picks[pos] = fresh;
  }
  rememberKey(picks.map((p) => p.id).join("|"));

  picks = orderStops(picks);

  const titles = { kosmos: "Космический вариант", istoriya: "Историческая Калуга", sovremennost: "Современная Калуга", oblast: "Загородный вариант", mix: "Микс из лучшего" };
  const tkey = interest === "всё понемногу" ? "mix" : ({ "космос": "kosmos", "история": "istoriya", "современное": "sovremennost", "область": "oblast" }[interest] || "mix");
  return {
    title: "Ваш маршрут · " + (titles[tkey] || "Калуга"),
    tag: (time || "").toUpperCase() + (kids ? " · с детьми" : "") + (picks.some((p) => p.section === "oblast") ? " · выезд" : " · в городе"),
    desc: "Собран по вашим ответам: " + (interest || "всё понемногу") + ", " + (time || "полдня") + (kids ? ", с детьми" : "") + ". Если точка закрыта — смотрите сервисный слой на карте вокруг.",
    stops: picks,
    food: eatsFor(picks)
  };
}

/* Совпадает ли точка с основной интересом */
function matchesMain(p, interest) {
  const key = { "космос": "kosmos", "история": "istoriya", "современное": "sovremennost", "область": "oblast" }[interest];
  return key ? p.section === key : true;
}

/* «Второй темой» подмешиваем пару точек соседнего настроения */
function monPartList(all, mainSection) {
  const secs = { kosmos: "sovremennost", istoriya: "kosmos", sovremennost: "kosmos", oblast: "istoriya" };
  const other = all.filter((p) => p.section === secs[mainSection]);
  return other.slice(0, other.length > 2 ? 2 : other.length);
}
function eatsFor(picks) {
  if (picks.some((p) => p.id === "oblast-etnomir")) return "В Этномире едят в трапезных подворий — на весь день лучше брать перекус с собой.";
  if (picks.some((p) => p.section === "oblast")) return "Поесть на маршруте: кафе у монастырей или столовая по пути.";
  if (picks.some((p) => p.id && p.id.startsWith("sovremennost"))) return "Улица Кирова — главное кофейное место: «1554», «Мильфей», «Станция Фруктовая».";
  return "Кофе и место обеда ищите в слое «Еда» над картой — точек много.";
}

function quizRender() {
  const box = document.getElementById("quiz-opts");
  document.getElementById("quiz-counter").textContent = "Вопрос " + (routeStep + 1) + " из " + QUIZ_ROUTE.length;
  document.getElementById("quiz-q").textContent = QUIZ_ROUTE[routeStep].q;
  box.innerHTML = "";
  QUIZ_ROUTE[routeStep].opts.forEach((o) => {
    const b = document.createElement("button");
    b.className = "opt-btn";
    b.textContent = o;
    b.onclick = () => {
      [...box.children].forEach((c) => c.classList.remove("selected"));
      b.classList.add("selected");
      ROUTE_ANSWERS[routeStep] = o;
      document.getElementById("quiz-next").classList.add("show");
    };
    box.appendChild(b);
  });
  document.getElementById("quiz-next").textContent = routeStep === QUIZ_ROUTE.length - 1 ? "Результат ✓" : "Дальше →";
}

function quizAdvance() {
  if (!document.getElementById("quiz-next").classList.contains("show")) return;
  routeStep += 1;
  document.getElementById("quiz-next").classList.remove("show");
  if (routeStep < QUIZ_ROUTE.length) { quizRender(); return; }
  openRoute(buildPersonalRoute(ROUTE_ANSWERS));
}

document.addEventListener("DOMContentLoaded", () => {
  buildRouteCards();
  const next = document.getElementById("quiz-next");
  if (next) next.onclick = quizAdvance;
  quizRender();
});
