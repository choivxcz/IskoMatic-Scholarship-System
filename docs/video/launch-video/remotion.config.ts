import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Fewer parallel tabs: at the default (one per core) Windows runs out of socket buffers
// (net::ERR_NO_BUFFER_SPACE) while the Expo cut pulls frames from its 2304x1440 footage.
Config.setConcurrency(4);
