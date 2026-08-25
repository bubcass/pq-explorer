import * as turf from "npm:@turf/turf@7.3.4";

const STORAGE_KEY = "pq-explorer:selected-constituency";

export function readSavedConstituency(availableConstituencies = []) {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return availableConstituencies.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function saveSelectedConstituency(constituency) {
  if (typeof window === "undefined" || !constituency) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, constituency);
  } catch {
    // Storage is an enhancement; selection still works without it.
  }
}

export function findConstituencyForCoordinates({
  longitude,
  latitude,
  constituencyGeoJSON,
  availableConstituencies = [],
} = {}) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  const locationPoint = turf.point([longitude, latitude]);
  const feature = (constituencyGeoJSON?.features ?? []).find((candidate) => {
    try {
      return turf.booleanPointInPolygon(locationPoint, candidate);
    } catch {
      return false;
    }
  });
  const constituency = cleanConstituencyName(feature?.properties?.ENG_NAME_VALUE);

  return constituency && availableConstituencies.includes(constituency)
    ? constituency
    : null;
}

export async function detectConstituencyFromLocation({
  constituencyGeoJSON,
  availableConstituencies = [],
  prompt = false,
  timeout = 6500,
} = {}) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {ok: false, reason: "unsupported"};
  }

  if (!prompt) {
    if (!navigator.permissions?.query) {
      return {ok: false, reason: "permission-unknown"};
    }

    try {
      const permission = await navigator.permissions.query({name: "geolocation"});
      if (permission.state !== "granted") {
        return {ok: false, reason: permission.state};
      }
    } catch {
      return {ok: false, reason: "permission-unknown"};
    }
  }

  const position = await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (value) => resolve({ok: true, value}),
      (error) => resolve({ok: false, error}),
      {
        enableHighAccuracy: false,
        timeout,
        maximumAge: 10 * 60 * 1000,
      },
    );
  });

  if (!position.ok) {
    const reason = position.error?.code === 1
      ? "denied"
      : position.error?.code === 3
        ? "timeout"
        : "unavailable";
    return {ok: false, reason};
  }

  const {latitude, longitude} = position.value.coords;
  const constituency = findConstituencyForCoordinates({
    longitude,
    latitude,
    constituencyGeoJSON,
    availableConstituencies,
  });

  return constituency
    ? {ok: true, constituency}
    : {ok: false, reason: "outside"};
}

function cleanConstituencyName(value) {
  return String(value ?? "").replace(/\s*\(\d+\)\s*$/, "").trim();
}
