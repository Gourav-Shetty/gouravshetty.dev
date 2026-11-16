import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projects = JSON.parse(readFileSync(new URL('../public/data/projects.json', import.meta.url)));

describe('projects.json', () => {
  it('has 8 projects with unique uids', () => {
    assert.equal(projects.length, 8);
    const uids = projects.map((p) => p.uid);
    assert.equal(new Set(uids).size, 8);
    for (const u of uids) assert.match(u, /^[a-z0-9-]+$/);
  });

  it('each project has required display fields', () => {
    for (const p of projects) {
      assert.ok(p.title, `${p.uid} missing title`);
      assert.ok(p.description, `${p.uid} missing description`);
      assert.ok(Array.isArray(p.stack) && p.stack.length > 0, `${p.uid} missing stack`);
      assert.ok(p.link, `${p.uid} missing link`);
      assert.ok(p.color, `${p.uid} missing color`);
    }
  });
});
