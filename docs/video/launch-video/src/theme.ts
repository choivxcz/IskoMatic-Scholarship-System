import {loadFont} from '@remotion/google-fonts/Inter';
import {interpolate} from 'remotion';

// The desktop app uses Inter everywhere (app/ui/desktop/src/municipal-theme.css).
const inter = loadFont('normal', {weights: ['400', '500', '600', '700', '800'], subsets: ['latin']});
export const FONT = inter.fontFamily;

export const W = 1080;
export const H = 1920;
export const FPS = 30;

// Safe zone: 150px top, 170px bottom, 60px sides.
export const SAFE = {top: 150, bottom: 170, side: 60};
export const CONTENT_W = W - SAFE.side * 2; // 960

// The app's own palette (app/ui/desktop/src/styles/tokens.css, ai-explanation.css).
export const C = {
  navy: '#061f4e',
  sidebar: '#052968',
  blue: '#115df4',
  azure: '#3288ff',
  pale: '#eef5ff',
  canvas: '#f4f8fe',
  line: '#dbe6f5',
  ink: '#14264a',
  muted: '#536d94',
  soft: '#667fa7',
  green: '#13835f',
  red: '#c92e4b',
  amber: '#e7a04a',
  purple: '#7048cb',
  white: '#ffffff',
};

export const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const card: React.CSSProperties = {
  background: C.white,
  border: `2px solid ${C.line}`,
  borderRadius: 32,
  boxShadow: '0 40px 90px rgba(6,31,78,0.16), 0 6px 18px rgba(6,31,78,0.06)',
  boxSizing: 'border-box',
};

/** 0→1 progress of a linear ramp between two frames. */
export const ramp = (frame: number, from: number, to: number) => interpolate(frame, [from, to], [0, 1], CLAMP);
