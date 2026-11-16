import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import gsap from 'gsap';

/* Guards the bug where Router.swap sets document.body.dataset.route, so the
 * router's click handler matched `closest('[data-route]')` on the BODY of
 * every click in the app and preventDefault()ed it — which silently killed
 * every form submit (the guestwall note form). */

function installDom() {
  const dom = new JSDOM(
    '<!doctype html><html><body><main id="main"></main><button id="pin">Pin</button></body></html>',
    { url: 'http://localhost/', pretendToBeVisual: true }
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.history = dom.window.history;
  globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  return dom;
}

let Router;
let dom;

before(async () => {
  dom = installDom();
  ({ Router } = await import('../src/core/Router.js'));
});

after(() => {
  // gsap's ticker would keep the event loop alive after the DOM is gone
  gsap.ticker.sleep();
  gsap.globalTimeline.clear();
  dom.window.close();
});

function makeRouter() {
  const rendered = [];
  const router = new Router([{ uid: 'pose-meme' }], {
    transition: null,
    menu: null,
    setMode: (m) => rendered.push(m),
  });
  return { router, rendered };
}

describe('router clicks', () => {
  it('does not swallow clicks on plain elements', () => {
    const { router } = makeRouter();
    router.swap('/projects'); // sets body.dataset.route
    const btn = dom.window.document.getElementById('pin');
    const ev = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    btn.dispatchEvent(ev);
    assert.equal(ev.defaultPrevented, false, 'a button click must not be preventDefault-ed');
  });

  it('routes anchors that carry data-route', async () => {
    const { router, rendered } = makeRouter();
    router.swap('/');
    const a = dom.window.document.createElement('a');
    a.href = '/projects';
    a.setAttribute('data-route', '/projects');
    dom.window.document.getElementById('main').appendChild(a);
    const ev = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(ev);
    assert.equal(ev.defaultPrevented, true, 'route links are handled');
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(dom.window.location.pathname, '/projects');
    assert.ok(rendered.includes('walk'));
  });

  it('ignores clicks on elements that are not route links', () => {
    const { router } = makeRouter();
    router.swap('/');
    const div = dom.window.document.createElement('div');
    dom.window.document.getElementById('main').appendChild(div);
    const ev = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    div.dispatchEvent(ev);
    assert.equal(ev.defaultPrevented, false);
  });
});
