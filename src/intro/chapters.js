/* Spotlight-chapters intro — pure data + state machine.
 *
 * No DOM, no audio, no storage, no clock. The only time input is `tick(ms)`
 * from the render loop, so the whole sequence is deterministic and testable.
 * Timing is clamped to one chapter per tick: a backgrounded tab that resumes
 * with a huge delta must never fast-forward through the story. */

// Short lead clause: content lines are long one-liners, captions need one beat.
// Splits on an em/en dash or sentence break, but not the hyphen in "real-time".
const lead = (s, fallback) => {
  const text = String(s || '').trim();
  if (!text) return fallback;
  const first = text.split(/\s+[—–-]\s+|\.\s+/)[0].trim();
  return first || fallback;
};

const projectTitle = (projects, i) => String(projects?.[i]?.title || '').trim();

export function buildChapters({
  projects = [],
  skills = [],
  about = {},
  now = {},
  isPhone = false,
} = {}) {
  const a = projectTitle(projects, 0) || 'a project';
  const b = projectTitle(projects, 1) || 'another';
  const c = projectTitle(projects, 2) || 'one more';

  const skillLine = (skills || [])
    .slice(0, 4)
    .map((s) => `${s.name} ${s.count}`)
    .join('  ·  ');

  const chapters = [
    {
      id: 'who',
      label: 'WHO',
      caption: "I'm Gourav.",
      sub: lead(about.oneLiner, 'I build playful, real-time web things.'),
      target: 'avatar',
      hole: { x: 50, y: 50, r: 135 },
      phoneHole: { x: 50, y: 52, r: 88 },
      hold: 2600,
    },
    {
      id: 'what',
      label: 'WHAT',
      caption: `${b}. ${a}. ${c}.`,
      sub: 'Eight projects hang on these walls.',
      target: 'frame-left',
      hole: { x: 20, y: 32, r: 150 },
      phoneHole: { x: 22, y: 36, r: 92 },
      hold: 3000,
    },
    {
      id: 'how',
      label: 'HOW',
      caption: skillLine || 'JavaScript · Python · CSS',
      sub: lead(about.howIWork, 'I start with the fun part, then figure out the plumbing.'),
      target: 'center',
      hole: { x: 50, y: 44, r: 200 },
      phoneHole: { x: 50, y: 46, r: 108 },
      hold: 2800,
    },
    {
      id: 'now',
      label: 'NOW',
      caption: `Learning ${lead(now.learning, 'MLOps, GPUs, cloud')}.`,
      sub: lead(now.offScreen, 'Gaming, badminton, sketches.'),
      // The end-wall spotlight is out of range on a 2-spot phone rig, so the
      // phone stop is caption-only: null phoneHole = do not move the hole.
      target: 'endwall',
      hole: { x: 50, y: 36, r: 185 },
      phoneHole: null,
      hold: 3000,
    },
  ];

  return chapters;
}

export function createIntro(chapters, opts = {}) {
  const {
    reduced = false,
    onChapter = () => {},
    onFinish = () => {},
  } = opts;

  const list = Array.isArray(chapters) ? chapters : [];
  let state = 'idle'; // idle | playing | done
  let index = -1;
  let elapsed = 0;
  let ended = false;

  const goto = (i) => {
    index = i;
    elapsed = 0;
    onChapter(list[i], i);
  };

  const end = (skipped) => {
    if (ended) return false;
    ended = true;
    state = 'done';
    onFinish({ skipped });
    return true;
  };

  return {
    get active() { return state === 'playing'; },
    get index() { return index; },
    get chapters() { return list; },
    get reduced() { return !!reduced; },

    start() {
      if (state !== 'idle') return false;
      // Reduced motion (or no content) = instant full light, no captions.
      if (reduced || !list.length) { end(true); return true; }
      state = 'playing';
      elapsed = 0;
      goto(0);
      return true;
    },

    tick(ms) {
      if (state !== 'playing') return;
      const amount = Number.isFinite(ms) ? Math.max(0, Math.min(ms, 50)) : 0;
      elapsed += amount;
      const chapter = list[index];
      if (!chapter || elapsed < chapter.hold) return;
      if (index + 1 < list.length) goto(index + 1);
      else end(false);
    },

    finish() { return end(false); },
    skip() { return end(true); },
    // H replay: re-arm a finished tour so a second page-load-style run works.
    reset() {
      state = 'idle';
      index = -1;
      elapsed = 0;
      ended = false;
    },
  };
}
