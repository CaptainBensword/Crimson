const COLLECTIONS = [
  { id: "sheet-music", title: "Sheet Music", singular: "sheet music", description: "Scores and individual parts" },
  { id: "game-music", title: "Game Music", singular: "game music", description: "Music written for games" },
  { id: "podcast-video", title: "Podcast & Video", singular: "podcast and video music", description: "Themes, intros and background music" },
  { id: "compositions", title: "Compositions", singular: "compositions", description: "Standalone pieces and studies" },
  { id: "other", title: "Other", singular: "other music", description: "Everything outside the main groups" }
];

const ICONS = {
  "sheet-music": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 0z"></path><path d="M5 4.5v15M8 8h7M8 11h7M8 14h5"></path></svg>',
  "game-music": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 8h9a4 4 0 0 1 3.8 5.2l-1 3.1a2.4 2.4 0 0 1-3.9 1l-2.1-1.8h-2.6l-2.1 1.8a2.4 2.4 0 0 1-3.9-1l-1-3.1A4 4 0 0 1 7.5 8Z"></path><path d="M8 11v4M6 13h4M15.5 12h.01M18 14h.01"></path></svg>',
  "podcast-video": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="13" rx="4"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"></path></svg>',
  "compositions": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16"></path><path d="M8 4v5M14 9.5v5M18 15v5"></path></svg>',
  "other": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect></svg>'
};

const state = {
  tracks: [],
  category: new URLSearchParams(window.location.search).get("category") || "all",
  genre: "",
  search: "",
  sort: "newest",
  loadError: false
};

const elements = {
  title: document.getElementById("page-title"),
  catalogTitle: document.getElementById("catalog-title"),
  search: document.getElementById("catalog-search"),
  sort: document.getElementById("sort-select"),
  genres: document.getElementById("genre-filters"),
  count: document.getElementById("result-count"),
  list: document.getElementById("track-list"),
  empty: document.getElementById("empty-state"),
  emptyTitle: document.getElementById("empty-title"),
  emptyMessage: document.getElementById("empty-message"),
  dialog: document.getElementById("track-dialog"),
  dialogContent: document.getElementById("dialog-content"),
  dialogClose: document.getElementById("dialog-close")
};

function getCollection(id) {
  return COLLECTIONS.find(function (item) { return item.id === id; });
}

function setText(node, value) {
  node.textContent = value == null ? "" : String(value);
}

function safeAssetPath(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const path = value.trim();
  if (path.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.split("/").includes("..")) return "";
  try {
    const url = new URL(path, document.baseURI);
    if (url.origin !== window.location.origin || !["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch (error) {
    return "";
  }
}

function displayDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function normalizeTrack(track) {
  if (!track || typeof track !== "object" || typeof track.title !== "string" || !track.title.trim()) return null;
  const category = COLLECTIONS.some(function (item) { return item.id === track.category; }) ? track.category : "other";
  const genres = Array.isArray(track.genres) ? track.genres.filter(function (item) {
    return typeof item === "string" && item.trim();
  }).map(function (item) { return item.trim(); }) : [];
  return {
    id: typeof track.id === "string" && track.id.trim() ? track.id.trim() : track.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: track.title.trim(),
    category: category,
    project: typeof track.project === "string" ? track.project.trim() : "",
    description: typeof track.description === "string" ? track.description.trim() : "",
    date: typeof track.date === "string" ? track.date : "",
    genres: genres,
    audio: safeAssetPath(track.audio),
    cover: safeAssetPath(track.cover),
    score: safeAssetPath(track.score),
    parts: Array.isArray(track.parts) ? track.parts.filter(function (part) {
      return part && typeof part.instrument === "string" && safeAssetPath(part.file);
    }).map(function (part) { return { instrument: part.instrument, file: safeAssetPath(part.file) }; }) : [],
    files: Array.isArray(track.files) ? track.files.filter(function (file) {
      return file && typeof file.label === "string" && safeAssetPath(file.file);
    }).map(function (file) { return { label: file.label, file: safeAssetPath(file.file) }; }) : [],
    playback: track.playback && Array.isArray(track.playback.notes) ? {
      bpm: Number(track.playback.bpm) > 0 ? Number(track.playback.bpm) : 112,
      transposition: Number.isFinite(Number(track.playback.transposition)) ? Number(track.playback.transposition) : 0,
      notes: track.playback.notes.filter(function (note) {
        return Array.isArray(note) && typeof note[0] === "string" && Number(note[1]) > 0;
      })
    } : null
  };
}

function filteredTracks() {
  const query = state.search.toLocaleLowerCase();
  return state.tracks.filter(function (track) {
    const categoryMatch = state.category === "all" || track.category === state.category;
    const genreMatch = !state.genre || track.genres.some(function (genre) { return genre.toLocaleLowerCase() === state.genre.toLocaleLowerCase(); });
    const searchable = [track.title, track.project, track.description, track.genres.join(" ")].join(" ").toLocaleLowerCase();
    return categoryMatch && genreMatch && (!query || searchable.includes(query));
  }).sort(function (a, b) {
    if (state.sort === "title") return a.title.localeCompare(b.title);
    const aDate = Date.parse(a.date) || 0;
    const bDate = Date.parse(b.date) || 0;
    return state.sort === "oldest" ? aDate - bDate : bDate - aDate;
  });
}

function renderCollections() {
  document.querySelectorAll("[data-count-for]").forEach(function (node) {
    const count = state.tracks.filter(function (track) { return track.category === node.dataset.countFor; }).length;
    setText(node, count);
  });
  document.querySelectorAll("[data-collection]").forEach(function (node) {
    const active = node.dataset.collection === state.category;
    if (active) node.setAttribute("aria-current", "true");
    else node.removeAttribute("aria-current");
  });
}

function renderGenres() {
  const genreNames = Array.from(new Set(state.tracks.reduce(function (all, track) {
    return all.concat(track.genres);
  }, []))).sort(function (a, b) { return a.localeCompare(b); });

  elements.genres.replaceChildren();
  if (!genreNames.length) {
    elements.genres.hidden = true;
    return;
  }

  elements.genres.hidden = false;
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "genre-chip";
  allButton.textContent = "All genres";
  allButton.setAttribute("aria-pressed", state.genre === "");
  allButton.addEventListener("click", function () { state.genre = ""; render(); });
  elements.genres.appendChild(allButton);

  genreNames.forEach(function (genre) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "genre-chip";
    button.textContent = genre;
    button.setAttribute("aria-pressed", state.genre.toLocaleLowerCase() === genre.toLocaleLowerCase());
    button.addEventListener("click", function () {
      state.genre = state.genre.toLocaleLowerCase() === genre.toLocaleLowerCase() ? "" : genre;
      render();
    });
    elements.genres.appendChild(button);
  });
}

let activePlayback = null;

function stopPlayback() {
  if (!activePlayback) return;
  const current = activePlayback;
  activePlayback = null;
  if (current.audio) {
    current.audio.pause();
    current.audio.currentTime = 0;
  }
  if (current.nodes) {
    current.nodes.forEach(function (node) {
      try { node.stop(); } catch (error) {}
    });
  }
  if (current.context && current.context.state !== "closed") {
    current.context.close().catch(function () {});
  }
  document.querySelectorAll(".track-listen, .preview-play").forEach(function (button) {
    button.textContent = button.classList.contains("preview-play") ? "Listen to preview" : "Listen";
    button.setAttribute("aria-pressed", "false");
  });
}

function noteToMidi(noteName) {
  const match = /^([A-G])([#b]?)(-?\\d+)$/.exec(noteName);
  if (!match) return null;
  const semitones = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const accidental = match[2] === "#" ? 1 : (match[2] === "b" ? -1 : 0);
  return (Number(match[3]) + 1) * 12 + semitones[match[1]] + accidental;
}

function playTrack(track, button) {
  if (activePlayback && activePlayback.trackId === track.id) {
    stopPlayback();
    return;
  }
  stopPlayback();

  if (track.audio) {
    const audio = new Audio(track.audio);
    activePlayback = { trackId: track.id, audio: audio };
    if (button) {
      button.textContent = "Stop";
      button.setAttribute("aria-pressed", "true");
    }
    audio.addEventListener("ended", stopPlayback, { once: true });
    audio.play().catch(function () {
      stopPlayback();
      setText(elements.count, "Audio could not be played. Check the file format and path.");
    });
    return;
  }

  if (!track.playback || !track.playback.notes.length) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setText(elements.count, "This browser does not support audio playback.");
    return;
  }

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.62;
  master.connect(context.destination);

  const real = new Float32Array(10);
  const imag = new Float32Array(10);
  const harmonics = [0, 1, 0.58, 0.39, 0.27, 0.17, 0.11, 0.07, 0.045, 0.025];
  for (let i = 1; i < harmonics.length; i += 1) imag[i] = harmonics[i];
  const hornWave = context.createPeriodicWave(real, imag);
  const nodes = [];
  const notes = track.playback.notes;
  const secondsPerBeat = 60 / track.playback.bpm;
  let cursor = context.currentTime + 0.12;

  notes.forEach(function (event) {
    const writtenMidi = noteToMidi(event[0]);
    const duration = Number(event[1]) * secondsPerBeat;
    if (writtenMidi === null || !Number.isFinite(duration) || duration <= 0) return;

    const soundingMidi = writtenMidi + track.playback.transposition;
    const frequency = 440 * Math.pow(2, (soundingMidi - 69) / 12);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.setPeriodicWave(hornWave);
    oscillator.frequency.setValueAtTime(frequency, cursor);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2300, cursor);
    envelope.gain.setValueAtTime(0.0001, cursor);
    envelope.gain.linearRampToValueAtTime(0.2, cursor + Math.min(0.075, duration * 0.28));
    envelope.gain.setValueAtTime(0.15, Math.max(cursor + 0.08, cursor + duration - 0.09));
    envelope.gain.exponentialRampToValueAtTime(0.0001, cursor + duration - 0.015);

    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    oscillator.start(cursor);
    oscillator.stop(cursor + duration + 0.03);
    nodes.push(oscillator);
    cursor += duration;
  });

  activePlayback = { trackId: track.id, context: context, nodes: nodes };
  if (button) {
    button.textContent = "Stop";
    button.setAttribute("aria-pressed", "true");
  }
  const finish = function () {
    if (activePlayback && activePlayback.context === context) stopPlayback();
  };
  nodes.forEach(function (node) { node.addEventListener("ended", function () {
    if (nodes.every(function (item) { return item.playbackEnded; })) finish();
    node.playbackEnded = true;
    if (nodes.every(function (item) { return item.playbackEnded; })) finish();
  }); });
}

function makeTrackRow(track) {
  const item = document.createElement("li");
  item.className = "track-row";
  const row = document.createElement("div");
  row.className = "track-row-inner";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "track-open";
  button.setAttribute("aria-label", "Open details for " + track.title);

  const symbol = track.cover ? document.createElement("img") : document.createElement("span");
  symbol.className = track.cover ? "track-cover" : "track-symbol";
  symbol.setAttribute("aria-hidden", track.cover ? "false" : "true");
  if (track.cover) {
    symbol.src = track.cover;
    symbol.alt = "Cover artwork for " + track.title;
    symbol.loading = "lazy";
  } else {
    symbol.innerHTML = ICONS[track.category] || ICONS.other;
  }

  const copy = document.createElement("span");
  copy.className = "track-copy";
  const title = document.createElement("span");
  title.className = "track-title";
  setText(title, track.title);
  const meta = document.createElement("span");
  meta.className = "track-meta";
  const collection = getCollection(track.category);
  setText(meta, [track.project, collection ? collection.title : "Other"].filter(Boolean).join(" · "));
  copy.append(title, meta);

  const tags = document.createElement("span");
  tags.className = "track-tags";
  track.genres.slice(0, 2).forEach(function (genre) {
    const tag = document.createElement("span");
    tag.className = "track-tag";
    setText(tag, genre);
    tags.appendChild(tag);
  });

  const date = document.createElement("time");
  date.className = "track-date";
  date.dateTime = track.date;
  setText(date, displayDate(track.date));

  const arrow = document.createElement("span");
  arrow.className = "track-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "›";

  button.append(symbol, copy, tags, date, arrow);
  button.addEventListener("click", function () { openTrack(track); });
  row.appendChild(button);

  if (track.audio || track.playback) {
    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "track-listen";
    listen.textContent = "Listen";
    listen.setAttribute("aria-pressed", "false");
    listen.addEventListener("click", function (event) {
      event.stopPropagation();
      playTrack(track, listen);
    });
    row.appendChild(listen);
  }

  item.appendChild(row);
  return item;
}
function render() {
  const collection = getCollection(state.category);
  const title = collection ? collection.title : "Library";
  setText(elements.title, title);
  setText(elements.catalogTitle, collection ? collection.title : "All music");
  document.title = "Crimson — " + title;

  renderCollections();
  renderGenres();

  const results = filteredTracks();
  elements.list.replaceChildren();
  results.forEach(function (track) { elements.list.appendChild(makeTrackRow(track)); });
  setText(elements.count, results.length + (results.length === 1 ? " piece" : " pieces"));

  elements.empty.hidden = results.length > 0;
  elements.list.hidden = results.length === 0;
  if (state.loadError) {
    setText(elements.emptyTitle, "Catalog unavailable");
    setText(elements.emptyMessage, "The music catalog could not be loaded. Check that music.json is available, then refresh the page.");
  } else if (state.search || state.genre) {
    setText(elements.emptyTitle, "No matches");
    setText(elements.emptyMessage, "Try another search or clear the active filters.");
  } else if (collection) {
    setText(elements.emptyTitle, "No music in this collection yet");
    setText(elements.emptyMessage, "Pieces added to " + collection.title + " will appear here.");
  } else {
    setText(elements.emptyTitle, "The library is empty");
    setText(elements.emptyMessage, "There are no pieces in the catalog yet. Add real releases to music.json when they are ready.");
  }
}

function addAssetLink(container, label, url, download) {
  if (!url) return;
  const link = document.createElement("a");
  link.className = "asset-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (download) link.setAttribute("download", "");
  setText(link, label);
  container.appendChild(link);
}

function addAssetSection(parent, heading, content) {
  const section = document.createElement("section");
  section.className = "asset-section";
  const title = document.createElement("h3");
  setText(title, heading);
  section.appendChild(title);
  section.appendChild(content);
  parent.appendChild(section);
}

function openTrack(track) {
  stopPlayback();
  elements.dialogContent.replaceChildren();

  if (track.cover) {
    const cover = document.createElement("img");
    cover.className = "dialog-cover";
    cover.src = track.cover;
    cover.alt = "Cover artwork for " + track.title;
    elements.dialogContent.appendChild(cover);
  }

  const title = document.createElement("h2");
  title.className = "dialog-title";
  title.id = "dialog-title";
  setText(title, track.title);

  const subtitle = document.createElement("p");
  subtitle.className = "dialog-subtitle";
  const collection = getCollection(track.category);
  setText(subtitle, [track.project, collection ? collection.title : "Other", displayDate(track.date)].filter(Boolean).join(" · "));

  elements.dialogContent.append(title, subtitle);

  if (track.description) {
    const description = document.createElement("p");
    description.className = "dialog-description";
    setText(description, track.description);
    elements.dialogContent.appendChild(description);
  }

  if (track.audio) {
    const player = document.createElement("audio");
    player.controls = true;
    player.preload = "metadata";
    player.src = track.audio;
    player.setAttribute("aria-label", "Audio player for " + track.title);
    const listenPanel = document.createElement("div");
    listenPanel.className = "preview-panel";
    listenPanel.appendChild(player);
    const audioDownloads = document.createElement("div");
    audioDownloads.className = "asset-links";
    addAssetLink(audioDownloads, "Download MP3 ↓", track.audio, true);
    listenPanel.appendChild(audioDownloads);
    addAssetSection(elements.dialogContent, "LISTEN", listenPanel);
  } else if (track.playback) {
    const preview = document.createElement("div");
    preview.className = "preview-panel";
    const listen = document.createElement("button");
    listen.type = "button";
    listen.className = "asset-link preview-play";
    listen.textContent = "Listen to preview";
    listen.addEventListener("click", function () { playTrack(track, listen); });
    const note = document.createElement("p");
    note.className = "preview-note";
    setText(note, "Synthesized from the score's note sequence. French horn tone is an electronic preview.");
    preview.append(listen, note);
    addAssetSection(elements.dialogContent, "LISTEN", preview);
  }

  if (track.score) {
    const links = document.createElement("div");
    links.className = "asset-links";
    addAssetLink(links, "Open sheet music ↗", track.score, false);
    addAssetLink(links, "Download PDF ↓", track.score, true);
    addAssetSection(elements.dialogContent, "SHEET MUSIC", links);
    if (/\.pdf(?:$|[?#])/i.test(track.score)) {
      const preview = document.createElement("iframe");
      preview.className = "score-preview";
      preview.src = track.score;
      preview.title = "Sheet music preview for " + track.title;
      preview.loading = "lazy";
      const previewWrap = document.createElement("div");
      previewWrap.appendChild(preview);
      addAssetSection(elements.dialogContent, "PREVIEW", previewWrap);
    }
  }

  if (track.parts.length) {
    const list = document.createElement("div");
    list.className = "part-list";
    track.parts.forEach(function (part) {
      const row = document.createElement("div");
      row.className = "part-row";
      const instrument = document.createElement("strong");
      setText(instrument, part.instrument);
      const link = document.createElement("a");
      link.href = part.file;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      setText(link, "Open part ↗");
      row.append(instrument, link);
      list.appendChild(row);
    });
    addAssetSection(elements.dialogContent, "INDIVIDUAL PARTS", list);
  }

  if (track.files.length) {
    const links = document.createElement("div");
    links.className = "asset-links";
    track.files.forEach(function (file) { addAssetLink(links, file.label + " ↗", file.file, true); });
    addAssetSection(elements.dialogContent, "FILES", links);
  }

  if (!track.audio && !track.playback && !track.score && !track.parts.length && !track.files.length) {
    const note = document.createElement("p");
    note.className = "dialog-description";
    setText(note, "No audio or downloadable files have been attached to this entry.");
    elements.dialogContent.appendChild(note);
  }

  if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
}

elements.search.addEventListener("input", function (event) {
  state.search = event.target.value.trim();
  render();
});
elements.sort.addEventListener("change", function (event) {
  state.sort = event.target.value;
  render();
});
elements.dialogClose.addEventListener("click", function () { elements.dialog.close(); });
elements.dialog.addEventListener("click", function (event) {
  if (event.target === elements.dialog) elements.dialog.close();
});
document.addEventListener("keydown", function (event) {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
});

if (!COLLECTIONS.some(function (item) { return item.id === state.category; })) state.category = "all";

fetch("music.json")
  .then(function (response) {
    if (!response.ok) throw new Error("Could not load music.json");
    return response.json();
  })
  .then(function (data) {
    if (!Array.isArray(data)) throw new Error("music.json must contain an array");
    state.tracks = data.map(normalizeTrack).filter(Boolean);
    render();
  })
  .catch(function () {
    state.loadError = true;
    render();
  });
