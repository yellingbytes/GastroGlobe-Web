function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(JSON.stringify(payload));
}

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_BROWSER_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { error: "google_maps_browser_not_configured" });
    return;
  }

  sendJson(response, 200, { apiKey });
}
