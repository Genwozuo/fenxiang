import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const HINTS = {
  darwin: "macOS：brew install ffmpeg",
  win32: "Windows：从 ffmpeg.org 下载构建包，解压后把 bin 目录加进用户 PATH",
  linux: "Linux：sudo apt install ffmpeg（Debian/Ubuntu）或 sudo dnf install ffmpeg（Fedora）",
};

export function hintFor(platform = process.platform) {
  return HINTS[platform] ?? HINTS.linux;
}

export function commonPaths(platform = process.platform, env = process.env) {
  if (platform === "win32") {
    const home = env.USERPROFILE ?? "C:\\Users\\你";
    const local = env.LOCALAPPDATA ?? path.win32.join(home, "AppData", "Local");
    return [
      "C:\\ffmpeg\\bin\\ffmpeg.exe",
      "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
      "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
      path.win32.join(home, "scoop", "shims", "ffmpeg.exe"),
      path.win32.join(local, "Microsoft", "WinGet", "Links", "ffmpeg.exe"),
    ];
  }

  if (platform === "darwin") {
    return ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/local/bin/ffmpeg"];
  }

  return ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/snap/bin/ffmpeg"];
}

export function pathEntries(env = process.env, platform = process.platform) {
  const raw = env.PATH ?? env.Path ?? "";
  return raw.split(platform === "win32" ? ";" : ":").filter(Boolean);
}

export function findInPath(command, { platform = process.platform, env = process.env, exists = existsSync } = {}) {
  const names = platform === "win32" ? [`${command}.exe`, command] : [command];

  for (const dir of pathEntries(env, platform)) {
    for (const name of names) {
      const file = platform === "win32" ? path.win32.join(dir, name) : path.join(dir, name);
      if (exists(file)) return file;
    }
  }

  return null;
}

export function parseVersion(output, tool = "ffmpeg") {
  const match = new RegExp(`^${tool} version (\\S+)`, "m").exec(output);
  return match ? match[1] : null;
}

function probeCommand(tool) {
  const result = spawnSync(tool, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) return { found: false };

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return { found: true, version: parseVersion(output, tool) };
}

export function diagnose(options = {}) {
  const {
    platform = process.platform,
    env = process.env,
    exists = existsSync,
    probe = probeCommand,
  } = options;

  return {
    platform,
    ffmpeg: probe("ffmpeg"),
    ffprobe: probe("ffprobe"),
    candidates: commonPaths(platform, env).map((file) => ({ file, exists: exists(file) })),
  };
}

function printReport({ platform, ffmpeg, ffprobe, candidates }) {
  const status = (item) => (item.found ? (item.version ?? "已安装（版本未知）") : "未找到");

  console.log(`ffmpeg：${status(ffmpeg)}`);
  console.log(`ffprobe：${status(ffprobe)}`);

  if (ffmpeg.found) {
    const file = findInPath("ffmpeg", { platform });
    if (file) console.log(`路径：${file}`);
  }

  if (ffmpeg.found && ffprobe.found) {
    console.log("\n状态：可用，视频脚本可以继续。");
    return;
  }

  if (ffmpeg.found && !ffprobe.found) {
    console.log("\nffprobe 缺失。它通常和 ffmpeg 在同一个安装包里，重装完整版本即可。");
    console.log("装完重开终端，再运行 ffprobe -version 确认。");
    return;
  }

  console.log("\n常见安装位置：");
  for (const item of candidates) {
    console.log(`  ${item.exists ? "存在  " : "不存在"}  ${item.file}`);
  }

  const installed = candidates.filter((item) => item.exists);
  console.log("\n怎么处理：");

  if (installed.length > 0) {
    console.log(`  已经找到了文件，但它不在 PATH 里：${installed[0].file}`);
    console.log("  把它的 bin 目录加进 PATH，重开终端后再运行一次这个脚本。");
  } else {
    console.log(`  ${hintFor(platform)}`);
  }

  console.log("  装完先关掉终端再重开，然后运行 ffmpeg -version 确认。");
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  printReport(diagnose());
}
