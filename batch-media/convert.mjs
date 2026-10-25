import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { resolveFfmpeg } from "./tools.mjs";

const run = promisify(execFile);
const ROOT = import.meta.dirname;

export const PROFILES = [
  { name: "douyin", width: 1080, height: 1920, mode: "pad" },
  { name: "xiaohongshu", width: 1080, height: 1440, mode: "pad" },
  { name: "shipinhao", width: 1080, height: 1080, mode: "pad" },
];

export function buildFilter({ width, height, mode }) {
  if (mode === "crop") {
    return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  }

  return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
}

export function buildConvertArgs({ input, output, profile }) {
  return [
    "-y",
    "-i", input,
    "-vf", buildFilter(profile),
    "-c:v", "libx264",
    "-crf", "20",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    output,
  ];
}

export async function convertAll({
  input,
  outputDir,
  profiles = PROFILES,
  ffmpeg = resolveFfmpeg(),
}) {
  await access(input, constants.R_OK);
  await mkdir(outputDir, { recursive: true });

  const outputs = [];
  for (const profile of profiles) {
    const output = path.join(outputDir, `${profile.name}.mp4`);
    await run(ffmpeg, buildConvertArgs({ input, output, profile }), {
      maxBuffer: 10 * 1024 * 1024,
    });
    outputs.push(output);
  }

  return outputs;
}

async function main() {
  const input = path.resolve(ROOT, process.argv[2] ?? "input/demo.mp4");
  const outputs = await convertAll({ input, outputDir: path.join(ROOT, "output") });

  for (const output of outputs) console.log(`done: ${output}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
