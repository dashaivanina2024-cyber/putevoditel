/* Прокладка маршрутов: уличная линия через OSRM (демо-сервер, без ключей)
   + ссылки «открыть в Яндекс.Карты» с промежуточными точками.
   Хелперы:
     Routing.streetRoute(points, profile) → Promise<{line, distance, duration}>
     Routing.yandexHref(points, profile)  → href кибер-карт с точками
     Routing.userLocation()               → Promise<[lat, lon]> (fallback: центр Калуги)
     Routing.drawStreet(map, points, style, profile)
*/
(function () {
  var OSRM = "https://router.project-osrm.org/route/v1";
  var KALUGA = [54.5078, 36.2500];

  function coordsParam(places) {
    return places.map(function (p) { return p.lon + "," + p.lat; }).join(";");
  }

  /* Расстояние по прямой, км */
  function distKm(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /* Уличный маршрут через все точки. profile: foot | driving */
  function streetRoute(places, profile) {
    var url = OSRM + "/" + (profile || "foot") + "/" + coordsParam(places) + "?overview=full&geometries=geojson";
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.code !== "Ok" || !d.routes || !d.routes.length) throw new Error("OSRM: " + d.code);
        return {
          line: d.routes[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; }),
          distance: d.routes[0].distance,
          duration: d.routes[0].duration
        };
      });
  }

  /* Ссылка в Яндекс.Карты: маршрут через все точки (до 10 штук).
     foot → пешеход "mt" (транспорт/пешком), driving → "auto". */
  function yandexHref(places, profile) {
    var mode = profile === "driving" ? "auto" : "mt";
    var src = places.slice(0, 10).map(function (p) { return p.lon + "," + p.lat; }).join("~");
    return "https://yandex.ru/maps/?rtext=" + src + "&rtt=" + mode;
  }

  /* Геолокация посетителя; без разрешения/таймаута — центр Калуги */
  function userLocation() {
    if (!navigator.geolocation) return Promise.resolve(KALUGA);
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(KALUGA); } }, 5000);
      navigator.geolocation.getCurrentPosition(
        function (pos) { if (!done) { done = true; clearTimeout(t); resolve([pos.coords.latitude, pos.coords.longitude]); } },
        function () { if (!done) { done = true; clearTimeout(t); resolve(KALUGA); } },
        { enableHighAccuracy: false, timeout: 4500, maximumAge: 600000 }
      );
    });
  }

  /* Рисует уличную линию (+тень) и вписывает в кадр */
  function drawStreet(map, places, style, profile) {
    return streetRoute(places, profile).then(function (route) {
      var line = L.polyline(route.line, Object.assign({
        color: "#e8442e", weight: 5, opacity: .95, lineCap: "round", dashArray: "1 9"
      }, style || {})).addTo(map);
      var shadow = L.polyline(route.line, {
        color: "rgba(0,0,0,.25)", weight: 9, opacity: .35
      }).addTo(map).bringToBack();
      map.fitBounds(line.getBounds(), { padding: [40, 40] });
      return { distance: route.distance, duration: route.duration, layer: L.layerGroup([line, shadow]) };
    });
  }

  window.Routing = {
    distKm: distKm,
    streetRoute: streetRoute,
    yandexHref: yandexHref,
    userLocation: userLocation,
    drawStreet: drawStreet
  };
})();
