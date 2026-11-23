import {Composition} from 'remotion';
import {LaunchVideo, TOTAL_FRAMES} from './LaunchVideo';
import {EXPO_FRAMES, ExpoVideo} from './expo/ExpoVideo';
import {EH, EW} from './expo/kit';
import {FPS, H, W} from './theme';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LaunchVideo"
      component={LaunchVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={W}
      height={H}
    />
    {/* Landscape expo cut with real footage of the running system. */}
    <Composition id="ExpoVideo" component={ExpoVideo} durationInFrames={EXPO_FRAMES} fps={FPS} width={EW} height={EH} />
  </>
);
