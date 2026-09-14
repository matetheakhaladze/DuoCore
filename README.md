# DuoCore — studio website

One-page site for the DuoCore Roblox studio: Home · About (with team) · Games · Contact.
Every number on the page (players online, visits, favorites, likes, group members),
every game thumbnail and every team avatar is pulled live from Roblox — you only
maintain a list of links.

```
duocore-site/
├── server.js            ← tiny Node server: serves the site + proxies the Roblox API (with caching)
├── package.json
└── public/              ← the website itself (static files)
    ├── index.html
    ├── css/style.css
    ├── js/config.js     ← ★ the only file you edit: game links, team, texts
    ├── js/roblox.js     ← fetches live data from Roblox
    ├── js/app.js        ← rendering + animations
    ├── js/vendor/       ← Lenis (smooth scrolling, MIT)
    ├── data/snapshot.js ← fallback numbers shown before the first live fetch
    └── assets/          ← logo + favicon
```

## Run it locally

Requires Node 18 or newer (no `npm install` needed — zero dependencies).

```bash
node server.js
# → http://localhost:3000
```

## Add or remove a game

Open `public/js/config.js` and paste the Roblox link into the `games` list:

```js
games: [
  "https://www.roblox.com/games/117973914120837/1-Dumpling-SMASH-Walls",
  "https://www.roblox.com/games/104809044319701/1-Phonk-Evolution",
  // add more here ↓
],
```

That's it. Name, thumbnail, icon, group name, players online, visits, favorites,
likes, genre and max players are fetched automatically and refreshed every
`refreshSeconds` (default 60 s) while the page is open.

## Team members

Same idea — a profile link plus the role you want displayed:

```js
team: [
  { profile: "https://www.roblox.com/users/1798787212/profile", role: "Founder" },
],
```

Display name, @username, verified badge and avatar headshot come from Roblox.

## Texts, links, email

Everything else lives in the `studio` and `about` blocks of `config.js`:
hero title/text, About paragraphs, the three "pillar" cards, Discord invite,
contact email (leave empty to hide the button), main Roblox group and the
copyright line.

## Hosting

**Option A — Node host (recommended): Render, Railway, Fly.io, a VPS, etc.**
Deploy the folder and run `node server.js` (start command: `npm start`).
`render.yaml` is included, so on Render you can use New → Blueprint and it configures itself.
The server proxies and caches Roblox API calls, so visitors never hit Roblox
rate limits and pages load fast.

**Option B — static host: GitHub Pages, Netlify, Vercel, Cloudflare Pages.**
Upload only the `public/` folder (`netlify.toml` is included for Netlify). There is no server, so the page automatically
falls back to a public Roblox proxy (`roproxy.com`). Everything still updates
live; the only difference is that the "likes %" on cards becomes "favorites"
(that endpoint isn't available through the public proxy). If you'd rather force
this mode, set `api.mode` to `"public"` in `config.js`.

## How the live data works

Browsers can't call `*.roblox.com` APIs directly (CORS), so `js/roblox.js`
talks to `/api/rbx/<host>/<path>`, which `server.js` forwards to
`https://<host>.roblox.com/<path>` and caches (45 s for player counts, longer
for thumbnails and profiles). On a static host the same calls go to
`https://<host>.roproxy.com` instead.

Endpoints used: `apis/universes` (game link → universe id), `games/v1/games`
(stats), `games/v1/games/votes` (likes), `thumbnails/v1/games/*`,
`thumbnails/v1/users/avatar-headshot`, `users/v1/users`, `groups/v1/groups`.

Resolved universe ids and the last live dataset are cached in the visitor's
`localStorage`, so repeat visits paint instantly and then refresh.

## Custom domain (e.g. duocore.org)

1. Deploy first (Option A or B) and confirm the temporary URL works.
2. In the host's dashboard add the custom domain — it shows you the DNS records it wants
   (typically an **A** record for `@` and a **CNAME** for `www`).
3. At your registrar open the domain's DNS settings, delete any "parked" A record on `@`,
   and add the records from step 2.
4. Wait for DNS to propagate (minutes to a few hours). The host issues the HTTPS certificate
   automatically once it sees the records.
