const fs = require('fs');
const sampleRate = 44100;
const durationSeconds = 12;
const numSamples = sampleRate * durationSeconds;
const channels = 1;
const buffer = Buffer.alloc(44 + numSamples * 2);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(channels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * channels * 2, 28);
buffer.writeUInt16LE(channels * 2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * 2, 40);

let offset = 44;
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  
  // Kick drum (pitch and amp envelope)
  const beatTime = t % 0.5;
  const kickFreq = 150 * Math.exp(-25 * beatTime); 
  const kickEnv = Math.max(0, 1 - beatTime * 5);
  const kick = Math.sin(2 * Math.PI * kickFreq * beatTime) * kickEnv;

  // Hi-hat (noise burst)
  const hatTime = t % 0.25;
  const hatEnv = Math.max(0, Math.exp(-40 * hatTime));
  const hat = (Math.random() * 2 - 1) * hatEnv * 0.25;

  // Bass (Sawtooth pulsing with 16ths syncopation)
  const isSyncopated = (t % 0.5) > 0.25;
  const bassFreq = (t % 4 < 2) ? 55 : (t % 4 < 3 ? 49 : 55); 
  let bassEnv = Math.max(0, 1 - (t % 0.25) * 4);
  const bass = (2 * ((bassFreq * t) - Math.floor(bassFreq * t)) - 1) * bassEnv * 0.4;

  // Impact sound at scene changes (T=3s, T=8s)
  const impact1 = Math.max(0, t - 3.0);
  const impact2 = Math.max(0, t - 8.0);
  const swoop = Math.max(0, Math.exp(-1.5 * impact1) * Math.sin(100 * impact1) * 0.4) + 
                Math.max(0, Math.exp(-1.5 * impact2) * Math.sin(100 * impact2) * 0.4);

  let sample = (kick * 1.2 + hat + bass + swoop) * 0.7;
  if (sample > 0.99) sample = 0.99;
  if (sample < -0.99) sample = -0.99;
  
  const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
  buffer.writeInt16LE(intSample, offset);
  offset += 2;
}

fs.writeFileSync('public/bgm.wav', buffer);
console.log('Audio file generated at public/bgm.wav');
