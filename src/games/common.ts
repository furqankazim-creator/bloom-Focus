import { useEffect, useRef, useState } from 'react';
import { halves } from '../engine/adaptive';
import type { BlockMetrics, Params } from '../types';

export type GameResult = Omit<BlockMetrics, 'completed'>;

export type GameProps = {
  params: Params;
  paused: boolean;
  /** Called on every correct response; the runner turns these into rewards. */
  onCorrect: () => void;
  onDone: (m: GameResult) => void;
};

/** Fixed-step clock that stops while paused, so paused time never counts against the child. */
export function useTicker(paused: boolean, onTick: (dtMs: number) => void, stepMs = 100) {
  const cb = useRef(onTick);
  cb.current = onTick;
  useEffect(() => {
    if (paused) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      cb.current(Math.min(now - last, 500));
      last = now;
    }, stepMs);
    return () => clearInterval(id);
  }, [paused, stepMs]);
}

/** Accumulates trial outcomes into the metrics the adaptive engine reads. */
export class Tally {
  hits = 0;
  misses = 0;
  falseTaps = 0;
  correctRejections = 0;
  outcomes: boolean[] = [];
  rts: number[] = [];
  tapTimes: number[] = [];
  frustrationDetected = false;

  private recordTap() {
    const now = Date.now();
    this.tapTimes.push(now);
    // Keep only taps from the last 2 seconds
    this.tapTimes = this.tapTimes.filter((t) => now - t < 2000);
    // If more than 4 taps in 2 seconds, flag frustration
    if (this.tapTimes.length >= 5) {
      this.frustrationDetected = true;
    }
  }

  hit(rtMs?: number) {
    this.recordTap();
    this.hits++;
    this.outcomes.push(true);
    if (rtMs !== undefined) this.rts.push(rtMs);
  }
  miss() {
    this.misses++;
    this.outcomes.push(false);
  }
  falseTap() {
    this.recordTap();
    this.falseTaps++;
    this.outcomes.push(false);
  }
  reject() {
    this.correctRejections++;
    this.outcomes.push(true);
  }
  result(activeMs: number): GameResult {
    return {
      trials: this.outcomes.length,
      hits: this.hits,
      misses: this.misses,
      falseTaps: this.falseTaps,
      correctRejections: this.correctRejections,
      meanRtMs: this.rts.length ? Math.round(this.rts.reduce((a, b) => a + b, 0) / this.rts.length) : null,
      ...halves(this.outcomes),
      activeSec: Math.round(activeMs / 1000),
      frustrationDetected: this.frustrationDetected,
    };
  }
}

export const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Stim<K> = { kind: K; isTarget: boolean; at: number; responded: boolean };

export type Feedback = 'good' | 'oops' | null;

/**
 * Continuous-performance stream: a stimulus every `intervalMs`, visible for part of it.
 * Tapping a target is a hit, missing it is an omission, tapping a non-target (or tapping
 * between stimuli) is a commission, and letting a non-target pass is a correct rejection.
 */
export function useStimulusStream<K>({
  durationMs,
  intervalMs,
  visibleFrac,
  leadInMs = 1200,
  paused,
  next,
  onShow,
  onCorrect,
  onDone,
}: {
  durationMs: number;
  intervalMs: number;
  visibleFrac: number;
  leadInMs?: number;
  paused: boolean;
  next: () => { kind: K; isTarget: boolean };
  onShow?: (kind: K) => void;
  onCorrect: () => void;
  onDone: (m: GameResult) => void;
}) {
  const r = useRef({
    elapsed: 0,
    nextAt: leadInMs,
    stim: null as Stim<K> | null,
    tally: new Tally(),
    gapTapped: false,
    done: false,
  });
  const [, force] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleMs = intervalMs * visibleFrac;

  useEffect(() => () => {
    if (fbTimer.current) clearTimeout(fbTimer.current);
  }, []);

  const flash = (f: Feedback) => {
    setFeedback(f);
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback(null), 450);
  };

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    st.elapsed += dt;
    if (st.stim && st.elapsed - st.stim.at >= visibleMs) {
      if (!st.stim.responded) st.stim.isTarget ? st.tally.miss() : st.tally.reject();
      st.stim = null;
      st.nextAt = st.elapsed + (intervalMs - visibleMs);
      st.gapTapped = false;
    }
    if (!st.stim && st.elapsed >= durationMs) {
      st.done = true;
      onDone(st.tally.result(st.elapsed));
      return;
    }
    if (!st.stim && st.elapsed >= st.nextAt) {
      const n = next();
      st.stim = { ...n, at: st.elapsed, responded: false };
      onShow?.(n.kind);
    }
    force((x) => x + 1);
  });

  const tap = () => {
    const st = r.current;
    if (st.done || paused) return;
    if (st.stim && !st.stim.responded) {
      st.stim.responded = true;
      if (st.stim.isTarget) {
        st.tally.hit(st.elapsed - st.stim.at);
        onCorrect();
        flash('good');
      } else {
        st.tally.falseTap();
        flash('oops');
      }
    } else if (!st.stim && !st.gapTapped && st.elapsed >= leadInMs) {
      // A tap with nothing on screen is an early response; count it once per gap.
      st.gapTapped = true;
      st.tally.falseTap();
      flash('oops');
    }
    force((x) => x + 1);
  };

  return {
    stim: r.current.stim,
    elapsed: r.current.elapsed,
    progress: Math.min(1, r.current.elapsed / durationMs),
    feedback,
    tap,
  };
}
