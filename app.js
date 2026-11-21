(function () {
  "use strict";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const frame = $("#game-frame");
  const bootScreen = $("#boot-screen");
  const bootStage = $("#boot-stage");
  const bootPercent = $("#boot-percent");
  const bootProgress = $("#boot-progress");
  const bootStartedAt = Date.now();
  let bootFinished = false;
  const installView = $("#install-view");
  const fileInput = $("#client-file");
  const fileDrop = $("#file-drop");
  const status = $("#install-status");
  const chip = $("#crimson-chip");
  const panel = $("#crimson-panel");
  const patcherFrame = $("#patcher-worker");
  const DB_NAME = "crimson-client-store";
  const DB_VERSION = 2;
  let gameUrl = null;
  let toastTimer = 0;
  let patcherPromise = null;

  function setBootProgress(stage, percent) {
    if (!bootScreen) return;
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    if (bootStage) bootStage.textContent = stage;
    if (bootPercent) bootPercent.textContent = String(Math.round(value)).padStart(2, "0");
    if (bootProgress) bootProgress.style.width = value + "%";
  }

  function finishBootScreen() {
    if (!bootScreen || bootFinished) return;
    bootFinished = true;
    const delay = Math.max(0, 1250 - (Date.now() - bootStartedAt));
    window.setTimeout(() => {
      setBootProgress("CLIENT READY", 100);
      bootScreen.classList.add("is-leaving");
      window.setTimeout(() => { bootScreen.hidden = true; }, 450);
    }, delay);
  }

  function notify(message) {
    const box = $("#client-toast");
    box.textContent = message;
    box.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("visible"), 2600);
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "install-status" + (kind ? " " + kind : "");
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("This browser does not support local client storage."));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("clients")) db.createObjectStore("clients", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open browser storage."));
    });
  }

  async function dbAction(mode, operation) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("clients", mode);
      const store = tx.objectStore("clients");
      let request;
      try { request = operation(store); }
      catch (error) { db.close(); reject(error); return; }
      if (request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Browser storage operation failed."));
      } else {
        tx.oncomplete = () => resolve(true);
      }
      tx.onerror = () => reject(tx.error || new Error("Browser storage transaction failed."));
      tx.oncomplete = () => db.close();
    });
  }

  const getSavedClient = () => dbAction("readonly", store => store.get("main"));
  const saveClient = record => dbAction("readwrite", store => store.put(record));
  const deleteSavedClient = () => dbAction("readwrite", store => store.delete("main"));

  function showInstaller(message, kind) {
    frame.hidden = true;
    frame.removeAttribute("src");
    chip.hidden = true;
    panel.hidden = true;
    installView.hidden = false;
    document.body.classList.remove("playing");
    if (message) setStatus(message, kind);
  }

  function startGame(blob) {
    if (!(blob instanceof Blob)) throw new Error("The saved game file is missing");
    if (gameUrl) URL.revokeObjectURL(gameUrl);
    gameUrl = URL.createObjectURL(blob);
    frame.onload = () => {
      try {
        const gameDocument = frame.contentDocument;
        const skip = gameDocument && gameDocument.getElementById("skipCountdown");
        if (skip) skip.click();
        frame.contentWindow.focus();
      } catch (_) {}
      setBootProgress("CLIENT READY", 100);
      finishBootScreen();
    };
    frame.hidden = false;
    frame.src = gameUrl;
    installView.hidden = true;
    chip.hidden = false;
    panel.hidden = true;
    chip.setAttribute("aria-expanded", "false");
    document.body.classList.add("playing");
  }

  function getPatcher() {
    if (patcherPromise) return patcherPromise;
    patcherPromise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        try {
          const api = patcherFrame.contentWindow && patcherFrame.contentWindow.CrimsonPatcher;
          if (api && typeof api.patch === "function") {
            settled = true;
            resolve(api);
            return;
          }
        } catch (error) {
          settled = true;
          reject(new Error("Crimson could not access its patch engine — reload and try again"));
          return;
        }
        setTimeout(finish, 60);
      };
      patcherFrame.addEventListener("load", finish, { once: true });
      setTimeout(finish, 0);
      setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Crimson's patch engine did not load"));
        }
      }, 15000);
    });
    return patcherPromise;
  }

  async function installFile(file) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setStatus("Choose the standalone HTML game file", "error");
      return;
    }
    if (file.size < 2000000) {
      setStatus("That file is too small to be a complete Eaglercraft client.", "error");
      return;
    }

    fileDrop.classList.add("busy");
    fileDrop.setAttribute("aria-busy", "true");
    setStatus("Reading " + file.name + " · " + (file.size / 1048576).toFixed(1) + " MB…");

    try {
      const source = await file.text();
      if (!source.includes("1.12.2") || !source.includes("eaglercraftXOpts")) {
        throw new Error("This is not an Eaglercraft 1.12.2 HTML client");
      }

      let patched = source;
      if (!source.includes('id="el-modapi"') && !source.includes("id='el-modapi'")) {
        setStatus("Adding Crimson's server list and in-game modules…");
        const api = await getPatcher();
        patched = api.patch(source);
      } else {
        setStatus("Crimson build found · saving your client…");
      }

      const blob = new Blob([patched], { type: "text/html;charset=utf-8" });
      await saveClient({
        id: "main",
        name: file.name.replace(/\.html?$/i, "") + ".crimson.html",
        size: blob.size,
        blob,
        savedAt: Date.now(),
        version: "1.12.2"
      });
      setStatus("Client installed · opening Minecraft…", "good");
      startGame(blob);
      notify("Crimson Client ready");
    } catch (error) {
      setStatus(error && error.message ? error.message : "Could not install this file.", "error");
    } finally {
      fileDrop.classList.remove("busy");
      fileDrop.removeAttribute("aria-busy");
      fileInput.value = "";
    }
  }

  fileDrop.addEventListener("click", () => fileInput.click());
  fileDrop.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => installFile(fileInput.files && fileInput.files[0]));
  ["dragenter", "dragover"].forEach(type => fileDrop.addEventListener(type, event => {
    event.preventDefault();
    fileDrop.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach(type => fileDrop.addEventListener(type, event => {
    event.preventDefault();
    fileDrop.classList.remove("drag");
  }));
  fileDrop.addEventListener("drop", event => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) installFile(file);
  });

  chip.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    chip.setAttribute("aria-expanded", String(open));
  });
  $("#panel-close").addEventListener("click", () => {
    panel.hidden = true;
    chip.setAttribute("aria-expanded", "false");
    try { frame.contentWindow.focus(); } catch (_) {}
  });

  function pressModKey() {
    try {
      const win = frame.contentWindow;
      if (!win) throw new Error("Game is not ready yet.");
      win.focus();
      win.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftRight", keyCode: 16, which: 16, bubbles: true, cancelable: true }));
      win.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", code: "ShiftRight", keyCode: 16, which: 16, bubbles: true, cancelable: true }));
      panel.hidden = true;
      chip.setAttribute("aria-expanded", "false");
      notify("Opening the in-game mod panel · Right Shift also works");
    } catch (error) { notify(error.message || "The game is not ready yet."); }
  }

  async function toggleFullscreen() {
    try {
      const root = $("#client-root");
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen();
      else notify("Fullscreen is not available in this browser.");
    } catch (_) { notify("Fullscreen was blocked by the browser."); }
  }

  $("#crimson-panel").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "mods") pressModKey();
    if (action === "fullscreen") toggleFullscreen();
    if (action === "textures") makeTexturePack();
    if (action === "replace") {
      panel.hidden = true;
      chip.setAttribute("aria-expanded", "false");
      showInstaller("Choose a replacement standalone Eaglercraft 1.12.2 HTML file.");
    }
    if (action === "remove") {
      panel.hidden = true;
      chip.setAttribute("aria-expanded", "false");
      deleteSavedClient().then(() => {
        if (gameUrl) URL.revokeObjectURL(gameUrl);
        gameUrl = null;
        showInstaller("Saved client removed. Your Minecraft worlds are not erased.");
      }).catch(error => notify(error.message || "Could not remove the saved client."));
    }
  });

  document.addEventListener("keydown", event => {
    if (event.code === "F11" && !installView.hidden) return;
    if (event.code === "F11" && !event.repeat) {
      event.preventDefault();
      toggleFullscreen();
    }
    if (event.code === "Escape" && !panel.hidden) {
      panel.hidden = true;
      chip.setAttribute("aria-expanded", "false");
    }
  });

  // Original 16x Crimson resource pack. All pixel art is generated here, not copied from game assets.
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const u16 = n => [n & 255, (n >>> 8) & 255];
  const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  function joinBytes(parts) {
    let length = 0;
    parts.forEach(part => { length += part.length; });
    const out = new Uint8Array(length);
    let offset = 0;
    parts.forEach(part => { out.set(part, offset); offset += part.length; });
    return out;
  }
  async function texturePng(draw) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not render a resource-pack texture.");
    return new Uint8Array(await blob.arrayBuffer());
  }
  function random(seed) {
    let value = seed >>> 0;
    return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
  }
  function addNoise(ctx, colors, seed, count) {
    const rand = random(seed);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      ctx.fillRect(Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1);
    }
  }
  function blockTexture(base, colors, seed, detail) {
    return ctx => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 16, 16);
      addNoise(ctx, colors, seed, 92);
      if (detail) detail(ctx);
    };
  }
  function drawSword(ctx, blade, shade, grip) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = shade;
    [[11,1],[10,2],[9,3],[8,4],[7,5],[6,6],[5,7]].forEach(([x,y]) => ctx.fillRect(x,y,2,2));
    ctx.fillStyle = blade;
    [[11,0],[10,1],[9,2],[8,3],[7,4],[6,5],[5,6]].forEach(([x,y]) => ctx.fillRect(x,y,1,2));
    ctx.fillStyle = "#593b2b";
    ctx.fillRect(4,7,4,1);
    ctx.fillRect(5,8,2,1);
    ctx.fillStyle = grip;
    ctx.fillRect(6,8,1,4);
    ctx.fillRect(5,11,3,2);
    ctx.fillStyle = "#b08b60";
    ctx.fillRect(4,7,4,1);
  }

  async function makeTexturePack() {
    try {
      const files = [];
      const add = async (path, draw) => files.push({ name: path, data: await texturePng(draw) });

      await add("assets/minecraft/textures/blocks/stone.png", blockTexture("#77777d",["#66666d","#898990","#a0a0a2","#585961","#777177"],41,ctx=>{ctx.fillStyle="#aaa5a2";ctx.fillRect(2,3,3,1);ctx.fillRect(11,10,2,1);}));
      await add("assets/minecraft/textures/blocks/cobblestone.png", ctx => {
        ctx.fillStyle="#55565b"; ctx.fillRect(0,0,16,16);
        [[0,0,6,5],[7,0,5,4],[13,0,3,6],[0,6,4,4],[5,5,6,5],[12,7,4,4],[0,11,6,5],[7,11,5,5],[13,12,3,4]].forEach((b,i)=>{ctx.fillStyle=["#77777d","#89898c","#65656c","#707077"][i%4];ctx.fillRect(...b);ctx.fillStyle="#a3a1a0";ctx.fillRect(b[0]+1,b[1]+1,Math.max(1,b[2]-3),1);});
      });
      await add("assets/minecraft/textures/blocks/dirt.png", blockTexture("#79533d",["#63422f","#8c654a","#9a7250","#583b2e","#a07b58"],3));
      await add("assets/minecraft/textures/blocks/grass_top.png", blockTexture("#66864b",["#587a40","#759653","#829c5a","#9aa76b","#4f713b"],17,ctx=>{ctx.fillStyle="#d0c58a";ctx.fillRect(4,2,1,1);ctx.fillRect(12,12,1,1);}));
      await add("assets/minecraft/textures/blocks/grass_side.png", ctx => {ctx.fillStyle="#79533d";ctx.fillRect(0,0,16,16);ctx.fillStyle="#66864b";ctx.fillRect(0,0,16,4);addNoise(ctx,["#587a40","#789652","#8ea66a"],19,28);addNoise(ctx,["#63422f","#8c654a","#9a7250","#583b2e"],21,56);});
      await add("assets/minecraft/textures/blocks/planks_oak.png", ctx => {ctx.fillStyle="#9a7049";ctx.fillRect(0,0,16,16);for(let y=0;y<16;y+=4){ctx.fillStyle=y%8===0?"#b38355":"#8b613d";ctx.fillRect(0,y,16,1);ctx.fillStyle="#c49561";ctx.fillRect(2,y+1,12,1);}ctx.fillStyle="#68462f";ctx.fillRect(5,2,1,1);ctx.fillRect(6,3,1,1);ctx.fillRect(12,10,1,1);});
      await add("assets/minecraft/textures/blocks/gravel.png", blockTexture("#817b70",["#a49a88","#6c675f","#b0a694","#5f5c56"],24));
      await add("assets/minecraft/textures/blocks/sand.png", blockTexture("#d8c58c",["#e7d69e","#bca977","#f0dfa7","#c8b47e"],34));
      await add("assets/minecraft/textures/blocks/sandstone.png", ctx=>{ctx.fillStyle="#d8c58c";ctx.fillRect(0,0,16,16);[3,8,13].forEach(y=>{ctx.fillStyle="#b79f6e";ctx.fillRect(0,y,16,1);ctx.fillStyle="#ead8a2";ctx.fillRect(0,y+1,16,1);});addNoise(ctx,["#c7b27e","#e8d49b"],42,18);});
      await add("assets/minecraft/textures/blocks/bricks.png", ctx=>{ctx.fillStyle="#885044";ctx.fillRect(0,0,16,16);ctx.fillStyle="#c18b70";for(let y=0;y<16;y+=5){ctx.fillRect(0,y,16,1);ctx.fillRect(y%10===0?0:4,y+1,1,4);ctx.fillRect(y%10===0?8:12,y+1,1,4);}ctx.fillStyle="#a96f5d";ctx.fillRect(1,1,6,3);ctx.fillRect(9,6,6,3);ctx.fillRect(1,11,6,3);});
      await add("assets/minecraft/textures/blocks/mossy_cobblestone.png", ctx=>{ctx.fillStyle="#62645a";ctx.fillRect(0,0,16,16);addNoise(ctx,["#7d806c","#4c5547","#8d8c70","#5a6154"],55,88);ctx.fillStyle="#62754a";[[2,3],[3,3],[4,4],[11,8],[12,8],[13,9],[6,13],[7,12]].forEach(([x,y])=>ctx.fillRect(x,y,2,1));});
      await add("assets/minecraft/textures/blocks/bedrock.png", blockTexture("#343438",["#55545a","#24252b","#777078","#414148"],61));
      await add("assets/minecraft/textures/blocks/obsidian.png", blockTexture("#282331",["#392d43","#211d2e","#473047","#33263d"],77,ctx=>{ctx.strokeStyle="#794057";ctx.beginPath();ctx.moveTo(2,3);ctx.lineTo(5,6);ctx.lineTo(4,10);ctx.lineTo(9,13);ctx.stroke();}));
      await add("assets/minecraft/textures/blocks/netherrack.png", blockTexture("#6d3036",["#8a4144","#55262f","#a14a48","#74343d","#b75b51"],93));
      await add("assets/minecraft/textures/blocks/ice.png", blockTexture("#a8d5e5",["#d0eff3","#80b9d4","#b9e6ed","#93c8dc"],108));
      await add("assets/minecraft/textures/blocks/snow.png", blockTexture("#e9edf0",["#ffffff","#d4dfe6","#f5f7f7"],119));
      await add("assets/minecraft/textures/blocks/glass.png", ctx=>{ctx.clearRect(0,0,16,16);ctx.fillStyle="#b9e1e5";ctx.globalAlpha=.5;ctx.fillRect(0,0,16,1);ctx.fillRect(0,1,1,14);ctx.fillRect(1,14,14,1);ctx.fillRect(14,1,1,13);ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.fillRect(2,2,4,1);});
      const ore = (color, seed) => blockTexture("#77777d",["#66666d","#898990","#a0a0a2"],seed,ctx=>{[[2,2],[10,4],[6,10],[13,13]].forEach(([x,y])=>{ctx.fillStyle=color;ctx.fillRect(x,y,2,2);});});
      await add("assets/minecraft/textures/blocks/coal_ore.png", ore("#29292b",130));
      await add("assets/minecraft/textures/blocks/iron_ore.png", ore("#d1bca5",131));
      await add("assets/minecraft/textures/blocks/gold_ore.png", ore("#e4bd43",132));
      await add("assets/minecraft/textures/blocks/redstone_ore.png", ore("#aa3040",133));
      await add("assets/minecraft/textures/blocks/lapis_ore.png", ore("#315c9d",134));
      await add("assets/minecraft/textures/blocks/diamond_ore.png", ore("#62cfc9",135));
      await add("assets/minecraft/textures/blocks/emerald_ore.png", ore("#52b86a",136));
      await add("assets/minecraft/textures/blocks/log_oak.png", ctx=>{ctx.fillStyle="#775234";ctx.fillRect(0,0,16,16);for(let x=2;x<16;x+=4){ctx.fillStyle="#95683e";ctx.fillRect(x,0,1,16);ctx.fillStyle="#573b2a";ctx.fillRect(x+1,0,1,16);}});
      await add("assets/minecraft/textures/blocks/log_oak_top.png", ctx=>{ctx.fillStyle="#c19968";ctx.fillRect(0,0,16,16);ctx.strokeStyle="#805a3a";ctx.strokeRect(2,2,12,12);ctx.strokeRect(5,5,6,6);ctx.fillStyle="#8d6643";ctx.fillRect(7,7,2,2);});
      await add("assets/minecraft/textures/blocks/leaves_oak.png", ctx=>{ctx.fillStyle="#426d3d";ctx.fillRect(0,0,16,16);addNoise(ctx,["#5a8748","#345c36","#72994e","#294e31"],149,100);});
      await add("assets/minecraft/textures/items/wooden_sword.png", ctx=>drawSword(ctx,"#c58b4e","#76502f","#76502f"));
      await add("assets/minecraft/textures/items/stone_sword.png", ctx=>drawSword(ctx,"#c5c3be","#66676b","#76502f"));
      await add("assets/minecraft/textures/items/iron_sword.png", ctx=>drawSword(ctx,"#e1e5e7","#87939a","#76502f"));
      await add("assets/minecraft/textures/items/golden_sword.png", ctx=>drawSword(ctx,"#f5d45c","#a77c22","#76502f"));
      await add("assets/minecraft/textures/items/diamond_sword.png", ctx=>drawSword(ctx,"#7ee4dc","#258b91","#76502f"));

      files.push({ name: "pack.mcmeta", data: new TextEncoder().encode(JSON.stringify({ pack: { pack_format: 3, description: "Crimson Client · Original 16x textures by Talon" } }, null, 2)) });
      const icon = await texturePng(ctx=>{ctx.fillStyle="#171014";ctx.fillRect(0,0,16,16);ctx.fillStyle="#8d1c31";ctx.fillRect(2,2,12,12);ctx.fillStyle="#f16b79";ctx.fillRect(7,1,2,14);ctx.fillStyle="#541323";ctx.fillRect(1,7,14,2);});
      files.push({ name: "pack.png", data: icon });

      const locals = [], centrals = [];
      let offset = 0;
      files.forEach(file => {
        const name = new TextEncoder().encode(file.name);
        const data = file.data;
        const crc = crc32(data);
        const local = joinBytes([new Uint8Array(u32(0x04034b50)),new Uint8Array(u16(20)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u32(crc)),new Uint8Array(u32(data.length)),new Uint8Array(u32(data.length)),new Uint8Array(u16(name.length)),new Uint8Array(u16(0)),name,data]);
        const central = joinBytes([new Uint8Array(u32(0x02014b50)),new Uint8Array(u16(20)),new Uint8Array(u16(20)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u32(crc)),new Uint8Array(u32(data.length)),new Uint8Array(u32(data.length)),new Uint8Array(u16(name.length)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u32(0)),new Uint8Array(u32(offset)),name]);
        locals.push(local); centrals.push(central); offset += local.length;
      });
      const centralData = joinBytes(centrals);
      const end = joinBytes([new Uint8Array(u32(0x06054b50)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(files.length)),new Uint8Array(u16(files.length)),new Uint8Array(u32(centralData.length)),new Uint8Array(u32(offset)),new Uint8Array(u16(0))]);
      const zip = new Blob([...locals, centralData, end], { type: "application/zip" });
      const url = URL.createObjectURL(zip);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Crimson-Resource-Pack-1.12.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify("Crimson 16x resource pack built · import it in Resource Packs");
    } catch (error) {
      notify(error && error.message ? error.message : "Could not build the resource pack.");
    }
  }

  async function bootSavedClient() {
    setBootProgress("CHECKING LOCAL CLIENT", 22);
    try {
      const record = await getSavedClient();
      if (record && record.blob) {
        setBootProgress("OPENING MINECRAFT", 72);
        startGame(record.blob);
      } else {
        setBootProgress("READY FOR GAME FILE", 100);
        showInstaller("Choose your Eaglercraft HTML file");
        finishBootScreen();
      }
    } catch (error) {
      setBootProgress("LOCAL STORAGE CHECK", 100);
      showInstaller(error && error.message ? error.message : "Browser storage is unavailable", "error");
      finishBootScreen();
    }
  }

  window.addEventListener("beforeunload", () => {
    if (gameUrl) URL.revokeObjectURL(gameUrl);
  });
  bootSavedClient();
})();