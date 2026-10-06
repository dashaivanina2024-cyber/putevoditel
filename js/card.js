/* Карта слайда: Leaflet, пины, карточка места, лайтбокс. */
function renderSectionMap(sectionId) {
  const places = PLACES.filter((p) => p.section === sectionId);
  const map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.25 });
  window._sectionMaps = window._sectionMaps || [];
  window._sectionMaps.push(map);
  makeTiles(map);

  const bounds = [];
  places.forEach((p) => {
    bounds.push([p.lat, p.lon]);
    L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: "", html: '<div class="pin-ico"></div>', iconSize: [30, 30], iconAnchor: [15, 15] }),
      title: p.name
    }).addTo(map).on("click", () => openCard(places, p.id, map));
  });

  if (!bounds.length) {
    // обложка: карта Калуги без пинов
    map.setView([54.5078, 36.2500], 13);
    return;
  }

  const isWide = sectionId === "oblast";
  map.fitBounds(bounds, { padding: isWide ? [70, 70] : [150, 150], maxZoom: 14 });

  addPoiControls(map);

  const overlay = document.getElementById("card-overlay");
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeCard(); });
}

function openCard(places, placeId, map) {
  const overlay = document.getElementById("card-overlay");
  const card = document.getElementById("place-card");
  const idx = places.findIndex((p) => p.id === placeId);
  const p = places[idx];

  AudioGuide.stop();
  map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), 12), { duration: 0.8, padding: [120, 120] });

  const photo = document.getElementById("card-photo");
  photo.classList.toggle("no-photo", !p.photo);
  photo.querySelector("img").style.display = p.photo ? "" : "none";
  photo.querySelector("img").src = p.photo || "";
  photo.querySelector("img").alt = p.name;

  document.getElementById("card-tag").textContent =
    (SECTIONS.find((s) => s.id === p.section) || {}).page || "Калуга";
  document.getElementById("card-name").textContent = p.name;
  document.getElementById("card-text").textContent = p.short + " " + p.text;
  document.getElementById("card-geo").innerHTML =
    "<div>Адрес: <b>" + p.address + "</b></div>" +
    "<div>Время: " + p.hours + "</div>" +
    "<div>Осмотр: " + p.visit + "</div>";

  const oldAudio = document.getElementById("card-audio-btn");
  if (oldAudio) oldAudio.remove();
  const audioBtn = AudioGuideButton(p, "▶ Аудиогид");
  audioBtn.id = "card-audio-btn";
  audioBtn.style.fontFamily = '"Playfair Display", Georgia, serif';
  const actionsBox = document.querySelector("#place-card .card-actions");
  if (actionsBox) actionsBox.prepend(audioBtn);

  document.getElementById("card-route-btn").href = "https://yandex.ru/maps/?rtext=" + p.lon + "," + p.lat + "&rtt=mt";
  setCardRouteHref(places, p.id);
  document.getElementById("card-link").href = "place.html?id=" + p.id;
  document.getElementById("card-count").textContent =
    (idx + 1) + " из " + places.length + " · " + p.name;

  document.getElementById("card-prev").onclick = () => openCard(places, places[(idx - 1 + places.length) % places.length].id, map);
  document.getElementById("card-next").onclick = () => openCard(places, places[(idx + 1) % places.length].id, map);
  photo.onclick = () => {
    if (!p.photo) return;
    const lb = document.getElementById("lightbox");
    lb.querySelector("img").src = p.photo;
    lb.querySelector("img").alt = p.name;
    lb.classList.add("open");
  };

  overlay.classList.add("open");
  card.classList.add("open");
}

function closeCard() {
  AudioGuide.stop();
  document.getElementById("card-overlay").classList.remove("open");
  document.getElementById("place-card").classList.remove("open");
  document.getElementById("lightbox").classList.remove("open");
}

/* Кнопка «Проложить маршрут»: строим уличный маршрут «вы — место» на нашей карте,
   ссылка на Яндекс остаётся запасным вариантом (задана как href). */
function setCardRouteHref(places, placeId) {
  const btn = document.getElementById("card-route-btn");
  const p = places.find((x) => x.id === placeId);
  const map = window._sectionMaps && window._sectionMaps[0];
  if (!btn || !p || !map) return;
  btn.onclick = (e) => {
    e.preventDefault();
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    const old = btn.textContent;
    btn.textContent = "Строим маршрут…";
    Routing.userLocation()
      .then((from) => {
        const profile = Routing.distKm({ lat: from[0], lon: from[1] }, p) > 25 ? "driving" : "foot";
        return Routing.drawStreet(map, [
          { lat: from[0], lon: from[1] }, p
        ], { color: "#e8442e" }, profile);
      })
      .then(() => {
        delete btn.dataset.busy;
        btn.textContent = old;
        window._lastRouteMap = map;
        map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), 13));
        closeCard();
      })
      .catch(() => {
        delete btn.dataset.busy;
        btn.textContent = old;
        window.open(btn.href, "_blank", "noopener");
      });
  };
}
