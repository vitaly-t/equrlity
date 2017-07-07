import * as webAudioBuilder from 'waveform-data/webaudio';

export default async function buildWaveform(buffer: ArrayBuffer): Promise<string> {
  return new Promise<string>(resolve => {
    const audioContext = new AudioContext();

    webAudioBuilder(audioContext, buffer, (error, waveform) => {
      console.log(waveform.duration);
      let sample_rate = audioContext.sampleRate;
      let samples_per_pixel = sample_rate / waveform.pixels_per_second;
      let bits = 8;
      let max: number[] = waveform.max;
      let min: number[] = waveform.min;
      let l = max.length;
      let data = new Array(l * 2);
      for (let i = 0; i < l; ++i) {
        let j = i * 2;
        data[j] = min[i];
        data[j + 1] = max[i];
      }
      let o = { sample_rate, samples_per_pixel, bits, length: l, data };
      let js = JSON.stringify(o);
      resolve(js);
    });

  })
}


