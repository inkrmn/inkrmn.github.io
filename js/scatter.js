// Eases a GEO_SC player's scatter (how far its particles are thrown out into
// a cloud) to a new value. Starting a new ease on the same player stops the
// old one where it is, so a cloud can turn round mid-way without jumping.
// Resolves true when it gets there, false if it was taken over.

const running = new WeakMap();

// Slow at the start and end, like particles drifting together.
export const smooth = (t) => t * t * (3 - 2 * t);
// Fast at the start, slowing to a stop: a burst.
export const burst = (t) => 1 - (1 - t) ** 3;

export function easeScatter(player, to, seconds, { ease = smooth, onStep } = {}) {
  if (!player) return Promise.resolve(false);
  running.get(player)?.();
  const from = +player.settings.scatter || 0;
  return new Promise((resolve) => {
    let raf = 0;
    let start = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      running.delete(player);
      resolve(false);
    };
    running.set(player, stop);
    const step = (now) => {
      start ||= now;
      const t = seconds > 0 ? Math.min(1, (now - start) / (seconds * 1000)) : 1;
      const k = ease(t);
      player.settings.scatter = from + (to - from) * k;
      onStep?.(k);
      if (t < 1) {
        raf = requestAnimationFrame(step);
        return;
      }
      running.delete(player);
      resolve(true);
    };
    raf = requestAnimationFrame(step);
  });
}
