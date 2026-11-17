import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChapters, createIntro } from '../src/intro/chapters.js';

const projects = [
  { title: 'AI Traffic' },
  { title: 'Pose Meme' },
  { title: 'Realme Buds' },
];
const skills = [
  { name: 'TypeScript', count: 5 },
  { name: 'Python', count: 4 },
  { name: 'CSS', count: 3 },
];
const content = {
  about: {
    oneLiner: 'I build playful, real-time web things.',
    howIWork: 'I start with the fun part — then figure out the plumbing.',
  },
  now: {
    learning: 'AI/ML, MLOps, GPUs, and cloud.',
    offScreen: 'PC gaming, badminton, and filling up sketchbooks.',
  },
};

describe('buildChapters', () => {
  it('produces four chapters in WHO / WHAT / HOW / NOW order', () => {
    const chapters = buildChapters({ projects, skills, ...content });
    assert.equal(chapters.length, 4);
    assert.deepEqual(chapters.map((c) => c.id), ['who', 'what', 'how', 'now']);
    assert.deepEqual(chapters.map((c) => c.label), ['WHO', 'WHAT', 'HOW', 'NOW']);
  });

  it('derives the copy from the real content, not hardcoded strings', () => {
    const chapters = buildChapters({ projects, skills, ...content });
    assert.match(chapters[0].caption, /Gourav/);
    assert.match(chapters[1].caption, /Pose Meme/);
    assert.match(chapters[1].caption, /AI Traffic/);
    assert.match(chapters[2].caption, /TypeScript/);
    assert.match(chapters[2].caption, /Python/);
    assert.match(chapters[3].caption, /MLOps|GPUs|cloud/);
    assert.match(chapters[3].sub, /badminton|sketchbooks/);
  });

  it('never mutates its inputs and is deterministic', () => {
    const a = buildChapters({ projects, skills, ...content });
    const b = buildChapters({ projects, skills, ...content });
    assert.deepEqual(a, b);
    assert.equal(projects.length, 3);
    assert.equal(skills.length, 3);
  });

  it('keeps the end-wall stop caption-only on a phone', () => {
    const chapters = buildChapters({ projects, skills, ...content, isPhone: true });
    const now = chapters[3];
    assert.equal(now.target, 'endwall');
    assert.equal(now.phoneHole, null);
    assert.ok(now.caption && now.sub);
    const desktop = buildChapters({ projects, skills, ...content })[3];
    assert.ok(desktop.hole);
    assert.equal(desktop.target, 'endwall');
  });

  it('survives empty or missing content', () => {
    const chapters = buildChapters({});
    assert.equal(chapters.length, 4);
    for (const c of chapters) {
      assert.ok(c.caption.length > 0);
      assert.ok(c.hole && typeof c.hole.x === 'number');
      assert.ok(c.hold > 0);
    }
  });
});

describe('createIntro', () => {
  const chapters = buildChapters({ projects, skills, ...content }).map((c) => ({ ...c, hold: 10 }));

  it('walks the chapters in order and finishes once', () => {
    const seen = [];
    let finished = null;
    const intro = createIntro(chapters, {
      onChapter: (c) => seen.push(c.id),
      onFinish: (e) => { finished = e; },
    });
    assert.equal(intro.active, false);
    assert.equal(intro.start(), true);
    assert.equal(intro.active, true);
    assert.equal(intro.index, 0);
    assert.deepEqual(seen, ['who']);
    intro.tick(10);
    assert.deepEqual(seen, ['who', 'what']);
    intro.tick(10);
    intro.tick(10);
    assert.deepEqual(seen, ['who', 'what', 'how', 'now']);
    assert.equal(intro.active, true);
    intro.tick(10);
    assert.equal(intro.active, false);
    assert.deepEqual(finished, { skipped: false });
    intro.tick(1000);
    assert.equal(seen.length, 4, 'no chapters fire after finish');
  });

  it('skip ends immediately and is idempotent', () => {
    let count = 0;
    let arg = null;
    const intro = createIntro(chapters, {
      onChapter: () => {},
      onFinish: (e) => { count++; arg = e; },
    });
    intro.start();
    assert.equal(intro.skip(), true);
    assert.equal(intro.active, false);
    assert.deepEqual(arg, { skipped: true });
    assert.equal(intro.skip(), false);
    assert.equal(intro.finish(), false);
    assert.equal(count, 1);
  });

  it('reduced motion bypasses every chapter and goes straight to full light', () => {
    const seen = [];
    let finished = null;
    const intro = createIntro(chapters, {
      reduced: true,
      onChapter: (c) => seen.push(c.id),
      onFinish: (e) => { finished = e; },
    });
    assert.equal(intro.start(), true);
    assert.equal(intro.active, false);
    assert.deepEqual(seen, []);
    assert.ok(finished);
    intro.tick(1000);
    assert.deepEqual(seen, []);
  });

  it('cannot be started twice and exposes a read-only chapter list', () => {
    const intro = createIntro(chapters, {});
    assert.equal(intro.start(), true);
    assert.equal(intro.start(), false);
    assert.equal(intro.chapters, chapters);
  });

  it('can be reset after finishing so H replays the whole tour', () => {
    const seen = [];
    const intro = createIntro(chapters, { onChapter: (c) => seen.push(c.id) });
    intro.start();
    intro.skip();
    assert.equal(intro.start(), false, 'finished tour cannot restart without reset');
    intro.reset();
    assert.equal(intro.active, false);
    intro.start();
    assert.equal(intro.active, true);
    assert.equal(intro.index, 0);
    assert.deepEqual(seen, ['who', 'who']);
  });

  it('caps a single large tick at one transition (hidden-tab safety)', () => {
    const seen = [];
    const intro = createIntro(chapters, { onChapter: (c) => seen.push(c.id) });
    intro.start();
    intro.tick(100000);
    assert.equal(intro.active, true, 'a stalled tab must not auto-complete the whole tour');
    assert.equal(intro.index, 1);
  });
});
