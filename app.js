(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = function (selector, root) { return (root || document).querySelector(selector); };
  const $$ = function (selector, root) { return Array.from((root || document).querySelectorAll(selector)); };

  // Scroll progress and local clock
  const progress = $("#scroll-progress");
  function updateScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const value = max > 0 ? (window.scrollY / max) * 100 : 0;
    progress.style.width = value.toFixed(2) + "%";
  }
  window.addEventListener("scroll", updateScroll, { passive: true });
  updateScroll();

  const timeLabel = $("#local-time");
  function updateClock() {
    timeLabel.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(new Date());
  }
  updateClock();
  window.setInterval(updateClock, 1000);

  // Reveal sections only as they approach the viewport
  const revealItems = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
    revealItems.forEach(function (item, index) {
      item.style.transitionDelay = Math.min(index % 4, 3) * 65 + "ms";
      observer.observe(item);
    });
  } else {
    revealItems.forEach(function (item) { item.classList.add("is-visible"); });
  }

  // Cursor light and subtle hero parallax
  const glow = $("#cursor-glow");
  let pointerX = window.innerWidth * 0.5;
  let pointerY = window.innerHeight * 0.35;
  window.addEventListener("pointermove", function (event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    glow.style.left = pointerX + "px";
    glow.style.top = pointerY + "px";
    const stage = $("#core-stage");
    if (stage && !reduceMotion) {
      const rect = stage.getBoundingClientRect();
      const dx = (pointerX - (rect.left + rect.width / 2)) / rect.width;
      const dy = (pointerY - (rect.top + rect.height / 2)) / rect.height;
      stage.style.transform = "perspective(900px) rotateY(" + (dx * 4).toFixed(2) + "deg) rotateX(" + (-dy * 4).toFixed(2) + "deg)";
    }
  }, { passive: true });
  document.addEventListener("pointerleave", function () { glow.style.opacity = "0"; });
  document.addEventListener("pointerenter", function () { glow.style.opacity = ".11"; });

  // Mobile navigation
  const menuToggle = $("#menu-toggle");
  const nav = $("#main-nav");
  menuToggle.addEventListener("click", function () {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  });
  $$("#main-nav a").forEach(function (link) {
    link.addEventListener("click", function () {
      nav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  // Theme switch
  const themeToggle = $("#theme-toggle");
  try {
    if (localStorage.getItem("crimson-theme") === "light") document.body.classList.add("light-mode");
  } catch (error) {}
  themeToggle.addEventListener("click", function () {
    const light = document.body.classList.toggle("light-mode");
    try { localStorage.setItem("crimson-theme", light ? "light" : "dark"); } catch (error) {}
    showToast(light ? "Light mode" : "Dark mode");
  });

  // Toast
  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove("is-visible"); }, 1900);
  }

  // Ambient particle field
  const ambient = $("#ambient-canvas");
  const ambientContext = ambient.getContext("2d");
  let particles = [];
  let ambientWidth = 0;
  let ambientHeight = 0;
  let ambientFrame = 0;

  function resizeAmbient() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    ambientWidth = window.innerWidth;
    ambientHeight = window.innerHeight;
    ambient.width = Math.round(ambientWidth * ratio);
    ambient.height = Math.round(ambientHeight * ratio);
    ambientContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(90, Math.max(30, Math.floor((ambientWidth * ambientHeight) / 18000)));
    particles = Array.from({ length: count }, function () {
      return {
        x: Math.random() * ambientWidth,
        y: Math.random() * ambientHeight,
        r: Math.random() * 1.2 + 0.35,
        a: Math.random() * 0.44 + 0.08,
        speed: Math.random() * 0.14 + 0.025,
        phase: Math.random() * Math.PI * 2
      };
    });
  }

  function drawAmbient() {
    ambientContext.clearRect(0, 0, ambientWidth, ambientHeight);
    particles.forEach(function (p) {
      p.phase += 0.007;
      if (!reduceMotion) p.y -= p.speed;
      if (p.y < -4) { p.y = ambientHeight + 4; p.x = Math.random() * ambientWidth; }
      ambientContext.beginPath();
      ambientContext.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ambientContext.fillStyle = "rgba(222, 184, 174, " + (p.a * (0.7 + Math.sin(p.phase) * 0.3)) + ")";
      ambientContext.fill();
    });
    if (!reduceMotion) ambientFrame = window.requestAnimationFrame(drawAmbient);
  }
  resizeAmbient();
  drawAmbient();
  window.addEventListener("resize", function () {
    window.cancelAnimationFrame(ambientFrame);
    resizeAmbient();
    drawAmbient();
    resizeOrbit();
  }, { passive: true });

  // Orbital playground
  const orbitCanvas = $("#orbit-canvas");
  const orbitContext = orbitCanvas.getContext("2d");
  const orbitState = $("#orbit-state");
  const orbitToggle = $("#orbit-toggle");
  const orbitRandomize = $("#orbit-randomize");
  const coordX = $("#coord-x");
  const coordY = $("#coord-y");
  const orbitViewport = $("#orbit-viewport");
  let orbitWidth = 0;
  let orbitHeight = 0;
  let orbitDpr = 1;
  let orbitFrame = 0;
  let orbitRunning = !reduceMotion;
  let orbitTime = 0;
  let orbitDrag = false;
  let dragPoint = null;
  let orbitOffsetX = 0;
  let orbitOffsetY = 0;
  let fpsCounter = 0;
  let fpsStart = performance.now();
  const orbitObjects = [
    { radius: .19, speed: .82, phase: .4, size: 5, color: "#e66b72", glow: "rgba(230,107,114,.8)" },
    { radius: .32, speed: -.48, phase: 2.8, size: 7, color: "#d1b49f", glow: "rgba(209,180,159,.75)" },
    { radius: .43, speed: .31, phase: 4.7, size: 4, color: "#9d839b", glow: "rgba(157,131,155,.8)" }
  ];

  function resizeOrbit() {
    const rect = orbitViewport.getBoundingClientRect();
    orbitWidth = rect.width;
    orbitHeight = rect.height;
    orbitDpr = Math.min(window.devicePixelRatio || 1, 2);
    orbitCanvas.width = Math.max(1, Math.round(orbitWidth * orbitDpr));
    orbitCanvas.height = Math.max(1, Math.round(orbitHeight * orbitDpr));
    orbitContext.setTransform(orbitDpr, 0, 0, orbitDpr, 0, 0);
    drawOrbit();
  }

  function drawOrbit() {
    if (!orbitWidth || !orbitHeight) return;
    const ctx = orbitContext;
    ctx.clearRect(0, 0, orbitWidth, orbitHeight);
    const cx = orbitWidth * .5 + orbitOffsetX;
    const cy = orbitHeight * .51 + orbitOffsetY;
    const base = Math.min(orbitWidth, orbitHeight) * .43;

    // Distant points
    for (let i = 0; i < 55; i += 1) {
      const x = (i * 127.7 + 19) % orbitWidth;
      const y = (i * 81.3 + 11) % orbitHeight;
      ctx.beginPath();
      ctx.arc(x, y, (i % 3) * .35 + .45, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(222,204,195," + (i % 4 ? .2 : .48) + ")";
      ctx.fill();
    }

    // Central axis
    ctx.strokeStyle = "rgba(207,174,163,.09)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, 16); ctx.lineTo(cx, orbitHeight - 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, cy); ctx.lineTo(orbitWidth - 16, cy); ctx.stroke();

    // Orbits and objects
    orbitObjects.forEach(function (object, index) {
      const rx = base * object.radius * 2.05;
      const ry = rx * (.48 + index * .035);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-.28 + index * .19);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = index === 1 ? "rgba(194,58,75,.38)" : "rgba(205,186,173,.2)";
      ctx.setLineDash(index === 2 ? [3, 7] : []);
      ctx.stroke();
      ctx.restore();
      const angle = object.phase + orbitTime * object.speed;
      const px = cx + Math.cos(angle) * rx;
      const py = cy + Math.sin(angle) * ry;
      const glow = ctx.createRadialGradient(px, py, 0, px, py, object.size * 4.4);
      glow.addColorStop(0, object.glow);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(px, py, object.size * 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = object.color;
      ctx.beginPath(); ctx.arc(px, py, object.size, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.65)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, object.size + 1.8, 0, Math.PI * 2); ctx.stroke();
    });

    // Core
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 66);
    coreGlow.addColorStop(0, "rgba(218,66,84,.28)");
    coreGlow.addColorStop(1, "rgba(218,66,84,0)");
    ctx.fillStyle = coreGlow;
    ctx.beginPath(); ctx.arc(cx, cy, 66, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(.4);
    ctx.beginPath();
    ctx.moveTo(0, -25); ctx.lineTo(19, -8); ctx.lineTo(12, 24); ctx.lineTo(-14, 17); ctx.lineTo(-23, -9); ctx.closePath();
    const coreGradient = ctx.createLinearGradient(-22, -23, 20, 24);
    coreGradient.addColorStop(0, "#f17e80");
    coreGradient.addColorStop(.48, "#a72b43");
    coreGradient.addColorStop(1, "#3c1825");
    ctx.fillStyle = coreGradient; ctx.fill();
    ctx.strokeStyle = "rgba(255,215,199,.55)"; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(241,211,194,.72)";
    ctx.font = "8px 'DM Mono', monospace";
    ctx.fillText("CR / CORE", cx + 35, cy - 34);
  }

  function orbitLoop() {
    if (!orbitRunning) return;
    orbitTime += .009;
    drawOrbit();
    fpsCounter += 1;
    const now = performance.now();
    if (now - fpsStart > 1000) {
      $("#frame-rate").textContent = String(Math.round((fpsCounter * 1000) / (now - fpsStart)));
      fpsCounter = 0;
      fpsStart = now;
    }
    orbitFrame = window.requestAnimationFrame(orbitLoop);
  }

  orbitToggle.addEventListener("click", function () {
    orbitRunning = !orbitRunning;
    orbitState.textContent = orbitRunning ? "IN MOTION" : "PAUSED";
    orbitToggle.innerHTML = orbitRunning ? 'PAUSE MODEL <span>Ⅱ</span>' : 'RESUME MODEL <span>▶</span>';
    if (orbitRunning) orbitLoop();
    else window.cancelAnimationFrame(orbitFrame);
  });
  orbitRandomize.addEventListener("click", function () {
    orbitObjects.forEach(function (obj) {
      obj.phase = Math.random() * Math.PI * 2;
      obj.speed = (Math.random() * .65 + .25) * (Math.random() > .5 ? 1 : -1);
      obj.radius = Math.random() * .27 + .16;
    });
    orbitTime = Math.random() * 8;
    drawOrbit();
    showToast("Model reshuffled");
  });
  orbitCanvas.addEventListener("pointerdown", function (event) {
    orbitDrag = true;
    dragPoint = { x: event.clientX, y: event.clientY };
    orbitCanvas.setPointerCapture(event.pointerId);
  });
  orbitCanvas.addEventListener("pointermove", function (event) {
    const rect = orbitCanvas.getBoundingClientRect();
    coordX.textContent = String(Math.round(event.clientX - rect.left)).padStart(3, "0");
    coordY.textContent = String(Math.round(event.clientY - rect.top)).padStart(3, "0");
    if (!orbitDrag || !dragPoint) return;
    orbitOffsetX = Math.max(-35, Math.min(35, orbitOffsetX + (event.clientX - dragPoint.x) * .22));
    orbitOffsetY = Math.max(-28, Math.min(28, orbitOffsetY + (event.clientY - dragPoint.y) * .22));
    dragPoint = { x: event.clientX, y: event.clientY };
    drawOrbit();
  });
  function stopOrbitDrag() { orbitDrag = false; dragPoint = null; }
  orbitCanvas.addEventListener("pointerup", stopOrbitDrag);
  orbitCanvas.addEventListener("pointercancel", stopOrbitDrag);
  resizeOrbit();
  if (orbitRunning) orbitLoop();
  else {
    orbitState.textContent = "PAUSED";
    orbitToggle.innerHTML = 'RESUME MODEL <span>▶</span>';
  }

  // Palette generator
  const paletteSwatches = $$(".swatch");
  const paletteNames = ["After Hours", "Rust Signal", "Cold Ember", "Red Shift", "Night Glass", "Burnt Copper", "Quiet Static", "Deep Current"];
  let paletteVersion = 1;
  let currentHue = 0;
  let palette = [];
  let paletteName = paletteNames[0];

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = function (n) { return (n + h / 30) % 12; };
    const a = s * Math.min(l, 1 - l);
    const f = function (n) {
      const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return ("#" + f(0) + f(8) + f(4)).toUpperCase();
  }

  function makePalette(hue) {
    const base = (hue + Math.floor(Math.random() * 22) - 11 + 360) % 360;
    const offsets = [0, 18, 48, 174, 204];
    const sats = [62, 55, 49, 22, 18];
    const lights = [39, 57, 76, 42, 20];
    return offsets.map(function (offset, index) {
      return hslToHex((base + offset) % 360, sats[index], lights[index]);
    });
  }

  function renderPalette() {
    palette.forEach(function (color, index) {
      paletteSwatches[index].style.background = color;
      $("span", paletteSwatches[index]).textContent = color;
      paletteSwatches[index].setAttribute("aria-label", "Copy " + color);
    });
    $("#palette-name").textContent = paletteName;
    $("#palette-version").textContent = String(paletteVersion).padStart(2, "0");
    $("#hue-value").textContent = currentHue + "°";
    $("#hue-slider").value = String(currentHue);
    $("#preview-hex").textContent = palette[0];
    $("#color-preview").style.setProperty("--preview-color", palette[0]);
    $("#color-preview").style.setProperty("--preview-glow", palette[0] + "66");
    $("#color-preview").style.background = "linear-gradient(135deg, " + palette[4] + ", " + palette[3] + " 60%, " + palette[0] + ")";
    $("#css-output").textContent = palette.map(function (color, index) {
      return "--color-0" + (index + 1) + ": " + color + ";";
    }).join("\n");
  }

  async function copyText(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage || "Copied");
    } catch (error) {
      const field = document.createElement("textarea");
      field.value = value;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      field.remove();
      showToast(ok ? (successMessage || "Copied") : "Copy unavailable");
    }
  }

  function regeneratePalette() {
    paletteVersion += 1;
    paletteName = paletteNames[Math.floor(Math.random() * paletteNames.length)];
    palette = makePalette(currentHue);
    renderPalette();
    $("#palette-feedback").textContent = "New palette created. Click a swatch to copy its hex value.";
  }

  palette = makePalette(currentHue);
  renderPalette();
  $("#generate-palette").addEventListener("click", regeneratePalette);
  $("#hue-slider").addEventListener("input", function (event) {
    currentHue = Number(event.target.value);
    palette = makePalette(currentHue);
    renderPalette();
    $("#palette-feedback").textContent = "Hue adjusted to " + currentHue + "°.";
  });
  paletteSwatches.forEach(function (swatch, index) {
    swatch.addEventListener("click", function () { copyText(palette[index], palette[index] + " copied"); });
  });
  $("#copy-palette").addEventListener("click", function () { copyText(palette.join(", "), "Palette copied"); });
  $("#copy-css").addEventListener("click", function () { copyText($("#css-output").textContent, "CSS copied"); });

  // Local console — deliberately limited to local commands
  const terminalScreen = $("#terminal-screen");
  const terminalInput = $("#terminal-input");
  const commandHistory = [];
  let historyIndex = 0;

  function printLine(text, className) {
    const line = document.createElement("p");
    line.className = "terminal-line" + (className ? " " + className : "");
    line.textContent = text;
    terminalScreen.appendChild(line);
    terminalScreen.scrollTop = terminalScreen.scrollHeight;
  }

  function handleCommand(raw) {
    const input = raw.trim();
    if (!input) return;
    printLine("› " + input, "terminal-muted");
    const pieces = input.split(/\s+/);
    const command = pieces[0].toLowerCase();
    const argument = pieces.slice(1).join(" ");
    switch (command) {
      case "help":
        printLine("AVAILABLE: help · clear · time · about · palette · orbit · open redroom", "terminal-success");
        break;
      case "clear":
        terminalScreen.replaceChildren();
        printLine("Console cleared.", "terminal-muted");
        break;
      case "time":
        printLine("LOCAL TIME: " + new Date().toLocaleString(), "terminal-output");
        break;
      case "about":
        printLine("CRIMSON is an interactive corner of the internet. Built for exploration.", "terminal-output");
        break;
      case "palette":
        printLine("CURRENT PALETTE: " + palette.join("  "), "terminal-output");
        break;
      case "orbit":
        orbitRandomize.click();
        printLine("Orbital model reshuffled.", "terminal-success");
        break;
      case "open":
        if (argument.toLowerCase() === "redroom") {
          openRedroom();
          printLine("UNLISTED ROOM FOUND.", "terminal-success");
        } else {
          printLine("No room by that name. Try: open redroom", "terminal-error");
        }
        break;
      case "echo":
        printLine(argument || "(empty)", "terminal-output");
        break;
      default:
        printLine("Command not found: " + command + ". Try help.", "terminal-error");
    }
  }

  $("#terminal-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const value = terminalInput.value;
    if (!value.trim()) return;
    commandHistory.push(value);
    historyIndex = commandHistory.length;
    handleCommand(value);
    terminalInput.value = "";
  });
  terminalInput.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      terminalInput.value = commandHistory[historyIndex] || "";
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.min(commandHistory.length, historyIndex + 1);
      terminalInput.value = commandHistory[historyIndex] || "";
    }
  });
  $$(".inline-command").forEach(function (button) {
    button.addEventListener("click", function () {
      handleCommand(button.dataset.command);
      terminalInput.focus();
    });
  });
  $$("[data-open-console]").forEach(function (button) {
    button.addEventListener("click", function () {
      document.querySelector("#console").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      window.setTimeout(function () { terminalInput.focus(); }, reduceMotion ? 0 : 450);
    });
  });

  // Unlisted room
  const redroom = $("#redroom");
  function openRedroom() {
    redroom.hidden = false;
    $("#redroom-close").focus();
  }
  function closeRedroom() {
    redroom.hidden = true;
    $("#redroom-open").focus();
  }
  $("#redroom-open").addEventListener("click", openRedroom);
  $("#redroom-close").addEventListener("click", closeRedroom);
  $("#redroom-return").addEventListener("click", closeRedroom);
  redroom.addEventListener("click", function (event) {
    if (event.target === redroom) closeRedroom();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !redroom.hidden) closeRedroom();
    if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      terminalInput.focus();
      document.querySelector("#console").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    }
  });

}());
