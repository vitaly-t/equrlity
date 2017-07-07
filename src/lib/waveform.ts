/*
import { AudioContext } from 'web-audio-api';
import * as extractPeaks from 'webaudio-peaks';

export async function buildWaveform(buffer: ArrayBuffer): Promise<any> {
  return new Promise<any>(resolve => {
    const audioCtx = new AudioContext();
    audioCtx.decodeAudioData(buffer, function (decodedData) {
      let sample_rate = audioCtx.sampleRate;
      let samples_per_pixel = 512;
      let bits = 8;
      let a = extractPeaks(decodedData, 512, true);
      let data = a.data[0]
      let length = data.length / 2;
      let o = { sample_rate, samples_per_pixel, bits, length, data };
      resolve(o);
    });
  });
}
*/
