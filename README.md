# Vorta — scroll-driven truck story (three.js + GSAP)

A Blender animation (truck delivery through a low-poly city) rebuilt for the web: scrolling scrubs the story frame
(frames 1–669 at 24 fps; the UI plays 20→170 itself as the intro, then the scroll drives 170→655) — camera, truck, day→night lighting, buildings springing in, streets dropping in, lamps switching on.
Lighting is baked in Blender (Cycles lightmaps) and replayed by custom shaders.

## Run locally

```bash
npm ci          # Node 18+ (clean install + build tested with Node 22)
npm run dev     # http://127.0.0.1:3000
```

## Build / deploy

```bash
npm run build   # -> dist/  (static site, ~32 MB incl. assets)
npm run preview # serve dist/ locally to check
```

`dist/` is a plain static site. `vite.config.js` uses `base: './'` and the app fetches assets relative to the page,
so it works from a domain root **or a sub-path** (e.g. GitHub Pages `https://<user>.github.io/<repo>/`) with no changes.

- **Vercel / Netlify / Cloudflare Pages:** framework "Vite" (or "Other"), build command `npm run build`,
  output directory `dist`.
- **GitHub Pages:** build in a GitHub Action (`npm ci && npm run build`) and publish `dist/`
  (e.g. `actions/upload-pages-artifact` + `actions/deploy-pages`), or push `dist/` to a `gh-pages` branch.

No server code, no environment variables, no API keys.

## What's in here

| Path | What |
|---|---|
| `index.html`, `src/main.js` | app: loading, scroll → story frame (GSAP ScrollTrigger), camera, truck/traffic/crew loops, lights, post (bloom + Blender view transform LUT) |
| `src/zoneShader.js` | baked-zone shader: lightmap layers (sky / sun / lamps / trail / windows), build-in pops and street drop-ins, trail reveal, sky occlusion |
| `src/glassShader.js` | glass / window shader |
| `public/assets/manifest.json` | everything exported from Blender: timeline (camera, truck, sky per frame), zones, materials, lights, curves |
| `public/assets/lightmaps/` | 51 baked lightmaps (WebP) |
| `public/assets/zones/` | 15 baked geometry buffers (10 zones + 5 glass) |
| `public/assets/packed/` | 4 meshopt-compressed glTFs (ambient crew, truck, props, traffic) |
| `public/assets/view_lut.bin`, `buildmap.png` | Blender colour-management LUT, terrain build map |
| `docs/WEB_NOTES.md` | full engineering log of the Blender → web pipeline (how every system works and why) |

`three` and `gsap` are the only runtime dependencies. `gltfpack` (dev) is only used by the Blender export step,
not by the site build.

## Debug URL parameters

`?frame=600` pins a story frame instead of scrolling · `?tier=low|mid|high` forces the quality tier (default: picked
from the device) · `?ao=0` sky occlusion off · `?shadow=…` / `?nocast=…` shadow debugging · `?bloom=0` · `?clouds=0` ·
`?hide=<zone>` hides a baked zone · `?view=three|nocurve` alternative colour transforms · `?fallback=0` disables the
shading fallback. The small HUD (bottom left) shows the current frame — remove `#hud` in `index.html` / `main.js` for
production if not wanted.

## Regenerating the assets

The assets are produced from the Blender scene (`Scene_WEB.blend`) by `_web/scripts/web_export.py` in the original
project folder — not part of this package. Re-export there, then copy `web/public/assets/` over this repo's
`public/assets/`.

## Camera playground (for the team)

Open the panel with `?cam=1` or press **C**: Zoom, Shift X, Shift Y on top of Blender's camera track, "Copy link" for a shareable URL
(`?zoom=1.25&cx=0.05&cy=-0.02`), "Copy values" for JSON. The camera angle itself comes from Blender (`Cam_Iso`).
Other debug flags: `?debug` (fps HUD), `?frame=300` (pin a story frame, skips the intro), `?skipintro`, `?cao=0`, `?adaptive=0`. Details: `docs/WEB_NOTES.md`.
