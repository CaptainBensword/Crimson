const CATEGORIES = new Set(["sheet-music", "game-music", "podcast-video", "compositions", "other"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000;

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
  if (origin && origin === env.ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(request, env, payload, status) {
  const headers = new Headers(corsHeaders(request, env));
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(payload), { status: status || 200, headers });
}

function originAllowed(request, env) {
  return request.headers.get("Origin") === env.ALLOWED_ORIGIN;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToText(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function base64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64Url(new Uint8Array(signature));
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function createSession(secret) {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    expires: Date.now() + TOKEN_LIFETIME_MS,
    nonce: crypto.randomUUID()
  })));
  return payload + "." + await sign(payload, secret);
}

async function verifySession(request, secret) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(header);
  if (!match) return false;
  const parts = match[1].split(".");
  if (parts.length !== 2) return false;
  const expected = await sign(parts[0], secret);
  if (!constantTimeEqual(parts[1], expected)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/") + "===".slice((parts[0].length + 3) % 4)), c => c.charCodeAt(0))));
    return Number(payload.expires) > Date.now();
  } catch (error) {
    return false;
  }
}

function githubHeaders(env) {
  return {
    "Authorization": "Bearer " + env.GITHUB_TOKEN,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Crimson-Admin"
  };
}

async function githubRequest(env, path, options) {
  const response = await fetch("https://api.github.com/repos/" + env.REPO_OWNER + "/" + env.REPO_NAME + "/" + path, {
    ...options,
    headers: { ...githubHeaders(env), ...(options && options.headers ? options.headers : {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && data.message ? data.message : "GitHub request failed";
    throw new Error(message + " (" + response.status + ")");
  }
  return data;
}

async function readCatalog(env) {
  const file = await githubRequest(env, "contents/music.json?ref=" + encodeURIComponent(env.REPO_BRANCH || "main"));
  const catalog = JSON.parse(base64ToText(file.content || ""));
  if (!Array.isArray(catalog)) throw new Error("music.json is not a JSON array");
  return { catalog, sha: file.sha };
}

async function writeRepoFile(env, path, bytes, message) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return githubRequest(env, "contents/" + encodedPath, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message,
      content: bytesToBase64(bytes),
      branch: env.REPO_BRANCH || "main"
    })
  });
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "piece";
}

function extension(file) {
  const name = file.name || "";
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

async function storeFormFile(env, form, field, directory, allowedExtensions, pieceSlug) {
  const file = form.get(field);
  if (!(file instanceof File) || !file.size) return "";
  if (file.size > MAX_FILE_BYTES) throw new Error(file.name + " is larger than 8 MB.");
  const ext = extension(file);
  if (!allowedExtensions.includes(ext)) throw new Error("File type is not allowed for " + field + ".");
  const unique = crypto.randomUUID().slice(0, 8);
  const path = directory + "/" + pieceSlug + "-" + unique + ext;
  await writeRepoFile(env, path, new Uint8Array(await file.arrayBuffer()), "Add " + field + " for " + pieceSlug);
  return path;
}

async function addPiece(env, request) {
  const form = await request.formData();
  const title = String(form.get("title") || "").trim().slice(0, 120);
  const category = String(form.get("category") || "other");
  const project = String(form.get("project") || "").trim().slice(0, 100);
  const description = String(form.get("description") || "").trim().slice(0, 1200);
  const dateInput = String(form.get("date") || "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? dateInput : new Date().toISOString().slice(0, 10);
  const genres = String(form.get("genres") || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 8);

  if (!title) throw new Error("Add a title first.");
  if (!CATEGORIES.has(category)) throw new Error("Choose a valid collection.");

  const slug = slugify(title);
  const audio = await storeFormFile(env, form, "audio", "music/audio", [".mp3", ".wav", ".ogg", ".m4a"], slug);
  const score = await storeFormFile(env, form, "score", "music/scores", [".pdf"], slug);
  const midi = await storeFormFile(env, form, "midi", "music/midi", [".mid", ".midi"], slug);
  const musicxml = await storeFormFile(env, form, "musicxml", "music/musicxml", [".musicxml", ".xml"], slug);

  if (!audio && !score && !midi && !musicxml) throw new Error("Attach at least one supported file.");

  const result = await readCatalog(env);
  const id = slug + "-" + crypto.randomUUID().slice(0, 6);
  const entry = { id, title, category, project, description, date, genres };
  if (audio) entry.audio = audio;
  if (score) entry.score = score;
  const files = [];
  if (midi) files.push({ label: "MIDI", file: midi });
  if (musicxml) files.push({ label: "MusicXML", file: musicxml });
  if (files.length) entry.files = files;

  result.catalog.push(entry);
  const body = new TextEncoder().encode(JSON.stringify(result.catalog, null, 2) + "\n");
  const encodedPath = "contents/music.json";
  const response = await fetch("https://api.github.com/repos/" + env.REPO_OWNER + "/" + env.REPO_NAME + "/" + encodedPath, {
    method: "PUT",
    headers: { ...githubHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Publish " + title + " to Crimson",
      content: bytesToBase64(body),
      sha: result.sha,
      branch: env.REPO_BRANCH || "main"
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data.message || "Could not update the catalog") + " (" + response.status + ")");
  return { message: "Published “" + title + "”. GitHub Pages will update automatically.", entry };
}

async function handle(request, env) {
  const url = new URL(request.url);
  const headers = corsHeaders(request, env);
  if (request.method === "OPTIONS") {
    if (!originAllowed(request, env)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers });
  }
  if (!originAllowed(request, env)) return json(request, env, { error: "Origin not allowed." }, 403);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json(request, env, { ok: true, service: "Crimson Admin" });
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json(request, env, { error: "Admin secrets are not configured." }, 503);
    const body = await request.json().catch(() => ({}));
    const supplied = typeof body.password === "string" ? body.password : "";
    if (!constantTimeEqual(supplied, env.ADMIN_PASSWORD)) return json(request, env, { error: "Incorrect password." }, 401);
    const token = await createSession(env.SESSION_SECRET);
    return json(request, env, { token, expiresIn: TOKEN_LIFETIME_MS });
  }

  const protectedRoute = url.pathname.startsWith("/api/admin/");
  if (protectedRoute) {
    if (!env.SESSION_SECRET || !(await verifySession(request, env.SESSION_SECRET))) {
      return json(request, env, { error: "Sign in again to continue." }, 401);
    }
  }

  if (url.pathname === "/api/admin/session" && request.method === "GET") {
    return json(request, env, { authenticated: true });
  }
  if (url.pathname === "/api/admin/catalog" && request.method === "GET") {
    const result = await readCatalog(env);
    return json(request, env, { catalog: result.catalog });
  }
  if (url.pathname === "/api/admin/add-piece" && request.method === "POST") {
    const result = await addPiece(env, request);
    return json(request, env, result);
  }
  return json(request, env, { error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      return json(request, env, { error: error && error.message ? error.message : "Unexpected server error." }, 500);
    }
  }
};
