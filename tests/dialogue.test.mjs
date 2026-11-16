import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INTRO } from '../src/core/dialogue.js';

describe('intro dialogue', () => {
  it('teaches identity, movement, circles, menu and replay', () => {
    assert.ok(Array.isArray(INTRO) && INTRO.length >= 4);
    for (const p of INTRO) assert.ok(p.startsWith('* '), `page missing bullet: ${p}`);
    const all = INTRO.join(' ');
    for (const word of ['GOURAV', 'WASD', 'circle', 'MENU', ' H ']) {
      assert.ok(all.includes(word), `intro never mentions: ${word}`);
    }
  });
});
