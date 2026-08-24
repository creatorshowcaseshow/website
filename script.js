(() => {
  const STORAGE_KEY = "creatorShowcase.names.v3";
  const HISTORY_SESSION_KEY = "creatorShowcase.history.v1";

  const navEntries = performance.getEntriesByType("navigation");
  const IS_RELOAD = navEntries.length
    ? navEntries[0].type === "reload"
    : !!(performance.navigation && performance.navigation.type === 1);

  const COLOR_PALETTE = [
    "#ff3d9a", // pink
    "#ffd23f", // yellow
    "#3ff0ff", // cyan
    "#8b5cf6", // violet
    "#ff8a3d", // orange
    "#5cff9d", // mint
  ];

  const BOOST_WEIGHT = 2; // odds multiplier for names passed over before

  const canvas = document.getElementById("wheelCanvas");
  const ctx = canvas.getContext("2d");
  const pointer = document.getElementById("pointer");
  const hubBtn = document.getElementById("hubBtn");
  const nameForm = document.getElementById("nameForm");
  const nameInput = document.getElementById("nameInput");
  const bulkToggleBtn = document.getElementById("bulkToggleBtn");
  const bulkPanel = document.getElementById("bulkPanel");
  const bulkInput = document.getElementById("bulkInput");
  const bulkAddBtn = document.getElementById("bulkAddBtn");
  const nameList = document.getElementById("nameList");
  const emptyState = document.getElementById("emptyState");
  const boostHint = document.getElementById("boostHint");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const clearBtn = document.getElementById("clearBtn");
  const resultTicket = document.getElementById("resultTicket");
  const resultName = document.getElementById("resultName");
  const ticketClose = document.getElementById("ticketClose");
  const removeWinnerBtn = document.getElementById("removeWinnerBtn");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const historyList = document.getElementById("historyList");
  const currentWinner = document.getElementById("currentWinner");
  const currentWinnerName = document.getElementById("currentWinnerName");

  /** @type {{name: string, color: string, weight: number}[]} */
  let entries = loadEntries();
  let currentRotation = 0; // radians
  let spinning = false;
  let history = loadHistory();
  let currentWinnerIndex = -1;

  function loadHistory() {
    // A refresh should reset the history — a navigation to another page and
    // back (in the same tab) should not.
    if (IS_RELOAD) {
      sessionStorage.removeItem(HISTORY_SESSION_KEY);
      return [];
    }

    try {
      const raw = sessionStorage.getItem(HISTORY_SESSION_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry) => ({ name: entry.name, time: new Date(entry.time) }));
    } catch {
      return [];
    }
  }

  function saveHistory() {
    sessionStorage.setItem(HISTORY_SESSION_KEY, JSON.stringify(history));
  }

  function loadEntries() {
    // Same rule as history: a refresh clears the wheel, navigating to
    // another page and back (same tab) keeps it.
    if (IS_RELOAD) {
      sessionStorage.removeItem(STORAGE_KEY);
      return defaultEntries();
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultEntries();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
      return defaultEntries();
    } catch {
      return defaultEntries();
    }
  }

  function defaultEntries() {
    return [];
  }

  function saveEntries() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function colorForIndex(i) {
    return COLOR_PALETTE[i % COLOR_PALETTE.length];
  }

  // ---------- Rendering ----------

  function getSliceBoundaries() {
    const totalWeight = entries.reduce((sum, e) => sum + (e.weight || 1), 0) || 1;
    let acc = 0;
    return entries.map((entry) => {
      const w = entry.weight || 1;
      const start = (acc / totalWeight) * Math.PI * 2;
      acc += w;
      const end = (acc / totalWeight) * Math.PI * 2;
      return { start, end };
    });
  }

  function drawWheel() {
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 6;
    const hubRadius = 56; // keep text clear of the SPIN button

    ctx.clearRect(0, 0, size, size);

    if (entries.length === 0) {
      ctx.save();
      ctx.fillStyle = "#241539";
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a6d92";
      ctx.font = "600 22px 'Space Grotesk', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Add names to build", center, center - 110);
      ctx.fillText("the wheel", center, center - 80);
      ctx.restore();
      return;
    }

    const boundaries = getSliceBoundaries();
    const maxLabelWidth = radius - 24 - hubRadius;

    entries.forEach((entry, i) => {
      const b = boundaries[i];
      const start = currentRotation + b.start;
      const end = currentRotation + b.end;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = entry.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(11, 6, 21, 0.55)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // label
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate((start + end) / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#120a1f";
      ctx.font = "700 22px 'Space Grotesk', sans-serif";
      const label = fitLabel(entry.name, maxLabelWidth);
      ctx.fillText(label, radius - 24, 0);
      ctx.restore();
    });

    // center hub ring
    ctx.beginPath();
    ctx.arc(center, center, 50, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0615";
    ctx.fill();
  }

  function fitLabel(str, maxWidth) {
    if (ctx.measureText(str).width <= maxWidth) return str;
    let truncated = str;
    while (truncated.length > 1 && ctx.measureText(truncated + "…").width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "…";
  }

  // ---------- Entry list UI ----------

  function renderList() {
    nameList.innerHTML = "";
    emptyState.hidden = entries.length !== 0;
    boostHint.hidden = entries.length === 0;

    entries.forEach((entry, i) => {
      const boosted = (entry.weight || 1) > 1;
      const li = document.createElement("li");
      if (boosted) li.classList.add("is-boosted");

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = entry.color;

      const label = document.createElement("span");
      label.className = "entry-name";
      label.textContent = entry.name;

      const boostBtn = document.createElement("button");
      boostBtn.className = "boost-btn" + (boosted ? " is-active" : "");
      boostBtn.type = "button";
      boostBtn.title = "Toggle better odds (passed over before)";
      boostBtn.setAttribute("aria-label", `Toggle boosted odds for ${entry.name}`);
      boostBtn.textContent = "★";
      boostBtn.addEventListener("click", () => toggleBoost(i));

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.type = "button";
      removeBtn.setAttribute("aria-label", `Remove ${entry.name}`);
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => removeEntry(i));

      li.append(swatch, label, boostBtn, removeBtn);
      nameList.appendChild(li);
    });

    hubBtn.disabled = entries.length < 2;
    drawWheel();
  }

  function pushEntry(name, boosted) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    entries.push({
      name: trimmed,
      color: colorForIndex(entries.length),
      weight: boosted ? BOOST_WEIGHT : 1,
    });
    return true;
  }

  function addEntry(name) {
    if (pushEntry(name, false)) {
      saveEntries();
      renderList();
    }
  }

  function addBulkEntries(text) {
    const lines = text.split(/\r?\n/);
    let addedAny = false;

    lines.forEach((line) => {
      if (!line.trim()) return;
      let parts = line.split("\t");
      if (parts.length === 1) parts = line.split(",");
      const name = parts[0];
      const flag = parts[1] ? parts[1].trim() : "";
      const boosted = /^(y|yes|true|1|x)$/i.test(flag);
      if (pushEntry(name, boosted)) addedAny = true;
    });

    if (addedAny) {
      saveEntries();
      renderList();
    }
    return addedAny;
  }

  function toggleBoost(index) {
    const entry = entries[index];
    if (!entry) return;
    entry.weight = (entry.weight || 1) > 1 ? 1 : BOOST_WEIGHT;
    saveEntries();
    renderList();
  }

  function removeEntry(index) {
    entries.splice(index, 1);
    saveEntries();
    renderList();
  }

  function shuffleColors() {
    entries = entries.map((entry, i) => ({
      ...entry,
      color: colorForIndex(Math.floor(Math.random() * COLOR_PALETTE.length) + i),
    }));
    // ensure adjacent slices don't repeat too predictably
    entries.forEach((entry, i) => {
      entry.color = COLOR_PALETTE[(i + Math.floor(Math.random() * COLOR_PALETTE.length)) % COLOR_PALETTE.length];
    });
    saveEntries();
    renderList();
  }

  function clearAll() {
    if (entries.length === 0) return;
    const confirmed = confirm("Remove every name from the wheel?");
    if (!confirmed) return;
    entries = [];
    saveEntries();
    renderList();
    modalBackdrop.hidden = true;
  }

  // ---------- Spin logic ----------

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function spin() {
    if (spinning || entries.length < 2) return;
    spinning = true;
    hubBtn.disabled = true;
    modalBackdrop.hidden = true;

    const extraSpins = 5 + Math.random() * 3; // 5-8 full rotations
    const randomOffset = Math.random() * Math.PI * 2;
    const totalRotation = extraSpins * Math.PI * 2 + randomOffset;

    const startRotation = currentRotation;
    const targetRotation = startRotation + totalRotation;
    const duration = 4200;
    const startTime = performance.now();

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(t);
      currentRotation = startRotation + (targetRotation - startRotation) * eased;
      drawWheel();

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        finishSpin();
      }
    }

    requestAnimationFrame(frame);
  }

  function finishSpin() {
    spinning = false;
    hubBtn.disabled = entries.length < 2;

    // Pointer sits at the top (angle = -PI/2 in canvas terms, i.e. 270deg).
    // Normalize rotation and find which weighted slice sits under the pointer.
    const boundaries = getSliceBoundaries();
    const normalized = ((currentRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const pointerAngle = ((Math.PI * 1.5) - normalized + Math.PI * 2) % (Math.PI * 2);
    let winningIndex = boundaries.findIndex((b) => pointerAngle >= b.start && pointerAngle < b.end);
    if (winningIndex === -1) winningIndex = entries.length - 1;
    const winner = entries[winningIndex];

    pointer.classList.remove("bounce");
    void pointer.offsetWidth; // restart animation
    pointer.classList.add("bounce");

    resultName.textContent = winner.name;
    currentWinnerIndex = winningIndex;
    modalBackdrop.hidden = false;

    currentWinnerName.textContent = winner.name;
    currentWinner.hidden = false;

    addHistory(winner.name);
  }

  function addHistory(name) {
    history.unshift({ name, time: new Date() });
    history = history.slice(0, 12);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = `<li class="history-empty">Winners will show up here after each spin.</li>`;
      return;
    }
    historyList.innerHTML = "";
    history.forEach((entry) => {
      const li = document.createElement("li");
      const time = entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      li.textContent = `${entry.name} — ${time}`;
      historyList.appendChild(li);
    });
  }

  // ---------- Events ----------

  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addEntry(nameInput.value);
    nameInput.value = "";
    nameInput.focus();
  });

  bulkToggleBtn.addEventListener("click", () => {
    const expanded = bulkToggleBtn.getAttribute("aria-expanded") === "true";
    bulkToggleBtn.setAttribute("aria-expanded", String(!expanded));
    bulkToggleBtn.textContent = expanded ? "Paste multiple names ▾" : "Paste multiple names ▴";
    bulkPanel.hidden = expanded;
    if (!expanded) bulkInput.focus();
  });

  bulkAddBtn.addEventListener("click", () => {
    if (addBulkEntries(bulkInput.value)) {
      bulkInput.value = "";
    }
  });

  shuffleBtn.addEventListener("click", shuffleColors);
  clearBtn.addEventListener("click", clearAll);
  hubBtn.addEventListener("click", spin);
  ticketClose.addEventListener("click", () => {
    modalBackdrop.hidden = true;
  });

  removeWinnerBtn.addEventListener("click", () => {
    if (currentWinnerIndex >= 0 && currentWinnerIndex < entries.length) {
      removeEntry(currentWinnerIndex);
      currentWinnerIndex = -1;
    }
    modalBackdrop.hidden = true;
  });

  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) {
      modalBackdrop.hidden = true;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalBackdrop.hidden) {
      modalBackdrop.hidden = true;
    }
  });

  // ---------- Init ----------

  renderList();
  renderHistory();

  if (history.length > 0) {
    currentWinnerName.textContent = history[0].name;
    currentWinner.hidden = false;
  }
})();
