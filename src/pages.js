export function homeHTML() {
  return `
  <div class="hud" id="hud">
    <div class="hud_group"><span class="hud_label">Move</span>
      <span class="key">←</span><span class="key">↓</span><span class="key">→</span>
      <span class="key up">↑</span>
    </div>
    <div class="hud_group"><span class="hud_label">Open/Close Menu</span><span class="key">ESC</span></div>
    <div class="hud_group"><span class="hud_label">See details</span><span class="key">↵</span></div>
    <div class="hud_group"><span class="hud_label">Guestwall</span><span class="key">G</span></div>
    <div class="hud_group"><span class="hud_label">Zoom</span><span class="key">↕</span></div>
    <div class="hud_group"><span class="hud_label">Night</span><span class="key">N</span></div>
  </div>
  <div class="container"></div>`;
}

// The /projects route — the long exhibition hall is pure 3D walk space;
// nothing overlays it except quests + controls.
export function galleryWalkHTML() {
  return `<div class="container" style="pointer-events:none"></div>`;
}

export function projectHTML(p, prev, next) {
  return `
  <div class="article_container">
    <div class="article_arrows">
      <span class="arrowL"><a href="/project/${prev.uid}" data-route="/project/${prev.uid}" aria-label="Previous project ${prev.title}"></a></span>
      <span class="arrowR"><a href="/project/${next.uid}" data-route="/project/${next.uid}" aria-label="Next project ${next.title}"></a></span>
    </div>
    <div class="article_left">
      <ul class="data_top">
        <li><span><span><strong>${p.title}</strong></span></span></li>
        <li><span><span>${p.tagline || ''}</span></span></li>
        <li><span><span>${(p.stack || []).join(' · ')}</span></span></li>
        <li><span><span>${p.year || ''} — ${p.role || ''}</span></span></li>
      </ul>
      <ul class="data_bottom">
        <li><span><span>${p.description || ''}</span></span></li>
        <li><span><span><a href="${p.link}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">${p.linkLabel || 'Open link'}</a></span></span></li>
      </ul>
    </div>
    <div class="article_mid"></div>
    <div class="article_right">
      <button class="contact_button" id="projectContact">Contact me<div class="personnageTarget"></div></button>
    </div>
  </div>`;
}

export function aboutHTML() {
  return `
  <div class="article_container">
    <div class="article_left">
      <ul class="data_top">
        <li><span><span><strong>About</strong></span></span></li>
        <li><span><span>Creative developer</span></span></li>
        <li><span><span>Realtime 3D + frontend</span></span></li>
      </ul>
      <ul class="data_bottom">
        <li><span><span>Walk the gallery, click frames.</span></span></li>
        <li><span><span>Edit public/data/projects.json</span></span></li>
        <li><span><span>to make it yours.</span></span></li>
      </ul>
    </div>
    <div class="article_mid"></div>
    <div class="article_right">
      <button class="contact_button" id="projectContact">Contact me<div class="personnageTarget"></div></button>
    </div>
  </div>`;
}

export function notFoundHTML() {
  // theirs loads a 404.png drawing; ours is an ink sketch of the same idea
  const scribble = `
    <svg class="notfound_art" viewBox="0 0 420 220" role="img" aria-label="404 — page not found">
      <g fill="none" stroke="#111" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40 175 C 34 96, 48 44, 84 40 C 112 37, 104 92, 76 138 C 62 162, 52 172, 46 174"/>
        <path d="M148 44 C 186 38, 196 60, 178 92 C 162 120, 140 150, 140 176"/>
        <path d="M132 112 C 160 106, 180 108, 196 110"/>
        <path d="M232 176 C 226 110, 238 52, 272 44 C 302 37, 300 84, 276 122 C 258 152, 244 168, 236 176"/>
        <path d="M330 176 C 324 108, 336 50, 370 42 C 398 35, 398 84, 372 124 C 352 154, 340 168, 332 176"/>
        <path d="M322 112 C 352 106, 372 108, 388 112"/>
      </g>
    </svg>`;
  return `
  <div class="article_container">
    <div class="article_left">
      <ul class="data_top"><li><span><span><strong>404</strong></span></span></li></ul>
      <ul class="data_bottom"><li><span><span>This wall is blank. <a href="/" data-route="/" style="color:inherit;text-decoration:underline">Back home</a></span></span></li></ul>
    </div>
    <div class="article_mid">${scribble}</div><div class="article_right"></div>
  </div>`;
}
