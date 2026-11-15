// Inline SVG icons, so no glyph depends on font coverage.

type P = {size: number; color: string};

export const Check: React.FC<P> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const Bolt: React.FC<P> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13.5 2L4 14h6.5L9.5 22 20 9.5h-6.5L13.5 2z" />
  </svg>
);

export const Star: React.FC<P> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5z" />
  </svg>
);

export const Arrow: React.FC<P & {down?: boolean}> = ({size, color, down}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{transform: down ? 'rotate(180deg)' : undefined}}>
    <path d="M12 4l9 15H3z" />
  </svg>
);

export const Play: React.FC<P> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round">
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
);
