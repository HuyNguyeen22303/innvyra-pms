import { useEffect, useState } from 'react';

/**
 * Returns `true` once the browser has been idle for a while, so heavy modal
 * content can be mounted ahead of the first click without competing with the
 * user's typing or scrolling.
 *
 * - The mount work is deferred to `requestIdleCallback` (with a timeout so it
 *   still happens when the user keeps the main thread busy).
 * - The timer and the pending idle callback are both cancelled on unmount, so
 *   the state is never updated after the component is gone.
 * - The hook is idempotent: once preloaded it never schedules again.
 */
export const useIdlePreload = (delayMs = 900): boolean => {
  const [preloaded, setPreloaded] = useState(false);

  useEffect(() => {
    if (preloaded) return;

    let idleHandle: number | undefined;
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(() => setPreloaded(true), {
          timeout: 1000,
        });
      } else {
        setPreloaded(true);
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      if (idleHandle !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, [delayMs, preloaded]);

  return preloaded;
};
