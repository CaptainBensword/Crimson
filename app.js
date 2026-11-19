(function () {
  "use strict";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  let toastTimer = 0;
  let activeBlobUrl = null;

  function toast(message) {
    const box = $("#toast");
    box.textContent = message;
    box.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("visible"), 2600);
  }

  const pageNames = {
    overview: "OVERVIEW",
    client: "PLAY",
    mods: "MOD LIBRARY",
    appearance: "APPEARANCE",
    settings: "SETTINGS"
  };

  function showView(name) {
    if (!pageNames[name]) return;
    $$(".view").forEach(view => view.classList.toggle("active", view.id === "view-" + name));
    $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === name));
    $("#current-page").textContent = pageNames[name];
    history.replaceState(null, "", "#" + name);
    window.scrollTo({ top: 0, behavior: document.body.classList.contains("reduce-motion") ? "auto" : "smooth" });
  }

  $$(".nav-item").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
  $$("[data-go]").forEach(button => button.addEventListener("click", () => showView(button.dataset.go)));
  const initialView = location.hash.replace("#", "");
  if (pageNames[initialView]) showView(initialView);

  // IndexedDB keeps the user's patched client on this device, without uploading it
  const DB_NAME = "crimson-client-store";
  const DB_VERSION = 1;
  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("This browser does not support local client storage"));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("clients")) db.createObjectStore("clients", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local storage"));
    });
  }

  async function databaseAction(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("clients", mode);
      const store = transaction.objectStore("clients");
      let request;
      try { request = action(store); } catch (error) { db.close(); reject(error); return; }
      if (request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Storage operation failed"));
      } else {
        transaction.oncomplete = () => resolve(true);
      }
      transaction.onerror = () => reject(transaction.error || new Error("Storage transaction failed"));
      transaction.oncomplete = () => db.close();
    });
  }

  const getClientRecord = () => databaseAction("readonly", store => store.get("main"));
  const putClientRecord = record => databaseAction("readwrite", store => store.put(record));
  const deleteClientRecord = () => databaseAction("readwrite", store => store.delete("main"));

  function showStoredClient(record) {
    const name = $("#stored-client-name");
    const meta = $("#stored-client-meta");
    const badge = $("#stored-client-badge");
    if (!record) {
      name.textContent = "No patched client saved";
      meta.textContent = "Import a patched 1.12.2 HTML file";
      badge.textContent = "EMPTY";
      badge.classList.remove("ready");
      $("#client-state").textContent = "NO CLIENT LOADED";
      return;
    }
    name.textContent = record.name || "Crimson client";
    const mb = (record.size / 1048576).toFixed(1);
    meta.textContent = mb + " MB · saved in this browser";
    badge.textContent = "SAVED";
    badge.classList.add("ready");
    $("#client-state").textContent = "CLIENT SAVED";
  }

  async function refreshClientStatus() {
    try { showStoredClient(await getClientRecord()); }
    catch (error) {
      $("#client-note").textContent = error.message;
      $("#client-state").textContent = "STORAGE UNAVAILABLE";
    }
  }

  $("#import-client").addEventListener("click", () => $("#client-file-input").click());
  $("#client-file-input").addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) { toast("Choose an HTML client file"); return; }
    if (file.size < 2000000) { toast("That file looks too small to be a full Eaglercraft client"); return; }
    $("#import-client").disabled = true;
    $("#import-client").textContent = "CHECKING FILE…";
    try {
      const source = await file.text();
      if (!source.includes("1.12.2") || !source.includes("el-modapi")) {
        throw new Error("This needs to be a patched Eaglercraft 1.12.2 HTML file. Open the Crimson Patcher first");
      }
      await putClientRecord({ id: "main", name: file.name, size: file.size, blob: file, savedAt: Date.now() });
      await refreshClientStatus();
      toast("Patched client saved on this device");
    } catch (error) {
      toast(error.message || "Could not save that client file");
    } finally {
      $("#import-client").disabled = false;
      $("#import-client").innerHTML = "IMPORT PATCHED HTML";
    }
  });

  $("#launch-client").addEventListener("click", async () => {
    const tab = window.open("about:blank", "_blank");
    if (!tab) { toast("Allow pop-ups for Crimson, then launch again"); return; }
    tab.document.title = "Opening Crimson Client";
    tab.document.body.style.cssText = "background:#100c0e;color:#f3e8e6;font:14px monospace;padding:30px";
    tab.document.body.textContent = "Loading your saved client…";
    try {
      const record = await getClientRecord();
      if (!record || !record.blob) {
        tab.close();
        showView("client");
        toast("Import a patched client first");
        return;
      }
      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = URL.createObjectURL(record.blob);
      tab.location.replace(activeBlobUrl);
      $("#client-state").textContent = "CLIENT OPENED";
    } catch (error) {
      tab.close();
      toast(error.message || "Could not open the saved client");
    }
  });

  $("#remove-client").addEventListener("click", async () => {
    try {
      await deleteClientRecord();
      showStoredClient(null);
      toast("Saved client removed from this browser");
    } catch (error) { toast(error.message || "Could not remove saved client"); }
  });

  // Lightweight, original Minecraft-style pixel texture pack
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) { return [value & 255, (value >>> 8) & 255]; }
  function u32(value) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
  function joinBytes(parts) {
    let length = 0;
    parts.forEach(part => { length += part.length; });
    const out = new Uint8Array(length);
    let offset = 0;
    parts.forEach(part => { out.set(part, offset); offset += part.length; });
    return out;
  }

  async function canvasPNG(draw) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    draw(context);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not render a texture");
    return new Uint8Array(await blob.arrayBuffer());
  }

  function seeded(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  async function makeTexturePack() {
    const files = [];
    const add = async (path, draw) => files.push({ name: path, data: await canvasPNG(draw) });
    const noise = (ctx, colors, seed, count) => {
      const rand = seeded(seed);
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.fillRect(Math.floor(rand() * 16), Math.floor(rand() * 16), 1 + Math.floor(rand() * 2), 1 + Math.floor(rand() * 2));
      }
    };

    await add("assets/minecraft/textures/blocks/stone.png", ctx => {
      ctx.fillStyle = "#77777d"; ctx.fillRect(0,0,16,16);
      noise(ctx, ["#66666d","#898990","#a0a0a2","#585961","#777177"], 41, 75);
      ctx.fillStyle = "#a9a3a1"; ctx.fillRect(2,3,3,1); ctx.fillRect(11,10,2,1);
    });
    await add("assets/minecraft/textures/blocks/cobblestone.png", ctx => {
      ctx.fillStyle = "#55565b"; ctx.fillRect(0,0,16,16);
      const blocks = [[0,0,6,5],[7,0,5,4],[13,0,3,6],[0,6,4,4],[5,5,6,5],[12,7,4,4],[0,11,6,5],[7,11,5,5],[13,12,3,4]];
      blocks.forEach((b,i) => { ctx.fillStyle = ["#77777d","#89898c","#65656c","#707077"][i%4]; ctx.fillRect(...b); ctx.fillStyle = "#a3a1a0"; ctx.fillRect(b[0]+1,b[1]+1,Math.max(1,b[2]-3),1); });
      noise(ctx, ["#4d4d55","#b1a6a0"], 12, 20);
    });
    await add("assets/minecraft/textures/blocks/dirt.png", ctx => {
      ctx.fillStyle = "#79533d"; ctx.fillRect(0,0,16,16);
      noise(ctx, ["#63422f","#8c654a","#9a7250","#583b2e","#a07b58"], 3, 85);
    });
    await add("assets/minecraft/textures/blocks/grass_top.png", ctx => {
      ctx.fillStyle = "#66864b"; ctx.fillRect(0,0,16,16);
      noise(ctx, ["#587a40","#759653","#829c5a","#9aa76b","#4f713b"], 17, 72);
      ctx.fillStyle = "#d0c58a"; ctx.fillRect(4,2,1,1); ctx.fillRect(12,12,1,1);
    });
    await add("assets/minecraft/textures/blocks/grass_side.png", ctx => {
      ctx.fillStyle = "#79533d"; ctx.fillRect(0,0,16,16);
      ctx.fillStyle = "#66864b"; ctx.fillRect(0,0,16,4);
      noise(ctx, ["#587a40","#789652","#8ea66a"], 19, 28);
      noise(ctx, ["#63422f","#8c654a","#9a7250","#583b2e"], 21, 56);
      ctx.fillStyle = "#5d7b43"; ctx.fillRect(0,4,2,2); ctx.fillRect(11,4,2,1);
    });
    await add("assets/minecraft/textures/blocks/planks_oak.png", ctx => {
      ctx.fillStyle = "#9a7049"; ctx.fillRect(0,0,16,16);
      for (let y=0;y<16;y+=4) { ctx.fillStyle = y%8===0 ? "#b38355" : "#8b613d"; ctx.fillRect(0,y,16,1); ctx.fillStyle = "#c49561"; ctx.fillRect(2,y+1,12,1); }
      ctx.fillStyle = "#68462f"; ctx.fillRect(5,2,1,1); ctx.fillRect(6,3,1,1); ctx.fillRect(12,10,1,1);
      noise(ctx, ["#a97b4e","#785236"], 31, 18);
    });
    await add("assets/minecraft/textures/blocks/obsidian.png", ctx => {
      ctx.fillStyle = "#282331"; ctx.fillRect(0,0,16,16);
      noise(ctx, ["#392d43","#211d2e","#473047","#33263d"], 77, 65);
      ctx.strokeStyle = "#794057"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2,3); ctx.lineTo(5,6); ctx.lineTo(4,10); ctx.lineTo(9,13); ctx.stroke();
      ctx.fillStyle = "#b23b50"; ctx.fillRect(5,7,1,1); ctx.fillRect(9,12,1,1);
    });
    await add("assets/minecraft/textures/blocks/netherrack.png", ctx => {
      ctx.fillStyle = "#6d3036"; ctx.fillRect(0,0,16,16);
      noise(ctx, ["#8a4144","#55262f","#a14a48","#74343d","#b75b51"], 93, 90);
      ctx.fillStyle = "#cf7160"; ctx.fillRect(4,4,2,1); ctx.fillRect(11,12,2,1);
    });

    files.push({ name: "pack.mcmeta", data: new TextEncoder().encode(JSON.stringify({ pack: { pack_format: 3, description: "Crimson Client · Original 16x block textures" } }, null, 2)) });
    const icon = document.createElement("canvas");
    icon.width = 64; icon.height = 64;
    const cx = icon.getContext("2d");
    cx.fillStyle = "#191116"; cx.fillRect(0,0,64,64);
    cx.fillStyle = "#8d1c31"; cx.fillRect(11,11,42,42);
    cx.fillStyle = "#d94a5a"; cx.fillRect(17,17,30,30);
    cx.fillStyle = "#f2a3a6"; cx.fillRect(25,9,14,46);
    cx.fillStyle = "#5a1425"; cx.fillRect(9,25,46,14);
    const iconBlob = await new Promise(resolve => icon.toBlob(resolve,"image/png"));
    files.push({ name: "pack.png", data: new Uint8Array(await iconBlob.arrayBuffer()) });

    const locals = [];
    const centrals = [];
    let offset = 0;
    files.forEach(file => {
      const name = new TextEncoder().encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const local = joinBytes([
        new Uint8Array(u32(0x04034b50)), new Uint8Array(u16(20)), new Uint8Array(u16(0)), new Uint8Array(u16(0)),
        new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u32(crc)), new Uint8Array(u32(data.length)),
        new Uint8Array(u32(data.length)), new Uint8Array(u16(name.length)), new Uint8Array(u16(0)), name, data
      ]);
      const central = joinBytes([
        new Uint8Array(u32(0x02014b50)), new Uint8Array(u16(20)), new Uint8Array(u16(20)), new Uint8Array(u16(0)),
        new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u32(crc)),
        new Uint8Array(u32(data.length)), new Uint8Array(u32(data.length)), new Uint8Array(u16(name.length)),
        new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u16(0)), new Uint8Array(u32(0)),
        new Uint8Array(u32(offset)), name
      ]);
      locals.push(local); centrals.push(central); offset += local.length;
    });
    const centralData = joinBytes(centrals);
    const end = joinBytes([
      new Uint8Array(u32(0x06054b50)), new Uint8Array(u16(0)), new Uint8Array(u16(0)),
      new Uint8Array(u16(files.length)), new Uint8Array(u16(files.length)),
      new Uint8Array(u32(centralData.length)), new Uint8Array(u32(offset)), new Uint8Array(u16(0))
    ]);
    const zip = new Blob([...locals, centralData, end], { type: "application/zip" });
    const url = URL.createObjectURL(zip);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Crimson-Resource-Pack-1.12.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast("Crimson resource pack built");
  }

  $("#download-textures").addEventListener("click", makeTexturePack);
  $("#download-textures-side").addEventListener("click", makeTexturePack);

  // Launcher preferences
  const motionToggle = $("#reduce-motion");
  const savedMotion = localStorage.getItem("crimson-reduce-motion") === "true";
  motionToggle.checked = savedMotion;
  document.body.classList.toggle("reduce-motion", savedMotion);
  motionToggle.addEventListener("change", () => {
    const enabled = motionToggle.checked;
    document.body.classList.toggle("reduce-motion", enabled);
    localStorage.setItem("crimson-reduce-motion", String(enabled));
    toast(enabled ? "Reduced motion enabled" : "Motion restored");
  });

  // Pointer tilt on the block scene, capped to keep it subtle
  const scene = $("#voxel-scene");
  if (scene && window.matchMedia("(pointer:fine)").matches) {
    scene.addEventListener("pointermove", event => {
      if (document.body.classList.contains("reduce-motion")) return;
      const rect = scene.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      scene.style.setProperty("--scene-tilt-x", (y * -4).toFixed(2) + "deg");
      scene.style.setProperty("--scene-tilt-y", (x * 5).toFixed(2) + "deg");
    }, { passive: true });
    scene.addEventListener("pointerleave", () => {
      scene.style.setProperty("--scene-tilt-x", "0deg");
      scene.style.setProperty("--scene-tilt-y", "0deg");
    });
  }

  refreshClientStatus();
})();