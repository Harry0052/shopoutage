export interface Observation<T> {
  stable: boolean;
  elapsedMs: number;
  polls: number;
  snapshot: T;
}

/**
 * Poll until `snapshot` stays unchanged for `stabilityWindowMs` of virtual time,
 * or until `deadlineMs`. A non-zero window cannot pass on the first sample.
 */
export function observeUntilStable<T>(options: {
  poll: () => T;
  same: (left: T, right: T) => boolean;
  advance: (milliseconds: number) => void;
  deadlineMs: number;
  stabilityWindowMs: number;
  stepMs: number;
}): Observation<T> {
  if (options.stabilityWindowMs === 0) {
    return { stable: true, elapsedMs: 0, polls: 1, snapshot: options.poll() };
  }
  let polls = 1;
  let last = options.poll();
  let elapsed = 0;
  let stableFor = 0;
  const step = Math.max(1, options.stepMs);
  while (elapsed < options.deadlineMs) {
    const nextStep = Math.min(step, options.deadlineMs - elapsed);
    options.advance(nextStep);
    elapsed += nextStep;
    polls += 1;
    const next = options.poll();
    if (options.same(last, next)) {
      stableFor += nextStep;
      last = next;
      if (stableFor >= options.stabilityWindowMs) {
        return { stable: true, elapsedMs: elapsed, polls, snapshot: next };
      }
    } else {
      stableFor = 0;
      last = next;
    }
  }
  return { stable: false, elapsedMs: elapsed, polls, snapshot: last };
}
