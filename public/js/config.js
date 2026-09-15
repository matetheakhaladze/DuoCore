/* =====================================================================
   DuoCore website — CONFIG
   This is the only file you normally need to edit.

   - Add a game: paste its Roblox link into `games`. Name, thumbnail,
     group, players online, visits, favorites and likes are fetched
     automatically and refreshed every `refreshSeconds`.
   - Add a team member: paste their Roblox profile link + a role.
     Avatar and display name are fetched automatically.
   ===================================================================== */
window.DUOCORE_CONFIG = {
  studio: {
    name: "DuoCore",
    heroTitle: "We build games players come back to.",
    heroText:
      "DuoCore is an independent Roblox studio that designs, launches and scales simulator and tycoon experiences for millions of players.",
    discord: "https://discord.gg/Mq3B4D9yR",
    email: "", // e.g. "hello@duocore.gg" — leave empty to hide the email button
    robloxGroup: "https://www.roblox.com/groups/809589923", // main group — live member count is shown
    copyright: "© 2026 DuoCore. All Rights Reserved.",
  },

  about: {
    heading: "Built by players, for players.",
    paragraphs: [
      "DuoCore is a Roblox game development studio focused on fast, satisfying progression games, from incremental simulators to build-and-earn tycoons.",
      "We design, build, launch and operate every title in-house, then keep it growing with regular updates driven by what our players actually do.",
    ],
    pillars: [
      { icon: "gamepad", title: "Original games", text: "We ship our own IP, from +1 evolution games to build-and-rob tycoons, and keep every title updated." },
      { icon: "chart", title: "Data-driven updates", text: "Live player counts, retention and community feedback decide what we build next, not guesswork." },
      { icon: "users", title: "Community first", text: "Our Discord is where players get sneak peeks, codes and a direct line to the team." },
    ],
  },

  // Paste Roblox game links here (any order). Everything else is fetched automatically.
  games: [
    "https://www.roblox.com/games/117973914120837/1-Dumpling-SMASH-Walls",
    "https://www.roblox.com/games/91612721209638/Build-an-ASMR-Obby",
    "https://www.roblox.com/games/134686612080002/1-Phonk-Per-Step",
    "https://www.roblox.com/games/104809044319701/1-Phonk-Evolution",
    "https://www.roblox.com/games/136909593741656/1-Soccer-Player-Evolution",
    "https://www.roblox.com/games/73186227660997/Build-a-Bank-and-Rob",
    "https://www.roblox.com/games/101835879420322/Build-a-Go-Kart-Track",
  ],

  // Default ordering of the games grid: "playing" | "visits" | "newest" | "config"
  gamesSort: "playing",

  // Team — profile link + role. Avatar headshot, display name and @username are fetched automatically.
  team: [
    { profile: "https://www.roblox.com/users/1798787212/profile", role: "Founder" },
    { profile: "https://www.roblox.com/users/2783542309/profile", role: "CEO" },
    { profile: "https://www.roblox.com/users/3527246864/profile", role: "Senior Project Manager" },
    { profile: "https://www.roblox.com/users/746363517/profile", role: "Lead Producer" },
  ],

  // How often live numbers (players online, visits, favorites) refresh, in seconds.
  refreshSeconds: 60,

  // How the browser reaches the Roblox API.
  //   "auto"   → use this site's own proxy (server.js) when available, otherwise fall back to a public proxy
  //   "proxy"  → only use server.js (/api/rbx)
  //   "public" → only use the public proxy (works on static hosts like GitHub Pages / Netlify)
  api: {
    mode: "auto",
    proxyBase: "/api/rbx",
    publicBase: "https://{host}.roproxy.com",
  },
};
