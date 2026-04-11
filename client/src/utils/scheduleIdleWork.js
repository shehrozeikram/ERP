/**
 * Defer work until the browser is idle so critical requests (e.g. main data grid) win
 * network and reduce perceived load time. Falls back to setTimeout where idle callbacks are unavailable.
 */
export function scheduleIdleWork(fn, options = {}) {
  const { timeout = 2800, delayedFallbackMs = 1200 } = options;
  if (typeof window === 'undefined') {
    return () => {};
  }
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    fn();
  };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(id);
    };
  }
  const tid = window.setTimeout(run, delayedFallbackMs);
  return () => {
    cancelled = true;
    window.clearTimeout(tid);
  };
}
