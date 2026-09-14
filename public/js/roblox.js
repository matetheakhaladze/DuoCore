/* =====================================================================
   DuoCore — Roblox data layer
   Turns the links in config.js into live data (games, team, groups).
   Works through the site's own proxy (server.js) or a public proxy.
   ===================================================================== */
(function () {
  "use strict";

  const cfg = window.DUOCORE_CONFIG || {};
  const api = Object.assign({ mode: "auto", proxyBase: "/api/rbx", publicBase: "https://{host}.roproxy.com" }, cfg.api || {});
  const LS_UNIVERSES = "duocore.universes.v1";
  const LS_DATA = "duocore.data.v1";

  /* ---------- helpers ---------- */
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode etc. */ } },
  };

  function parseId(url, pattern) {
    const s = String(url || "").trim();
    if (/^\d+$/.test(s)) return Number(s);
    const m = s.match(pattern);
    return m ? Number(m[1]) : null;
  }
  const parsePlaceId = (url) => parseId(url, /\/games\/(\d+)/);
  const parseUserId = (url) => parseId(url, /\/users\/(\d+)/);
  const parseGroupId = (url) => parseId(url, /\/(?:groups|communities)\/(\d+)/);

  function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  /* ---------- transport ---------- */
  const backends = {
    proxy: (host, path) => `${api.proxyBase.replace(/\/$/, "")}/${host}/${path}`,
    public: (host, path) => `${api.publicBase.replace("{host}", host)}/${path}`,
  };
  const order = api.mode === "auto" ? ["proxy", "public"] : api.mode in backends ? [api.mode] : [];
  const dead = new Set();

  async function rbx(host, path) {
    if (!order.length) throw new Error("snapshot mode: live data disabled");
    let lastErr = null;
    for (const name of order) {
      if (dead.has(name)) continue;
      const url = backends[name](host, path);
      try {
        const res = await fetch(url, { headers: { accept: "application/json" }, credentials: "omit" });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("json")) {
          // A static host answers /api/rbx with a 404 HTML page → this backend does not exist here.
          if (name === "proxy" && (res.status === 404 || !ct.includes("json"))) dead.add("proxy");
          throw new Error(`${host}/${path} → HTTP ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (name === "proxy" && err instanceof TypeError) dead.add("proxy"); // network error → not served here
      }
    }
    throw lastErr || new Error("No Roblox API backend available");
  }

  /* ---------- lookups ---------- */
  async function resolveUniverses(placeIds) {
    const cache = store.get(LS_UNIVERSES) || {};
    const missing = placeIds.filter((id) => !cache[id]);
    await Promise.all(
      missing.map(async (placeId) => {
        try {
          const r = await rbx("apis", `universes/v1/places/${placeId}/universe`);
          if (r && r.universeId) cache[placeId] = r.universeId;
        } catch (e) { /* leave unresolved */ }
      })
    );
    if (missing.length) store.set(LS_UNIVERSES, cache);
    return placeIds.map((id) => ({ placeId: id, universeId: cache[id] || null }));
  }

  async function fetchGames(universeIds) {
    const out = new Map();
    for (const ids of chunk(universeIds, 50)) {
      const r = await rbx("games", `v1/games?universeIds=${ids.join(",")}`);
      for (const g of r.data || []) out.set(g.id, g);
    }
    return out;
  }

  async function fetchVotes(universeIds) {
    const out = new Map();
    try {
      for (const ids of chunk(universeIds, 50)) {
        const r = await rbx("games", `v1/games/votes?universeIds=${ids.join(",")}`);
        for (const v of r.data || []) out.set(v.id, v);
      }
    } catch (e) { /* votes are optional (some public proxies block this endpoint) */ }
    return out;
  }

  async function fetchIcons(universeIds) {
    const out = new Map();
    try {
      for (const ids of chunk(universeIds, 50)) {
        const r = await rbx("thumbnails", `v1/games/icons?universeIds=${ids.join(",")}&size=512x512&format=Png&returnPolicy=PlaceHolder`);
        for (const t of r.data || []) if (t.imageUrl) out.set(t.targetId, t.imageUrl);
      }
    } catch (e) { /* optional */ }
    return out;
  }

  async function fetchThumbnails(universeIds) {
    const out = new Map();
    try {
      for (const ids of chunk(universeIds, 50)) {
        const r = await rbx("thumbnails", `v1/games/multiget/thumbnails?universeIds=${ids.join(",")}&size=768x432&format=Png&countPerUniverse=1&defaults=true`);
        for (const t of r.data || []) {
          const first = (t.thumbnails || [])[0];
          if (first && first.imageUrl) out.set(t.universeId, first.imageUrl);
        }
      }
    } catch (e) { /* optional */ }
    return out;
  }

  async function fetchUsers(userIds) {
    const users = new Map();
    await Promise.all(
      userIds.map(async (id) => {
        try { users.set(id, await rbx("users", `v1/users/${id}`)); } catch (e) { /* keep snapshot */ }
      })
    );
    const heads = new Map();
    try {
      for (const ids of chunk(userIds, 50)) {
        const r = await rbx("thumbnails", `v1/users/avatar-headshot?userIds=${ids.join(",")}&size=420x420&format=Png&isCircular=false`);
        for (const t of r.data || []) if (t.imageUrl) heads.set(t.targetId, t.imageUrl);
      }
    } catch (e) { /* optional */ }
    return { users, heads };
  }

  async function fetchGroups(groupIds) {
    const out = {};
    await Promise.all(
      groupIds.map(async (id) => {
        try {
          const g = await rbx("groups", `v1/groups/${id}`);
          out[id] = { name: g.name, memberCount: g.memberCount, hasVerifiedBadge: !!g.hasVerifiedBadge };
        } catch (e) { /* optional */ }
      })
    );
    return out;
  }

  /* ---------- assemble ---------- */
  function snapshotGame(placeId) {
    const snap = window.DUOCORE_SNAPSHOT || {};
    return (snap.games || []).find((g) => g.placeId === placeId) || null;
  }

  /** Turn a raw Roblox description into a short one-line blurb for the card. */
  function cleanDescription(text) {
    let lines = String(text || "")
      .split("\n")
      .map((s) => s.trim().replace(/^[-•*·]+\s*/, ""))
      .filter((s) => s && !/^-{3,}$/.test(s));
    const rest = lines.filter((s) => !/welcome to/i.test(s));
    if (rest.length) lines = rest;
    return lines.slice(0, 3).join(" · ").replace(/\s+/g, " ").slice(0, 160);
  }

  async function loadAll() {
    const placeIds = (cfg.games || []).map(parsePlaceId).filter(Boolean);
    const userIds = (cfg.team || []).map((m) => parseUserId(m.profile)).filter(Boolean);
    const mainGroupId = parseGroupId(cfg.studio && cfg.studio.robloxGroup);

    const resolved = await resolveUniverses(placeIds);
    const universeIds = resolved.map((r) => r.universeId).filter(Boolean);

    if (placeIds.length && !universeIds.length) throw new Error("Could not resolve any game links (Roblox API unreachable?)");

    const [games, votes, icons, thumbs, team] = await Promise.all([
      fetchGames(universeIds),
      fetchVotes(universeIds),
      fetchIcons(universeIds),
      fetchThumbnails(universeIds),
      fetchUsers(userIds),
    ]);
    if (universeIds.length && !games.size) throw new Error("Roblox games API returned no data");

    const gameList = resolved.map(({ placeId, universeId }) => {
      const g = universeId ? games.get(universeId) : null;
      const prev = snapshotGame(placeId) || {};
      if (!g) return prev.name ? prev : null;
      const v = votes.get(universeId);
      return {
        placeId,
        universeId,
        name: g.name,
        description: cleanDescription(g.description) || prev.description || "",
        creator: g.creator ? { id: g.creator.id, name: g.creator.name, type: g.creator.type, hasVerifiedBadge: !!g.creator.hasVerifiedBadge } : prev.creator,
        playing: g.playing || 0,
        visits: g.visits || 0,
        favorites: g.favoritedCount || 0,
        maxPlayers: g.maxPlayers,
        created: g.created,
        updated: g.updated,
        genre: g.genre_l2 || g.genre_l1 || g.genre || "",
        upVotes: v ? v.upVotes : (prev.upVotes ?? null),
        downVotes: v ? v.downVotes : (prev.downVotes ?? null),
        icon: icons.get(universeId) || prev.icon || "",
        thumbnail: thumbs.get(universeId) || prev.thumbnail || "",
      };
    }).filter(Boolean);

    const snapTeam = ((window.DUOCORE_SNAPSHOT || {}).team) || [];
    const teamList = userIds.map((id) => {
      const u = team.users.get(id);
      const prev = snapTeam.find((t) => t.userId === id) || {};
      return {
        userId: id,
        name: u ? u.name : prev.name || "",
        displayName: u ? u.displayName : prev.displayName || "",
        hasVerifiedBadge: u ? !!u.hasVerifiedBadge : !!prev.hasVerifiedBadge,
        headshot: team.heads.get(id) || prev.headshot || "",
      };
    });

    const groupIds = new Set(gameList.filter((g) => g.creator && g.creator.type === "Group").map((g) => g.creator.id));
    if (mainGroupId) groupIds.add(mainGroupId);
    const groups = await fetchGroups([...groupIds]);

    const data = { fetchedAt: new Date().toISOString(), games: gameList, team: teamList, groups, live: true };
    store.set(LS_DATA, data);
    return data;
  }

  /** Quick refresh of the live numbers only (players online, visits, favorites, votes). */
  async function refreshLive(data) {
    const universeIds = data.games.map((g) => g.universeId).filter(Boolean);
    if (!universeIds.length) return data;
    const [games, votes] = await Promise.all([fetchGames(universeIds), fetchVotes(universeIds)]);
    const next = Object.assign({}, data, {
      fetchedAt: new Date().toISOString(),
      live: true,
      games: data.games.map((g) => {
        const live = games.get(g.universeId);
        const v = votes.get(g.universeId);
        if (!live) return g;
        return Object.assign({}, g, {
          name: live.name || g.name,
          playing: live.playing || 0,
          visits: live.visits || g.visits,
          favorites: live.favoritedCount || g.favorites,
          updated: live.updated || g.updated,
          upVotes: v ? v.upVotes : g.upVotes,
          downVotes: v ? v.downVotes : g.downVotes,
        });
      }),
    });
    store.set(LS_DATA, next);
    return next;
  }

  /** Best data we can show instantly, before any network call. */
  function initialData() {
    const cached = store.get(LS_DATA);
    const snap = window.DUOCORE_SNAPSHOT || null;
    const placeIds = (cfg.games || []).map(parsePlaceId).filter(Boolean);
    // keep only games that are still in the config, in config order
    const pick = (d) => placeIds.map((id) => ((d && d.games) || []).find((g) => g.placeId === id)).filter(Boolean);
    const cachedGames = pick(cached);
    if (cached && cachedGames.length === placeIds.length) return Object.assign({}, cached, { games: cachedGames, live: false, cached: true });
    if (snap) return Object.assign({}, snap, { games: pick(snap), live: false });
    return { fetchedAt: null, games: [], team: [], groups: {}, live: false };
  }

  window.DuoCoreRoblox = { loadAll, refreshLive, initialData, parsePlaceId, parseUserId, parseGroupId };
})();
