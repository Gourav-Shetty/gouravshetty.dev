# Portfolio Gallery (thevertmenthe-style, for projects)

Walkable 3D portfolio. Reverse-engineered from `thevertmenthe.dault-lafon.fr` IA, rebuilt with your projects instead of artworks.

## Run

```sh
npm install
npm run dev      # open the Vite URL
npm test         # validates projects.json
npm run build    # production build in dist/
```

## Make it yours

1. Edit `public/data/projects.json` — 8 entries max map to the 8 frames (title, tagline, stack, year, role, description, link, color, pattern).
2. Edit `public/data/about.json` (bio, hobbies) and `public/data/now.json` (what you're learning/building) — these drive `/about` and `/now`. The skills block is counted from the projects automatically.
3. Edit contact email in `src/core/Menu.js` + `src/main.js` (`hello@example.com`).
3. Edit GitHub URL in `index.html` (`#githubLink`).
4. Covers are procedural (`src/world/coverTexture.js` patterns: waves/grid/dots/rings/diagonal/bars/triangles/cross). Swap `makeCoverTexture` for real image textures when ready.

## Structure

```
index.html            → loader, menu, canvas shell
src/main.js           → boot: loader → data → scene → router
src/pages.js          → home / projects / project / about / now / 404 templates
src/core/Experience.js→ three r158 singleton + loop
src/core/Router.js    → /, /projects, /project/:uid, /about, /now SPA
src/core/skills.js    → skills counted from projects[].stack
src/core/Menu.js      → fullscreen menu + search
src/core/Loader.js    → % loader
src/world/Gallery.js  → room + 8 shader frames + lights
src/world/Character.js→ capsule avatar, WASD/arrows/joystick, footprints, follow-cam
src/world/coverTexture.js → canvas covers
public/data/projects.json → your projects
public/data/about.json    → bio + hobbies
public/data/now.json      → living "now" snapshot
docs/ideas/personal-layer.md → why these pages and what's deliberately out
tests/projects.test.mjs  → content contract tests
```

## Controls

Desktop: `WASD` / arrows to walk, click a frame to open. Mobile: on-screen joystick. `menu` button or `Esc` for menu.
