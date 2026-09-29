/* Слои POI (кафе/туалеты/транспорт) + переключатель категорий над любой картой. */

/* Плитки OpenStreetMap — без ключей и регистраций. */
function makeTiles(map) {
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; участники <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);
}

function poiIcons(kind) {
  const map = {
    food:      { emoji: "☕", label: "Еда",      color: "#b4632e" },
    wc:        { emoji: "🚻", label: "Туалеты",  color: "#2e6fb4" },
    transport: { emoji: "🚌", label: "Транспорт", color: "#2e8b6a" }
  };
  return map[kind];
}

function poiCityCheck(p) {
  return p.lat > 54.4 && p.lon > 36.19;
}

/* config: { kind: "food"|"wc"|"transport", scope: "city"|"all" } */
function addPoiControls(map) {
  const kinds = ["food", "wc", "transport"];
  const layers = {};
  kinds.forEach((kind) => {
    layers[kind] = L.layerGroup();
    POI[kind].forEach((p) => {
      const inCity = poiCityCheck(p);
      const st = poiIcons(kind);
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: "",
          html: '<div class="poi-pin" style="--poi:' + st.color + '">' + st.emoji + "</div>",
          iconSize: [30, 30], iconAnchor: [15, 15]
        }),
        title: p.name
      }).addTo(layers[kind])
        .bindPopup('<b>' + p.name + '</b><br>' + (p.note || "") +
          '<br><a href="https://yandex.ru/maps/?pt=' + p.lon + ',' + p.lat + '&z=18" target="_blank" rel="noopener">Открыть на карте ↗</a>')
        .bindTooltip(p.name, { direction: "top", offset: [0, -8] });
      if (!inCity) layers[kind].countryExtra = true;
    });
  });

  const box = L.control({ position: "topright" });
  box.onAdd = function () {
    const d = L.DomUtil.create("div", "poi-box");
    d.innerHTML = '<div class="poi-box-title">Сервис</div>';
    kinds.forEach((kind) => {
      const st = poiIcons(kind);
      const label = L.DomUtil.create("label", "poi-chip");
      label.innerHTML =
        '<input type="checkbox" data-kind="' + kind + '"> ' +
        '<span style="--poi:' + st.color + '">' + st.emoji + "</span> " + st.label;
      const input = label.querySelector("input");
      input.onchange = () => { if (input.checked) layers[kind].addTo(map); else map.removeLayer(layers[kind]); };
      d.appendChild(label);
    });
    L.DomEvent.disableClickPropagation(d);
    return d;
  };
  box.addTo(map);

  /* Слои выключены по умолчанию, чтобы карта осталась спокойной */
  return layers;
}
