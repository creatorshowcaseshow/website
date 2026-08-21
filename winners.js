(() => {
  const stage = document.getElementById("winnersStage");
  if (!stage || typeof SHOWCASE_MONTHS === "undefined") return;

  if (!SHOWCASE_MONTHS.length) {
    stage.innerHTML = `
      <div class="winners-placeholder">
        <p>Previous winners will show up here soon.</p>
      </div>
    `;
    return;
  }

  stage.innerHTML = "";

  SHOWCASE_MONTHS.forEach((monthEntry) => {
    const section = document.createElement("section");
    section.className = "month-block";

    const heading = document.createElement("h2");
    heading.className = "month-title";
    heading.textContent = monthEntry.month;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "winners-grid";

    monthEntry.winners.forEach((winner, i) => {
      grid.appendChild(buildCard(winner, i + 1));
    });

    section.appendChild(grid);
    stage.appendChild(section);
  });

  function copyCode(code, button) {
    navigator.clipboard.writeText(code).catch(() => {
      // Clipboard API unavailable or blocked — fall back to a manual select.
      const temp = document.createElement("textarea");
      temp.value = code;
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
    });

    if (button._copyTimeout) clearTimeout(button._copyTimeout);
    button.classList.add("is-copied");
    button._copyTimeout = setTimeout(() => {
      button.classList.remove("is-copied");
    }, 1400);
  }

  function buildCard(winner, position) {
    const card = document.createElement("article");
    card.className = "winner-card";

    // Thumbnail
    const thumb = document.createElement("div");
    thumb.className = "winner-thumb";
    if (winner.image) {
      const img = document.createElement("img");
      img.src = winner.image;
      img.alt = winner.title;
      thumb.appendChild(img);
    } else {
      thumb.classList.add("winner-thumb--empty");
      thumb.innerHTML = `<span>???</span>`;
    }
    card.appendChild(thumb);

    const body = document.createElement("div");
    body.className = "winner-body";

    const index = document.createElement("span");
    index.className = "winner-index";
    index.textContent = `#${position}`;
    body.appendChild(index);

    const title = document.createElement("h3");
    title.className = "winner-title";
    title.textContent = winner.title;
    body.appendChild(title);

    const desc = document.createElement("p");
    desc.className = "winner-desc";
    desc.textContent = winner.description;
    body.appendChild(desc);

    if (winner.creators && winner.creators.length) {
      const creatorRow = document.createElement("div");
      creatorRow.className = "winner-creators";
      winner.creators.forEach((creator) => {
        const link = document.createElement("a");
        link.className = "creator-pill";
        link.href = creator.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = creator.label;
        creatorRow.appendChild(link);
      });
      body.appendChild(creatorRow);
    }

    if (winner.code || winner.playUrl || winner.comingSoon) {
      const actions = document.createElement("div");
      actions.className = "winner-actions";

      if (winner.code) {
        const codeBtn = document.createElement("button");
        codeBtn.type = "button";
        codeBtn.className = "island-code";
        codeBtn.setAttribute("aria-label", `Copy island code ${winner.code}`);
        codeBtn.innerHTML = `
          <span class="island-code-label">Code</span>
          <span class="island-code-value-wrap">
            <span class="island-code-value">${winner.code}</span>
            <span class="island-code-copied">Copied!</span>
          </span>
        `;
        codeBtn.addEventListener("click", () => copyCode(winner.code, codeBtn));
        actions.appendChild(codeBtn);
      }

      if (winner.playUrl) {
        const playBtn = document.createElement("a");
        playBtn.className = "play-btn";
        playBtn.href = winner.playUrl;
        playBtn.target = "_blank";
        playBtn.rel = "noopener noreferrer";
        playBtn.textContent = "Play";
        actions.appendChild(playBtn);
      } else if (winner.comingSoon) {
        const soonBadge = document.createElement("span");
        soonBadge.className = "coming-soon-badge";
        soonBadge.textContent = "Coming Soon";
        actions.appendChild(soonBadge);
      }

      body.appendChild(actions);
    }

    card.appendChild(body);
    return card;
  }
})();