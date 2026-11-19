(function () {
  "use strict";

  const apiBase = String(window.CRIMSON_ADMIN_API || "").trim().replace(/\/+$/, "");
  let sessionToken = sessionStorage.getItem("crimson-admin-session") || "";

  const el = {
    status: document.getElementById("admin-status"),
    loginPanel: document.getElementById("login-panel"),
    loginForm: document.getElementById("login-form"),
    password: document.getElementById("admin-password"),
    dashboard: document.getElementById("dashboard"),
    logout: document.getElementById("logout-button"),
    pieceForm: document.getElementById("piece-form"),
    catalog: document.getElementById("admin-catalog"),
    count: document.getElementById("admin-catalog-count"),
    refresh: document.getElementById("refresh-button")
  };

  function say(message, kind) {
    el.status.textContent = message;
    el.status.className = "admin-status" + (kind ? " is-" + kind : "");
  }

  async function request(path, options) {
    const config = options || {};
    const headers = new Headers(config.headers || {});
    if (sessionToken) headers.set("Authorization", "Bearer " + sessionToken);
    const response = await fetch(apiBase + path, {
      method: config.method || "GET",
      headers: headers,
      body: config.body,
      cache: "no-store"
    });
    let data = {};
    try { data = await response.json(); } catch (error) {}
    if (!response.ok) throw new Error(data.error || "Request failed (" + response.status + ")");
    return data;
  }

  function showLogin() {
    el.loginPanel.hidden = false;
    el.dashboard.hidden = true;
  }

  function renderCatalog(items) {
    el.catalog.replaceChildren();
    el.count.textContent = items.length + (items.length === 1 ? " piece published" : " pieces published");
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "admin-catalog-empty";
      empty.textContent = "The catalog is empty.";
      el.catalog.appendChild(empty);
      return;
    }
    items.slice().reverse().forEach(function (item) {
      const row = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = item.title;
      const meta = document.createElement("span");
      const collection = {
        "sheet-music":"Sheet Music",
        "game-music":"Game Music",
        "podcast-video":"Podcast & Video",
        "compositions":"Compositions",
        "other":"Other"
      }[item.category] || "Other";
      meta.textContent = [collection, item.project, item.date].filter(Boolean).join(" · ");
      row.append(title, meta);
      el.catalog.appendChild(row);
    });
  }

  async function loadCatalog() {
    const data = await request("/api/admin/catalog");
    renderCatalog(Array.isArray(data.catalog) ? data.catalog : []);
  }

  async function checkSession() {
    if (!apiBase) {
      say("Admin is not connected yet. The private Worker must be deployed and its URL added to admin-config.js. No password is checked or stored on this public page.", "warning");
      showLogin();
      el.password.disabled = true;
      el.loginForm.querySelector("button").disabled = true;
      return;
    }
    el.password.disabled = false;
    el.loginForm.querySelector("button").disabled = false;
    if (!sessionToken) {
      say("Admin connection ready. Sign in to continue.", "neutral");
      showLogin();
      return;
    }
    try {
      await request("/api/admin/session");
      el.loginPanel.hidden = true;
      el.dashboard.hidden = false;
      say("Signed in. Changes are saved directly to the Crimson repository.", "success");
      await loadCatalog();
    } catch (error) {
      sessionToken = "";
      sessionStorage.removeItem("crimson-admin-session");
      showLogin();
      say("Please sign in again.", "warning");
    }
  }

  el.loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!apiBase) return;
    const submit = el.loginForm.querySelector("button");
    submit.disabled = true;
    submit.textContent = "Signing in…";
    try {
      const data = await request("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: el.password.value })
      });
      sessionToken = data.token;
      sessionStorage.setItem("crimson-admin-session", sessionToken);
      el.password.value = "";
      el.loginPanel.hidden = true;
      el.dashboard.hidden = false;
      say("Signed in. Loading catalog…", "success");
      await loadCatalog();
    } catch (error) {
      say(error.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });

  el.logout.addEventListener("click", function () {
    sessionToken = "";
    sessionStorage.removeItem("crimson-admin-session");
    showLogin();
    say("Signed out.", "neutral");
  });

  el.refresh.addEventListener("click", async function () {
    el.refresh.disabled = true;
    try {
      await loadCatalog();
      say("Catalog refreshed.", "success");
    } catch (error) {
      say(error.message, "error");
    } finally {
      el.refresh.disabled = false;
    }
  });

  el.pieceForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const submit = el.pieceForm.querySelector('button[type="submit"]');
    const formData = new FormData(el.pieceForm);
    const hasFile = ["audio","score","midi","musicxml"].some(function (field) {
      const file = formData.get(field);
      return file instanceof File && file.size > 0;
    });
    if (!hasFile) {
      say("Attach at least one file before publishing.", "warning");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Uploading and publishing…";
    say("Uploading files and updating the public catalog…", "neutral");
    try {
      const result = await request("/api/admin/add-piece", {
        method: "POST",
        body: formData
      });
      el.pieceForm.reset();
      await loadCatalog();
      say(result.message || "Piece published. GitHub Pages will update automatically.", "success");
    } catch (error) {
      say(error.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Add to Crimson";
    }
  });

  checkSession();
}());
