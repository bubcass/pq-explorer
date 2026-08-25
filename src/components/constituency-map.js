import L from "npm:leaflet@1.9.4";
import * as turf from "npm:@turf/turf@7.3.4";

const BLANK_TILE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function cleanConstituencyLabel(name) {
  return String(name ?? "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim();
}

function constituencyStyle() {
  return {
    fillColor: "#7f6c2e",
    weight: 2,
    opacity: 1,
    color: "#8a8a8a",
    dashArray: 1,
    fillOpacity: 0.16,
  };
}

function polygonsOnly(input) {
  const out = [];

  const visit = (obj, props = {}) => {
    if (!obj) return;

    switch (obj.type) {
      case "FeatureCollection":
        obj.features?.forEach((f) => visit(f));
        break;
      case "Feature":
        visit(obj.geometry, obj.properties || {});
        break;
      case "GeometryCollection":
        (obj.geometries || []).forEach((g) => visit(g, props));
        break;
      case "Polygon":
        out.push(turf.polygon(obj.coordinates, props));
        break;
      case "MultiPolygon":
        out.push(turf.multiPolygon(obj.coordinates, props));
        break;
    }
  };

  visit(input);
  return out;
}

export function constituencyMap(featureCollection, options = {}) {
  const {
    height = 540,
    enableGeolocation = true,
    geolocationBufferMetres = 10,
    onLocate = null,
    popupFormatter = (feature) => {
      const raw = feature?.properties?.ENG_NAME_VALUE ?? "Constituency";
      const cleaned = cleanConstituencyLabel(raw);
      return `This is the <strong>${cleaned}</strong> constituency.`;
    },
  } = options;

  const container = document.createElement("div");
  container.className = "constituency-map";
  container.style.height = `${height}px`;
  container.style.width = "100%";
  container.style.position = "relative";

  const cleanupStyle = document.createElement("style");
  cleanupStyle.textContent = `
    .leaflet-default-icon-path {
      display: none !important;
    }
    .leaflet-pane > svg,
    .leaflet-overlay-pane svg {
      overflow: visible;
    }
    .leaflet-interactive {
      vector-effect: non-scaling-stroke;
    }

    .leaflet-control-fullscreen.leaflet-bar a,
    .leaflet-control-geolocate.leaflet-bar button {
      width: 34px;
      height: 34px;
      line-height: 34px;
      text-align: center;
      font-size: 18px;
      text-decoration: none;
      background: #fff;
      border: 0;
      padding: 0;
      cursor: pointer;
      display: block;
    }

    .leaflet-control-geolocate.leaflet-bar button:hover {
      background: #f5f5f5;
    }

    .constituency-map:fullscreen {
      width: 100vw !important;
      height: 100vh !important;
    }

    .constituency-map:-webkit-full-screen {
      width: 100vw !important;
      height: 100vh !important;
    }

    .constituency-map.is-fs {
      position: fixed !important;
      inset: 0;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 10000;
      background: #fff;
    }
  `;
  container.appendChild(cleanupStyle);

  const status = document.createElement("div");
  status.style.cssText = `
    position:absolute;
    top:8px;
    left:8px;
    background:rgba(255,255,255,0.95);
    padding:6px 8px;
    border-radius:8px;
    font:12px "IBM Plex Sans", sans-serif;
    box-shadow:0 1px 3px rgba(0,0,0,0.15);
    z-index:500;
  `;
  status.innerHTML = "<strong>Location:</strong> constituency view";
  container.appendChild(status);

  const map = L.map(container, {
    zoomControl: false,
  });

  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com">Leaflet</a>',
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    errorTileUrl: BLANK_TILE,
    detectRetina: true,
  }).addTo(map);

  const geoLayer = L.geoJSON(featureCollection, {
    renderer: L.svg(),
    style: constituencyStyle,
    onEachFeature(feature, layer) {
      layer.bindPopup(popupFormatter(feature), {
        minWidth: 190,
        maxWidth: 240,
      });
    },
  }).addTo(map);

  let polygons = polygonsOnly(featureCollection);

  if (geolocationBufferMetres > 0 && polygons.length) {
    polygons = polygons.map((p) =>
      turf.buffer(p, geolocationBufferMetres, { units: "meters" }),
    );
  }

  const userLayer = L.layerGroup().addTo(map);

  function refitMap() {
    setTimeout(() => {
      map.invalidateSize();
      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [28, 28],
          maxZoom: 11,
        });
      }
    }, 120);
  }

  function clearUserLocation() {
    userLayer.clearLayers();
  }

  function locateUser() {
    if (!navigator.geolocation) {
      status.innerHTML = "<strong>Location:</strong> unavailable";

      if (typeof onLocate === "function") {
        onLocate({
          ok: false,
          reason: "unsupported",
        });
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearUserLocation();

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = position.coords.accuracy ?? 0;
        const latlng = L.latLng(lat, lon);

        const accuracyCircle = L.circle(latlng, {
          radius: accuracy,
          color: "#4a463d",
          weight: 1,
          opacity: 0.7,
          fillColor: "#4a463d",
          fillOpacity: 0.12,
        });

        const userMarker = L.circleMarker(latlng, {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#4a463d",
          fillOpacity: 1,
        }).bindTooltip("Your location", {
          direction: "top",
          offset: [0, -4],
        });

        userLayer.addLayer(accuracyCircle);
        userLayer.addLayer(userMarker);

        const pt = turf.point([lon, lat]);
        const inside = polygons.some((poly) =>
          turf.booleanPointInPolygon(pt, poly),
        );

        status.innerHTML = inside
          ? "<strong>Location:</strong> inside constituency"
          : "<strong>Location:</strong> outside constituency";

        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          const combined = L.latLngBounds(bounds);
          combined.extend(latlng);

          map.fitBounds(combined, {
            padding: [28, 28],
            maxZoom: 11,
          });
        } else {
          map.setView(latlng, 11);
        }

        if (typeof onLocate === "function") {
          onLocate({
            ok: true,
            lat,
            lon,
            accuracy,
            inside,
          });
        }
      },
      (error) => {
        let message = "unavailable";

        if (error?.code === 1) message = "permission denied";
        else if (error?.code === 2) message = "position unavailable";
        else if (error?.code === 3) message = "timed out";

        status.innerHTML = `<strong>Location:</strong> ${message}`;

        if (typeof onLocate === "function") {
          onLocate({
            ok: false,
            reason: "error",
            error,
          });
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000,
      },
    );
  }

  if (enableGeolocation) {
    const GeolocateControl = L.Control.extend({
      options: { position: "bottomright" },
      onAdd: () => {
        const ctl = L.DomUtil.create(
          "div",
          "leaflet-control-geolocate leaflet-bar",
        );

        const button = L.DomUtil.create("button", "", ctl);
        button.type = "button";
        button.title = "Show my location";
        button.setAttribute("aria-label", "Show my location");
        button.textContent = "⌖";

        L.DomEvent.disableClickPropagation(ctl);
        L.DomEvent.disableScrollPropagation(ctl);

        L.DomEvent.on(button, "click", (e) => {
          L.DomEvent.stop(e);
          locateUser();
        });

        return ctl;
      },
    });

    new GeolocateControl().addTo(map);
  }

  const FullscreenControl = L.Control.extend({
    options: { position: "bottomright" },
    onAdd: () => {
      const ctl = L.DomUtil.create(
        "div",
        "leaflet-control-fullscreen leaflet-bar",
      );
      const link = L.DomUtil.create("a", "", ctl);
      link.href = "#";
      link.title = "Toggle fullscreen";
      link.setAttribute("aria-label", "Toggle fullscreen");
      link.innerHTML = "⛶";

      const isFsAPI = () =>
        document.fullscreenElement === container ||
        document.webkitFullscreenElement === container;

      const enterFsAPI = async () => {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        }
      };

      const exitFsAPI = async () => {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      };

      let fallbackActive = false;

      const enterFallback = () => {
        fallbackActive = true;
        container.classList.add("is-fs");
        document.body.style.overflow = "hidden";
        refitMap();
      };

      const exitFallback = () => {
        fallbackActive = false;
        container.classList.remove("is-fs");
        document.body.style.overflow = "";
        refitMap();
      };

      L.DomEvent.on(link, "click", (e) => {
        L.DomEvent.stop(e);
        (async () => {
          try {
            if (isFsAPI()) {
              await exitFsAPI();
            } else {
              await enterFsAPI();
            }
          } catch {
            if (fallbackActive) exitFallback();
            else enterFallback();
          }
        })();
      });

      ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => {
        document.addEventListener(ev, refitMap);
      });

      return ctl;
    },
  });

  new FullscreenControl().addTo(map);

  const layers = geoLayer.getLayers();

  if (layers.length > 0) {
    layers.forEach((layer) => {
      if (layer.setStyle) layer.setStyle(constituencyStyle());
      if (layer.bringToFront) layer.bringToFront();
    });

    requestAnimationFrame(() => {
      map.invalidateSize();

      const bounds = geoLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [28, 28],
          maxZoom: 11,
        });
      }

      const firstLayer = layers[0];
      if (firstLayer) firstLayer.openPopup();
    });
  } else {
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.setView([53.4, -8.0], 6);
    });
  }

  return container;
}
