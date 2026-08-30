import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import googleMapsConfigHandler from "../api/google-maps-config.js";
import googleRatingHandler from "../api/google-rating.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localEnvPath = path.join(projectRoot, ".env.local");
const localPort = Number.parseInt(process.env.GASTROGLOBE_PORT ?? "4318", 10);

function parseEnvLine(line) {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) return null;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [match[1], value];
}

try {
  const source = await readFile(localEnvPath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const pair = parseEnvLine(line);
    if (pair && process.env[pair[0]] === undefined) process.env[pair[0]] = pair[1];
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function sendText(response, status, text) {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(text);
}

async function serveStatic(request, response, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendText(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendText(response, 400, "Bad request");
    return;
  }
  if (pathname.split("/").some((segment) => segment.startsWith("."))) {
    sendText(response, 404, "Not found");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.resolve(projectRoot, relativePath);
  if (filePath !== projectRoot && !filePath.startsWith(projectRoot + path.sep)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const details = await stat(filePath);
    if (details.isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader("Content-Type", contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream");
    response.setHeader("Cache-Control", "no-store");
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    sendText(response, error?.code === "ENOENT" ? 404 : 500, error?.code === "ENOENT" ? "Not found" : "Server error");
  }
}

const apiHandlers = new Map([
  ["/api/google-maps-config", googleMapsConfigHandler],
  ["/api/google-rating", googleRatingHandler],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const handler = apiHandlers.get(url.pathname);
  if (handler) {
    request.query = Object.fromEntries(url.searchParams.entries());
    await handler(request, response);
    return;
  }
  await serveStatic(request, response, url);
});

server.listen(localPort, "127.0.0.1", () => {
  console.log(`GastroGlobe is running at http://127.0.0.1:${localPort}/`);
});
