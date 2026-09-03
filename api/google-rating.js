const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACE_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.googleMapsUri",
].join(",");

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(JSON.stringify(payload));
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function finiteCoordinate(value) {
  const parsed = Number.parseFloat(firstQueryValue(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { error: "google_places_not_configured" });
    return;
  }

  const name = String(firstQueryValue(request.query?.name) ?? "").trim().slice(0, 180);
  const address = String(firstQueryValue(request.query?.address) ?? "").trim().slice(0, 240);
  const city = String(firstQueryValue(request.query?.city) ?? "").trim().slice(0, 100);
  const requestedRegion = String(firstQueryValue(request.query?.region) ?? "").trim().toUpperCase();
  const regionCode = /^[A-Z]{2}$/.test(requestedRegion) ? requestedRegion : "DE";
  const latitude = finiteCoordinate(request.query?.lat);
  const longitude = finiteCoordinate(request.query?.lng);

  if (!name) {
    sendJson(response, 400, { error: "restaurant_name_required" });
    return;
  }

  const requestBody = {
    textQuery: [name, address || city].filter(Boolean).join(", "),
    pageSize: 1,
    languageCode: "en",
    regionCode,
  };

  if (latitude !== null && longitude !== null) {
    requestBody.locationBias = {
      circle: {
        center: { latitude, longitude },
        radius: 350,
      },
    };
  }

  try {
    const googleResponse = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_PLACE_FIELDS,
      },
      body: JSON.stringify(requestBody),
    });

    if (!googleResponse.ok) {
      sendJson(response, 502, { error: "google_places_request_failed" });
      return;
    }

    const payload = await googleResponse.json();
    const place = payload.places?.[0];
    if (!place || !Number.isFinite(place.rating)) {
      sendJson(response, 404, { error: "google_rating_not_found" });
      return;
    }

    sendJson(response, 200, {
      rating: place.rating,
      googleMapsUri: place.googleMapsUri ?? null,
      placeId: place.id ?? null,
    });
  } catch {
    sendJson(response, 502, { error: "google_places_unavailable" });
  }
}
