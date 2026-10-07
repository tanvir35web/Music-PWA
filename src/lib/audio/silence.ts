/**
 * A few milliseconds of silent 8 kHz mono WAV as a data URI.
 *
 * iOS Safari only lets a media element start playback from a user gesture.
 * Loading a track from IndexedDB is asynchronous, which loses the gesture, so
 * the engine first plays this clip synchronously inside the tap. WebKit then
 * treats the element as user-activated and allows later `play()` calls on it,
 * including automatic advance to the next track while the screen is locked.
 */
function buildSilentWav(): string {
  const samples = 80;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // sample rate
  view.setUint32(28, 8000, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(0x80, 44); // 8-bit silence
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export const SILENT_AUDIO_SRC = buildSilentWav();
