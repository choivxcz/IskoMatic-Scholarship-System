import {interpolate, spring} from 'remotion';
import {C, CLAMP} from '../theme';

export type Pt = {x: number; y: number};
export type Move = {start: number; from: Pt; to: Pt};

/** Quadratic bezier from a to b, bowed sideways so paths curve like a hand would. */
const bezier = (a: Pt, b: Pt, t: number): Pt => {
  const c = {x: (a.x + b.x) / 2 - (b.y - a.y) * 0.22, y: (a.y + b.y) / 2 + (b.x - a.x) * 0.22};
  const u = 1 - t;
  return {x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y};
};

/** Cursor position on a frame. Every move is spring-driven (damping 15); it never teleports. */
export const cursorAt = (frame: number, fps: number, moves: Move[]): Pt => {
  if (frame < moves[0].start) return moves[0].from;
  let move = moves[0];
  for (const m of moves) if (frame >= m.start) move = m;
  return bezier(move.from, move.to, spring({frame: frame - move.start, fps, config: {damping: 15}}));
};

/** Navy dot with a white ring (reads on white cards and the pale canvas) and a soft trail. */
export const Cursor: React.FC<{frame: number; fps: number; moves: Move[]; opacity?: number}> = ({frame, fps, moves, opacity = 1}) => {
  const p = cursorAt(frame, fps, moves);
  const dot = (x: number, y: number, size: number, style: React.CSSProperties, key?: number) => (
    <div key={key} style={{position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: 999, transform: 'translate(-50%, -50%)', ...style}} />
  );
  return (
    <div style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}>
      {[6, 5, 4, 3, 2, 1].map((k) => {
        const t = cursorAt(frame - k, fps, moves);
        return dot(t.x, t.y, 18, {background: C.navy, opacity: 0.5 * (1 - k / 7)}, k);
      })}
      {dot(p.x, p.y, 30, {background: C.navy, border: '5px solid white', boxShadow: '0 8px 22px rgba(6,31,78,0.35)'})}
    </div>
  );
};

/** Expanding, fading click ring. */
export const Ripple: React.FC<{frame: number; at: number; pos: Pt; color?: string}> = ({frame, at, pos, color = C.blue}) => {
  const f = frame - at;
  if (f < 0 || f > 20) return null;
  const size = interpolate(f, [0, 20], [20, 190], CLAMP);
  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: size,
        height: size,
        borderRadius: 999,
        border: `5px solid ${color}`,
        opacity: interpolate(f, [0, 20], [0.75, 0], CLAMP),
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    />
  );
};

/** 1 → 0.95 → 1 press curve for a button clicked at `at`. */
export const press = (frame: number, at: number) => 1 - 0.05 * interpolate(frame, [at, at + 4, at + 12], [0, 1, 0], CLAMP);
