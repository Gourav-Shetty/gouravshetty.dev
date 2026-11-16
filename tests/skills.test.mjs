import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { skillsFrom } from '../src/core/skills.js';

describe('skills derived from projects', () => {
  const projects = [
    { stack: ['TypeScript', 'Python'] },
    { stack: ['Python', 'CSS'] },
    { stack: [] },
    { stack: ['TypeScript'] },
  ];

  it('counts stacks and sorts by frequency', () => {
    assert.deepEqual(skillsFrom(projects), [
      { name: 'Python', count: 2 },
      { name: 'TypeScript', count: 2 },
      { name: 'CSS', count: 1 },
    ]);
  });

  it('handles empty / missing data', () => {
    assert.deepEqual(skillsFrom([]), []);
    assert.deepEqual(skillsFrom(undefined), []);
    assert.deepEqual(skillsFrom([{}]), []);
  });

  it('trims whitespace', () => {
    assert.deepEqual(skillsFrom([{ stack: ['  JS  ', 'JS'] }]), [{ name: 'JS', count: 2 }]);
  });
});
