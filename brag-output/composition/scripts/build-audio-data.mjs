import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../assets/music/audio-data.json", import.meta.url);
const destination = new URL("../assets/music/audio-data.js", import.meta.url);
const data = JSON.parse(readFileSync(source, "utf8"));

if (data.fps !== 30 || data.totalFrames !== 600 || !Array.isArray(data.frames)) {
  throw new Error("Unexpected 20-second audio analysis format");
}

writeFileSync(destination, `window.AUDIO_DATA=${JSON.stringify(data)};\n`);
