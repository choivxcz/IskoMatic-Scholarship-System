import {AbsoluteFill, Sequence} from 'remotion';
import {Backdrop} from './components/Backdrop';
import {Headline} from './components/Headline';
import {Decide} from './scenes/Decide';
import {EndCard} from './scenes/EndCard';
import {Explain} from './scenes/Explain';
import {Proof} from './scenes/Proof';
import {Rank} from './scenes/Rank';
import {Register} from './scenes/Register';
import {Rules} from './scenes/Rules';

// Rhythm borrowed from the reference: short verb-led text beat (1.5s), then the app doing
// that thing (3–4s), five times; one full-colour proof moment; logo end card. 30s at 30fps.
type Beat = {name: string; frames: number; render: (d: number) => React.ReactNode};
const text = (t: string) => (d: number) => <Headline duration={d} text={t} />;

const BEATS: Beat[] = [
  {name: 'Text: register', frames: 45, render: text('Register every applicant.')},
  {name: 'UI: register wizard', frames: 120, render: (d) => <Register duration={d} />},
  {name: 'Text: rules', frames: 45, render: text('Rules come first.')},
  {name: 'UI: eligibility rules', frames: 90, render: (d) => <Rules duration={d} />},
  {name: 'Text: model', frames: 45, render: text('Then the AI explains itself.')},
  {name: 'UI: AI explanation', frames: 105, render: (d) => <Explain duration={d} />},
  {name: 'Text: rank', frames: 45, render: text('Review the strongest first.')},
  {name: 'UI: ranking + endorse', frames: 90, render: (d) => <Rank duration={d} />},
  {name: 'Proof: accuracy', frames: 120, render: (d) => <Proof duration={d} />},
  {name: 'Text: people decide', frames: 45, render: text('People make the final call.')},
  {name: 'UI: decision + activity log', frames: 75, render: (d) => <Decide duration={d} />},
  {name: 'End card', frames: 75, render: (d) => <EndCard duration={d} />},
];

export const TOTAL_FRAMES = BEATS.reduce((s, b) => s + b.frames, 0);

export const LaunchVideo: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill>
      <Backdrop />
      {BEATS.map((b) => {
        const start = from;
        from += b.frames;
        return (
          <Sequence key={b.name} name={b.name} from={start} durationInFrames={b.frames}>
            {b.render(b.frames)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
