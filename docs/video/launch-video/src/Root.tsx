import {Composition} from 'remotion';
import {LaunchVideo, TOTAL_FRAMES} from './LaunchVideo';
import {FPS, H, W} from './theme';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="LaunchVideo"
    component={LaunchVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={W}
    height={H}
  />
);
