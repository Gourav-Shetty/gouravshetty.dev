import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INTRO, INTRO_TOUCH, introFor } from '../src/core/dialogue.js';

describe('intro dialogue', () => {
  it('teaches identity, movement, circles, menu and replay', () => {
    assert.ok(Array.isArray(INTRO) && INTRO.length >= 4);
    for (const p of INTRO) assert.ok(p.startsWith('* '), `page missing bullet: ${p}`);
    const all = INTRO.join(' ');
    for (const word of ['GOURAV', 'WASD', 'circle', 'MENU', ' H ']) {
      assert.ok(all.includes(word), `intro never mentions: ${word}`);
    }
  });

  it('has a touch version that talks about the stick, not WASD', () => {
    assert.ok(INTRO_TOUCH.length >= 4);
    for (const p of INTRO_TOUCH) assert.ok(p.startsWith('* '));
    assert.ok(INTRO_TOUCH.join(' ').includes('stick'));
    assert.ok(!INTRO_TOUCH.join(' ').includes('WASD'));
    assert.equal(introFor(false), INTRO);
    assert.equal(introFor(true), INTRO_TOUCH);
  });
});
