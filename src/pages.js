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

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function aboutHTML(about = {}, skills = []) {
  const hobbies = (about.hobbies || []).map((h) => `
    <div class="story_hobby">
      <span class="story_glyph" aria-hidden="true">${esc(h.glyph)}</span>
      <div><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>
    </div>`).join('');
  const chips = skills.map((s) =>
    `<span class="skill_chip">${esc(s.name)}<span class="skill_n">${s.count}</span></span>`).join('');
  return `
  <div class="story" id="story">
    <div class="story_scroll">
      <p class="story_kicker">About / ${esc(about.name)}</p>
      <h1 class="story_hero">${esc(about.oneLiner)}</h1>
      <section class="story_block">
        <h2>Who I am</h2>
        <p>${esc(about.intro)}</p>
      </section>
      <section class="story_block">
        <h2>How I work</h2>
        <p>${esc(about.howIWork)}</p>
      </section>
      <section class="story_block">
        <h2>Off the keyboard</h2>
        <div class="story_hobbies">${hobbies}</div>
      </section>
      <section class="story_block">
        <h2>What I work with</h2>
        <p class="story_note">Counted from the projects hanging in the gallery.</p>
        <div class="story_skills">${chips}</div>
      </section>
      <footer class="story_footer">
        <a href="/now" data-route="/now" class="story_link">What I'm doing now →</a>
        <a href="https://github.com/Gourav-Shetty" target="_blank" rel="noopener" class="story_link">GitHub ↗</a>
        <button type="button" class="story_contact" id="projectContact">Contact me</button>
      </footer>
    </div>
  </div>`;
}

export function nowHTML(now = {}) {
  const rows = [
    ['Learning', now.learning],
    ['Building', now.building],
    ['Off-screen', now.offScreen],
    ['Open to', now.openTo],
  ].filter(([, text]) => text).map(([label, text]) => `
    <div class="now_row"><h3>${esc(label)}</h3><p>${esc(text)}</p></div>`).join('');
  return `
  <div class="story" id="story">
    <div class="story_scroll">
      <p class="story_kicker">Now / updated ${esc(now.updated)}</p>
      <h1 class="story_hero">A snapshot, not a résumé.</h1>
      <section class="story_block">
        <h2>Right now</h2>
        <div class="now_rows">${rows}</div>
      </section>
      <section class="story_block">
        <h2>Where this goes next</h2>
        <p class="story_note">This page changes when I learn something new — the projects stay where they are, hanging on the walls.</p>
      </section>
      <footer class="story_footer">
        <a href="/about" data-route="/about" class="story_link">More about me →</a>
        <button type="button" class="story_contact" id="projectContact">Contact me</button>
      </footer>
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
