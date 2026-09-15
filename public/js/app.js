/* =====================================================================
   DuoCore — page logic (rendering, animations, live refresh)
   ===================================================================== */
(function () {
  "use strict";

  const cfg = window.DUOCORE_CONFIG || {};
  const R = window.DuoCoreRoblox;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  // Animations are always enabled, regardless of the visitor's OS/browser
  // "reduce motion" preference — this is a deliberate site choice.
  const reduceMotion = false;

  /* ---------- formatting ---------- */
  function fmt(n) {
    n = Number(n) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e9) return trim(n / 1e9) + "B";
    if (abs >= 1e6) return trim(n / 1e6) + "M";
    if (abs >= 1e3) return trim(n / 1e3) + "K";
    return String(Math.round(n));
  }
  function trim(x) { return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toString(); }
  const full = (n) => (Number(n) || 0).toLocaleString("en-US");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function timeAgo(iso) {
    if (!iso) return "";
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 45) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }
  const likeRatio = (g) => (g.upVotes != null && g.downVotes != null && g.upVotes + g.downVotes > 0) ? Math.round((g.upVotes / (g.upVotes + g.downVotes)) * 100) : null;
  const gameUrl = (g) => `https://www.roblox.com/games/${g.placeId}`;
  const groupUrl = (id) => `https://www.roblox.com/groups/${id}`;
  const userUrl = (id) => `https://www.roblox.com/users/${id}/profile`;

  const ICONS = {
    gamepad: '<svg viewBox="0 0 24 24"><path d="M7 6h10a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5h-1.5l-1.2-2H9.7l-1.2 2H7a5 5 0 0 1-5-5v-2a5 5 0 0 1 5-5Zm1 4H6.5v1.5H5v1h1.5V14H8v-1.5h1.5v-1H8V10Zm8 .5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 19h16v2H2V3h2v16Zm3-2V11h3v6H7Zm5 0V6h3v11h-3Zm5 0v-4h3v4h-3Z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-7 1.7-7 4v2h14v-2c0-2.3-3.7-4-7-4Zm7.5-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-.6 0-1.2.1-1.7.2 1.6 1 2.7 2.4 2.7 3.8v2H22v-2c0-2.2-3.4-4-5.5-4Z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 2 3 6.6 7 .8-5.2 4.8 1.4 7.1L12 17.8 5.8 21.3l1.4-7.1L2 9.4l7-.8L12 2Z"/></svg>',
    rocket: '<svg viewBox="0 0 24 24"><path d="M14 3c3.2 0 6.4 1.6 7 2.1-.4 3.4-2 6.5-4.6 9L14 16.5V20l-3 3-1.3-4.3L5.3 14.3 1 13l3-3h3.5L9.9 7.6C12.3 5.2 13 3.4 14 3Zm1.5 5A1.5 1.5 0 1 0 17 9.5 1.5 1.5 0 0 0 15.5 8Z"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M12 5c5 0 9.3 3.1 11 7-1.7 3.9-6 7-11 7S2.7 15.9 1 12c1.7-3.9 6-7 11-7Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/></svg>',
    thumb: '<svg viewBox="0 0 24 24"><path d="M2 10h4v11H2V10Zm20 1a2 2 0 0 0-2-2h-5.3l.9-4.3a1.5 1.5 0 0 0-.4-1.4L14.2 2 8.6 8.2A2 2 0 0 0 8 9.6V19a2 2 0 0 0 2 2h7.4a2 2 0 0 0 1.9-1.4l2.6-7.3a2 2 0 0 0 .1-.6V11Z"/></svg>',
    people: '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5Z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M6 4.5v15L19 12 6 4.5Z"/></svg>',
    verified: '<svg class="verified" viewBox="0 0 24 24" aria-label="Verified"><path d="M12 1.5 14.8 4l3.7-.4 1 3.6 3.2 1.9-1.5 3.4 1.5 3.4-3.2 1.9-1 3.6-3.7-.4L12 22.5 9.2 20l-3.7.4-1-3.6-3.2-1.9 1.5-3.4L1.3 9l3.2-1.9 1-3.6 3.7.4L12 1.5Zm-1.4 13.9 6-6-1.4-1.4-4.6 4.6-2.2-2.2-1.4 1.4 3.6 3.6Z"/></svg>',
    external: '<svg viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"/></svg>',
  };

  /* ---------- static content from config ---------- */
  function applyConfig() {
    const s = cfg.studio || {};
    $$("[data-studio-name]").forEach((el) => (el.textContent = s.name || "DuoCore"));
    $$("[data-hero-text]").forEach((el) => (el.textContent = s.heroText || ""));
    $$("[data-copyright]").forEach((el) => (el.textContent = s.copyright || ""));
    $$("[data-discord]").forEach((el) => (el.href = s.discord || "#"));
    $$("[data-group-link]").forEach((el) => { if (s.robloxGroup) el.href = s.robloxGroup; else el.hidden = true; });

    const title = $("[data-hero-title]");
    if (title) {
      const words = (s.heroTitle || "We build games players come back to.").split(" ");
      // highlight the last two words with a gradient
      const cut = Math.max(0, words.length - 2);
      title.innerHTML = `${esc(words.slice(0, cut).join(" "))} <span class="grad">${esc(words.slice(cut).join(" "))}</span>`;
    }

    const emailBtn = $("[data-email]");
    if (emailBtn) {
      if (s.email) { emailBtn.hidden = false; emailBtn.href = "mailto:" + s.email; $("[data-email-text]", emailBtn).textContent = s.email; }
      else emailBtn.hidden = true;
    }

    const about = cfg.about || {};
    const h = $("[data-about-heading]");
    if (h && about.heading) h.textContent = about.heading;
    const paras = $("[data-about-paragraphs]");
    if (paras) paras.innerHTML = (about.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("");
    const pillars = $("#pillars");
    if (pillars) {
      pillars.innerHTML = (about.pillars || []).map((p, i) => `
        <div class="pillar reveal" style="--d:${i * 90}ms">
          <div class="pillar__icon">${ICONS[p.icon] || ICONS.star}</div>
          <div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>
        </div>`).join("");
    }
    document.title = `${s.name || "DuoCore"} — Roblox Game Studio`;
  }

  /* ---------- counters ---------- */
  const shown = new Map();
  function setNumber(el, value, { animate = true } = {}) {
    const suffix = el.dataset.suffix || "";
    const from = shown.get(el) ?? 0;
    const to = Number(value) || 0;
    shown.set(el, to);
    if (!animate || reduceMotion || from === to) { el.textContent = fmt(to) + (to > 0 ? suffix : ""); return; }
    const dur = 1200, start = performance.now();
    if (el._raf) cancelAnimationFrame(el._raf);
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * e;
      el.textContent = fmt(v) + (to > 0 ? suffix : "");
      if (t < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
    el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick");
  }

  /* ---------- rendering ---------- */
  let currentSort = cfg.gamesSort || "playing";
  let state = { data: null };

  function sortGames(games) {
    const list = games.slice();
    if (currentSort === "playing") list.sort((a, b) => (b.playing || 0) - (a.playing || 0) || (b.visits || 0) - (a.visits || 0));
    else if (currentSort === "visits") list.sort((a, b) => (b.visits || 0) - (a.visits || 0));
    else if (currentSort === "newest") list.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
    return list;
  }

  function renderStats(data) {
    const games = data.games || [];
    const playing = games.reduce((s, g) => s + (g.playing || 0), 0);
    const visits = games.reduce((s, g) => s + (g.visits || 0), 0);
    const favorites = games.reduce((s, g) => s + (g.favorites || 0), 0);
    const map = { playing, visits, games: games.length, favorites };
    $$("[data-stat]").forEach((el) => {
      const key = el.dataset.stat;
      if (key in map) setNumber(el, map[key]);
    });
  }

  function gameCard(g, i, topId) {
    const creator = g.creator || {};
    const by = creator.type === "Group"
      ? `<a href="${groupUrl(creator.id)}" target="_blank" rel="noopener">${esc(creator.name)}</a>`
      : creator.id ? `<a href="${userUrl(creator.id)}" target="_blank" rel="noopener">${esc(creator.name)}</a>` : esc(creator.name || "");
    const ratio = likeRatio(g);
    return `
      <article class="game reveal" style="--d:${(i % 3) * 90}ms" data-place="${g.placeId}">
        <a class="game__media" href="${gameUrl(g)}" target="_blank" rel="noopener" aria-label="Play ${esc(g.name)}">
          ${g.thumbnail ? `<img src="${esc(g.thumbnail)}" alt="" loading="lazy" decoding="async">` : ""}
          <div class="game__badges">
            <span class="badge badge--live"><span class="live-dot" aria-hidden="true"></span><span data-card-playing>${full(g.playing)}</span> playing</span>
          </div>
        </a>
        <div class="game__body">
          <h3 class="game__title"><a href="${gameUrl(g)}" target="_blank" rel="noopener">${esc(g.name)}</a></h3>
          <div class="game__by">by ${by}${creator.hasVerifiedBadge ? ICONS.verified : ""}</div>
          ${g.description ? `<p class="game__desc">${esc(g.description)}</p>` : ""}
          <div class="game__meta">
            <span title="${full(g.visits)} visits">${ICONS.eye}<b data-card-visits>${fmt(g.visits)}</b> visits</span>
            ${ratio != null ? `<span title="${full(g.upVotes)} likes">${ICONS.thumb}<b data-card-likes>${ratio}%</b></span>` : `<span title="${full(g.favorites)} favorites">${ICONS.star}<b data-card-favs>${fmt(g.favorites)}</b></span>`}
          </div>
          <div class="game__footer">
            <span class="game__genre">${esc(g.genre || "Roblox")}</span>
            <a class="game__play" href="${gameUrl(g)}" target="_blank" rel="noopener">${ICONS.play} Play</a>
          </div>
        </div>
      </article>`;
  }

  const signatures = {};
  function changed(key, value) {
    const sig = JSON.stringify(value);
    if (signatures[key] === sig) return false;
    signatures[key] = sig;
    return true;
  }

  function renderGames(data, { force = false } = {}) {
    const grid = $("#gamesGrid");
    if (!grid) return;
    const games = sortGames(data.games || []);
    const top = games.slice().sort((a, b) => (b.playing || 0) - (a.playing || 0))[0];
    const topId = top && top.universeId;
    if (!games.length) { grid.innerHTML = `<div class="games__empty">No games yet — add Roblox game links in <code>js/config.js</code>.</div>`; return; }

    const structure = games.map((g) => [g.placeId, g.name, g.thumbnail, g.description, g.genre, g.creator && g.creator.name, likeRatio(g) != null]);
    const rebuild = force || changed("games", structure) || grid.children.length !== games.length;

    if (!rebuild) {
      // live update in place: numbers only, then reorder without flicker
      games.forEach((g) => {
        const card = grid.querySelector(`[data-place="${g.placeId}"]`);
        if (!card) return;
        const p = $("[data-card-playing]", card); if (p) p.textContent = full(g.playing);
        const v = $("[data-card-visits]", card); if (v) v.textContent = fmt(g.visits);
        const l = $("[data-card-likes]", card); const r = likeRatio(g); if (l && r != null) l.textContent = r + "%";
        const f = $("[data-card-favs]", card); if (f) f.textContent = fmt(g.favorites);
        grid.appendChild(card);
      });
      return;
    }
    const wasVisible = grid.children.length > 0 && grid.getBoundingClientRect().top < window.innerHeight;
    grid.innerHTML = games.map((g, i) => gameCard(g, i, topId)).join("");
    if (wasVisible) $$(".reveal", grid).forEach((el) => el.classList.add("is-in"));
    observeReveals(grid);
  }

  function renderTeam(data) {
    const grid = $("#team");
    if (!grid) return;
    const team = cfg.team || [];
    if (!changed("team", [team, data.team])) return;
    const wasVisible = grid.children.length > 0 && grid.getBoundingClientRect().top < window.innerHeight;
    grid.innerHTML = team.map((m, i) => {
      const id = R.parseUserId(m.profile);
      const u = (data.team || []).find((t) => t.userId === id) || {};
      const name = u.displayName || u.name || "Roblox user";
      return `
        <a class="member reveal" style="--d:${i * 90}ms" href="${id ? userUrl(id) : esc(m.profile)}" target="_blank" rel="noopener">
          <div class="member__avatar"><img src="${esc(u.headshot || "")}" alt="${esc(name)}'s Roblox avatar" loading="lazy" decoding="async"></div>
          <div class="member__name">${esc(name)}${u.hasVerifiedBadge ? ICONS.verified : ""}</div>
          ${u.name ? `<div class="member__handle">@${esc(u.name)}</div>` : ""}
          <div class="member__role">${esc(m.role || "")}</div>
          <span class="member__link">View Roblox profile ${ICONS.external}</span>
        </a>`;
    }).join("");
    if (wasVisible) $$(".reveal", grid).forEach((el) => el.classList.add("is-in"));
    observeReveals(grid);
  }

  function renderGroup(data) {
    const id = R.parseGroupId(cfg.studio && cfg.studio.robloxGroup);
    const g = id && data.groups ? data.groups[id] : null;
    $$("[data-group-name]").forEach((el) => { if (g && g.name) el.textContent = g.name; });
    $$("[data-group-members]").forEach((el) => { el.textContent = g && g.memberCount ? `${fmt(g.memberCount)} members` : ""; });
  }

  function renderCollage(data) {
    const el = $("#collage");
    if (!el) return;
    const thumbs = (data.games || []).map((g) => g.thumbnail).filter(Boolean);
    if (!thumbs.length || !changed("collage", thumbs)) return;
    const tiles = [];
    for (let i = 0; i < 20; i++) tiles.push(thumbs[i % thumbs.length]);
    el.innerHTML = tiles.map((src) => `<img src="${esc(src)}" alt="" decoding="async">`).join("");
    const first = el.querySelector("img");
    const ready = () => el.classList.add("is-ready");
    if (first && !first.complete) { first.addEventListener("load", ready, { once: true }); first.addEventListener("error", ready, { once: true }); }
    else ready();
  }

  function renderMarquee(data) {
    const el = $("#marquee");
    if (!el) return;
    const items = (data.games || []).filter((g) => g.icon);
    if (!items.length) { el.parentElement.hidden = true; return; }
    el.parentElement.hidden = false;
    if (!changed("marquee", items.map((g) => [g.placeId, g.icon, g.name, fmt(g.visits)]))) return;
    const html = items.map((g) => `<a class="marquee__item" href="${gameUrl(g)}" target="_blank" rel="noopener" tabindex="-1"><img src="${esc(g.icon)}" alt="" loading="lazy"><span><b>${esc(g.name)}</b> · ${fmt(g.visits)} visits</span></a>`).join("");
    el.innerHTML = html + html; // duplicated for a seamless loop
  }

  function renderAll(data) {
    state.data = data;
    renderStats(data);
    renderGames(data);
    renderTeam(data);
    renderCollage(data);
    renderMarquee(data);
    renderGroup(data);
  }

  /* ---------- reveal on scroll ---------- */
  let io;
  function observeReveals(root) {
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    }
    $$(".reveal:not(.is-in)", root).forEach((el) => io.observe(el));
  }

  /* ---------- smooth scrolling (Lenis) + eased anchor navigation ---------- */
  let lenis = null;
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  function initSmoothScroll() {
    if (reduceMotion || typeof window.Lenis !== "function") return;
    try {
      lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true, autoRaf: true, anchors: false });
    } catch (e) { lenis = null; }
  }

  function scrollToHash(hash, { push = true } = {}) {
    const id = (hash || "").replace(/^#/, "");
    const target = id ? document.getElementById(id) : null;
    if (!target) return false;
    // Lenis honours the CSS scroll-padding-top (navbar height), so no manual offset here
    if (lenis) lenis.scrollTo(target, { duration: 1.35, easing: easeOut });
    else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (push && history.pushState) history.pushState(null, "", "#" + id);
    return true;
  }

  function initAnchors() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute("href") === "#" || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (scrollToHash(a.getAttribute("href"))) e.preventDefault();
    });
    window.addEventListener("popstate", () => { if (location.hash) scrollToHash(location.hash, { push: false }); });
    if (location.hash) setTimeout(() => scrollToHash(location.hash, { push: false }), 150);
  }

  /* ---------- nav ---------- */
  function initNav() {
    const nav = $("#nav"), links = $("#navLinks"), toggle = $("#navToggle");
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    links.addEventListener("click", (e) => { if (e.target.closest("a")) { links.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); } });

    // active section highlight
    const sections = ["home", "about", "games", "contact"].map((id) => document.getElementById(id)).filter(Boolean);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        $$("[data-nav]").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === e.target.id));
      });
    }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }

  function initSort() {
    const box = $("#sort");
    if (!box) return;
    $$("button", box).forEach((b) => b.classList.toggle("is-active", b.dataset.sort === currentSort));
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sort]");
      if (!b || b.dataset.sort === currentSort) return;
      currentSort = b.dataset.sort;
      $$("button", box).forEach((x) => x.classList.toggle("is-active", x === b));
      if (state.data) renderGames(state.data, { force: true });
    });
  }

  /* ---------- live data loop ---------- */
  async function start() {
    applyConfig();
    initSmoothScroll();
    initAnchors();
    initNav();
    initSort();
    observeReveals(document);

    // 1. paint instantly with cached / snapshot data
    renderAll(R.initialData());

    // 2. fetch everything live
    try {
      renderAll(await R.loadAll());
    } catch (err) {
      console.warn("[DuoCore] live data unavailable:", err);
      const status = $("#statsStatus");
      if (status) {
        if ((cfg.api || {}).mode === "snapshot") {
          status.textContent = `Design preview · numbers are a snapshot from ${new Date(state.data.fetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — the live site refreshes them automatically`;
        } else {
          status.classList.add("is-error");
          status.textContent = "Couldn't reach the Roblox API — showing last known numbers.";
        }
      }
      return; // nothing to refresh
    }

    // 3. keep the numbers fresh (full reload of names/thumbnails/team every 10th tick)
    const every = Math.max(20, Number(cfg.refreshSeconds) || 60) * 1000;
    let ticks = 0;
    setInterval(async () => {
      if (document.hidden || !state.data || !state.data.games.length) return;
      try {
        ticks++;
        renderAll(ticks % 10 === 0 ? await R.loadAll() : await R.refreshLive(state.data));
      } catch (err) { console.warn("[DuoCore] refresh failed:", err); }
    }, every);
    setInterval(() => { if (state.data && state.data.fetchedAt) renderStats(state.data); }, 30000); // keep "updated x ago" fresh
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
