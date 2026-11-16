import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS, createQuests, questText } from '../src/core/quests.js';

describe('quests', () => {
  it('has unique ids and renders progress', () => {
    const ids = QUESTS.map((q) => q.id);
    assert.equal(new Set(ids).size, QUESTS.length);
    const q = createQuests();
    assert.ok(questText(q).includes('0/8 circles'));
    q.done.add('circle');
    q.circles.add('ai-traffic');
    q.circles.add('bloom');
    const t = questText(q);
    assert.ok(t.includes('✓ Stand on a circle'));
    assert.ok(t.includes('2/8 circles'));
  });
});
