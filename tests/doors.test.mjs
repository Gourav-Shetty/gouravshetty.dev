import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exitTarget } from '../src/core/doors.js';

const HOME_BOUNDS = { xMin: -2.9, xMax: 2.9, zMin: -12.5, zMax: 7 };
const RAIL = { railMin: 198.5, exitX: 226.1 };

describe('walk-through doors', () => {
  it('home deep end leads to the projects rail', () => {
    assert.equal(exitTarget('/', { x: 0, z: -12.4 }, HOME_BOUNDS, RAIL), '/projects');
    assert.equal(exitTarget('/', { x: 0, z: -12.6 }, HOME_BOUNDS, RAIL), '/projects');
  });

  it('home is quiet above the door line', () => {
    assert.equal(exitTarget('/', { x: 0, z: 5.5 }, HOME_BOUNDS, RAIL), null);
    assert.equal(exitTarget('/', { x: 0, z: -12.0 }, HOME_BOUNDS, RAIL), null);
  });

  it('both rail ends lead home', () => {
    assert.equal(exitTarget('/projects', { x: 198.0, z: 0 }, HOME_BOUNDS, RAIL), '/');
    assert.equal(exitTarget('/projects', { x: 226.0, z: 0 }, HOME_BOUNDS, RAIL), '/');
  });

  it('the rail itself is quiet', () => {
    assert.equal(exitTarget('/projects', { x: 204.4, z: 0 }, HOME_BOUNDS, RAIL), null);
    assert.equal(exitTarget('/projects', { x: 210, z: 0 }, HOME_BOUNDS, RAIL), null);
  });

  it('other routes never exit through a door', () => {
    assert.equal(exitTarget('/project/pose-meme', { x: 0, z: -99 }, HOME_BOUNDS, RAIL), null);
    assert.equal(exitTarget('/about', { x: 0, z: -99 }, HOME_BOUNDS, RAIL), null);
  });
});
