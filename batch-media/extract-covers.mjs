import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { probeDuration, resolveFfmpeg } from "./tools.mjs";

const run = promisify(execFile);
const ROOT = import.meta.dirname;

export const POSITIONS = [0.2, 0.5, 0.8];

export function coverTimes(duration, positions = POSITIONS) {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`无法读取视频时长: ${duration}`);
  }

  return positions.map((position) => ({
    position,
    seconds: Math.max(0, duration * position - 0.05),
    filename: `cover-${Math.round(position * 100)}.jpg`,
  }));
}

export function buildCoverArgs({ input, seconds, output }) {
  return [
    "-y",
    "-ss", seconds.toFixed(2),
    "-i", input,
    "-frames:v", "1",
    "-q:v", "2",
    output,
  ];
}

export { probeDuration };

export async function extractCovers({
  input,
  outputDir,
  positions = POSITIONS,
  ffmpeg = resolveFfmpeg(),
}) {
  await access(input, constants.R_OK);

  const duration = await probeDuration({ input, ffmpeg });
  await mkdir(outputDir, { recursive: true });

  const outputs = [];
  for (const cover of coverTimes(duration, positions)) {
    const output = path.join(outputDir, cover.filename);
    await run(ffmpeg, buildCoverArgs({ input, seconds: cover.seconds, output }), {
      maxBuffer: 10 * 1024 * 1024,
    });
    outputs.push(output);
  }

  return outputs;
}

async function main() {
  const input = path.resolve(ROOT, process.argv[2] ?? "input/demo.mp4");
  const outputs = await extractCovers({ input, outputDir: path.join(ROOT, "output") });

  for (const output of outputs) console.log(`done: ${output}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
