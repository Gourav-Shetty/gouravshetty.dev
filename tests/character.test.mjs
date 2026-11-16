import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Character, railStride } from '../src/world/Character.js';
import { Gallery } from '../src/world/Gallery.js';

/* These guard two real crashes from the build-out:
 *  - the guestwall circle has project:null → spotFor() must not throw
 *  - the walking direction table is a verbatim port of the reference's
 *    directionOffset(), so it is pinned here against drift. */

describe('direction table (reference directionOffset)', () => {
  const off = (keys) => Character.prototype.directionOffset.call({ isTouch: false }, keys);

  it('walks forward with W / up', () => {
    assert.equal(off({ keyw: true }), Math.PI);
    assert.equal(off({ arrowup: true }), Math.PI);
  });

  it('strafes with A / D', () => {
    assert.equal(off({ keyd: true }), Math.PI / 2);
    assert.equal(off({ keya: true }), -Math.PI / 2);
    assert.equal(off({ arrowright: true }), Math.PI / 2);
    assert.equal(off({ arrowleft: true }), -Math.PI / 2);
  });

  it('diagonals keep the reference angles', () => {
    assert.equal(off({ keyw: true, keyd: true }), Math.PI / 4 + Math.PI / 2);
    assert.equal(off({ keyw: true, keya: true }), -Math.PI / 4 - Math.PI / 2);
    assert.equal(off({ keys: true, keyd: true }), Math.PI / 4);
    assert.equal(off({ keys: true, keya: true }), -Math.PI / 4);
  });

  it('idle input means no offset', () => {
    assert.equal(off({}), 0);
  });
});

describe('rail stride (one axis on the /projects rail)', () => {
  it('walks deeper with W / up / right', () => {
    assert.equal(railStride({ keyw: true }), -1);
    assert.equal(railStride({ arrowup: true }), -1);
    assert.equal(railStride({ keyd: true }), -1);
    assert.equal(railStride({ arrowright: true }), -1);
  });

  it('walks back with S / down / left', () => {
    assert.equal(railStride({ keys: true }), 1);
    assert.equal(railStride({ arrowdown: true }), 1);
    assert.equal(railStride({ keya: true }), 1);
    assert.equal(railStride({ arrowleft: true }), 1);
  });

  it('stands still without input', () => {
    assert.equal(railStride({}), 0);
  });

  it('forward wins when both are held', () => {
    assert.equal(railStride({ keyw: true, keya: true }), -1);
  });
});

describe('standing circles', () => {
  it('spotFor skips circles that carry no project (the guestwall)', () => {
    const fake = {
      spots: [
        { project: null, hall: 'home', center: { x: -2.8, z: -11.8 } },
        { project: { uid: 'pose-meme' }, hall: 'long', center: { x: 204.4, z: 0 } },
      ],
    };
    const found = Gallery.prototype.spotFor.call(fake, 'pose-meme', 'long');
    assert.equal(found.x, 204.4, 'returns the circle center');
    assert.equal(Gallery.prototype.spotFor.call(fake, 'nope', 'long'), null);
    assert.equal(Gallery.prototype.spotFor.call(fake, 'pose-meme', 'home'), null);
  });

  it('longSpotX returns the circle world x, or null', () => {
    const fake = {
      spots: [{ project: { uid: 'pose-meme' }, hall: 'long', center: { x: 204.4 } }],
      spotFor: Gallery.prototype.spotFor,
    };
    assert.equal(Gallery.prototype.longSpotX.call(fake, 'pose-meme'), 204.4);
    assert.equal(Gallery.prototype.longSpotX.call(fake, 'missing'), null);
  });
});
