import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const run = promisify(execFile);

function pick(candidate) {
  return typeof candidate === "string" && candidate.length > 0 && existsSync(candidate)
    ? candidate
    : null;
}

export function resolveFfmpeg() {
  return process.env.FFMPEG_PATH || pick(ffmpegInstaller?.path) || "ffmpeg";
}

export function mediaEnv(base = process.env) {
  const binary = resolveFfmpeg();
  const inherited = base.PATH ?? "";
  const dirs = path.isAbsolute(binary) ? [path.dirname(binary), inherited] : [inherited];

  return {
    ...base,
    PATH: [...new Set(dirs.filter(Boolean))].join(path.delimiter),
  };
}

export async function mediaInfo({ input, ffmpeg = resolveFfmpeg() }) {
  try {
    const { stderr } = await run(ffmpeg, ["-hide_banner", "-i", input], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stderr;
  } catch (error) {
    if (typeof error.stderr === "string" && error.stderr.length > 0) {
      return error.stderr;
    }
    throw error;
  }
}

export async function probeDuration({ input, ffmpeg = resolveFfmpeg() }) {
  const info = await mediaInfo({ input, ffmpeg });
  const match = info.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);

  if (!match) {
    throw new Error(`无法读取视频时长: ${input}`);
  }

  const duration =
    Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`无法读取视频时长: ${input}`);
  }

  return duration;
}

export async function probeDimensions({ input, ffmpeg = resolveFfmpeg() }) {
  const info = await mediaInfo({ input, ffmpeg });
  const line = info.split(/\r?\n/).find((item) => item.includes("Video:"));
  const match = line?.match(/,\s*(\d{2,5})x(\d{2,5})(?=[\s,\[])/);

  if (!match) {
    throw new Error(`无法读取视频尺寸: ${input}`);
  }

  return { width: Number(match[1]), height: Number(match[2]) };
}
