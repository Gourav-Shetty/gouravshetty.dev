/* One definition of "phone" for the whole app. The reference decides once at
 * boot from `matchMedia('(max-width: 820px)')`; we add ?touch=1 so desktop can
 * exercise the same path. Keeping a single flag avoids the old split where
 * the joystick was visible but Character thought it was a desktop. */
// SSR-safe: Node tests import these modules without a window
export const isPhone = (typeof matchMedia === 'function' && matchMedia('(max-width: 820px)').matches)
  || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('touch'));
