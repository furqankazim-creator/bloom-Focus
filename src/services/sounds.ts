import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useStore } from '../store/useStore';

const SOURCES = {
  pop: require('../../assets/sounds/pop.wav'),
  soft: require('../../assets/sounds/soft.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  tick: require('../../assets/sounds/tick.wav'),
};
export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let modeSet = false;

/** Plays a short effect if sounds are on. Never throws: sound is a nice-to-have. */
export function playSound(name: SoundName) {
  if (!useStore.getState().soundOn) return;
  try {
    if (!modeSet) {
      modeSet = true;
      // Respect the phone's silent switch; don't interrupt the family's music.
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    const p = (players[name] ??= createAudioPlayer(SOURCES[name]));
    p.volume = name === 'soft' ? 0.5 : 0.8;
    p.seekTo(0);
    p.play();
  } catch {
    // Audio unavailable (e.g. blocked autoplay on web).
  }
}
