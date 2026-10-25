import { access, mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 想改分类，只改这张表：左边是文件夹名，右边是扩展名。
const CATEGORIES = {
  图片: ["jpg", "jpeg", "png", "gif", "webp", "heic", "svg"],
  文档: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv"],
  视频: ["mp4", "mov", "mkv", "avi", "webm"],
  音频: ["mp3", "wav", "m4a", "flac", "aac"],
  压缩包: ["zip", "rar", "7z", "tar", "gz"],
};

const EXT_TO_CATEGORY = new Map(
  Object.entries(CATEGORIES).flatMap(([category, extensions]) =>
    extensions.map((extension) => [extension, category]),
  ),
);

export function categoryOf(filename) {
  const extension = path.extname(filename).slice(1).toLowerCase();
  return EXT_TO_CATEGORY.get(extension) ?? "其他";
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function addSuffix(filename, index) {
  const extension = path.extname(filename);
  const base = filename.slice(0, -extension.length);
  return `${base}-${index}${extension}`;
}

export async function plan(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));
  const claimed = new Set();
  const moves = [];

  for (const file of files) {
    const category = categoryOf(file.name);
    let target = path.join(dir, category, file.name);
    let suffix = 1;

    while (claimed.has(target) || (await exists(target))) {
      target = path.join(dir, category, addSuffix(file.name, suffix));
      suffix += 1;
    }

    claimed.add(target);
    moves.push({ category, from: path.join(dir, file.name), to: target });
  }

  return moves;
}

export async function tidy(dir, { move = false } = {}) {
  const moves = await plan(dir);

  if (move) {
    for (const item of moves) {
      await mkdir(path.dirname(item.to), { recursive: true });
      await rename(item.from, item.to);
    }
  }

  return { moves, moved: move };
}

function printResult(dir, result) {
  if (result.moves.length === 0) {
    console.log("没有需要整理的文件。");
    return;
  }

  for (const item of result.moves) {
    const label = result.moved ? "已移动" : "预览";
    const target = path.relative(dir, item.to).split(path.sep).join("/");
    console.log(`[${label}] ${path.basename(item.from)} → ${target}`);
  }

  const counts = new Map();
  for (const item of result.moves) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  const summary = Object.keys(CATEGORIES)
    .concat("其他")
    .filter((category) => counts.has(category))
    .map((category) => `${category} ${counts.get(category)} 个`)
    .join("，");

  console.log(`\n共 ${result.moves.length} 个文件：${summary}`);
  if (!result.moved) {
    console.log("这是预览，没有移动任何文件。确认后加 --move 再跑一次。");
  }
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("用法：node tidy/tidy.mjs <文件夹> [--move]");
    console.log("  <文件夹>  要整理的目录（默认：待整理）");
    console.log("  --move    真的移动文件（默认只预览）");
    process.exit(0);
  }
  const move = args.includes("--move");
  const dir = args.find((arg) => !arg.startsWith("--")) ?? "待整理";

  try {
    const result = await tidy(dir, { move });
    printResult(dir, result);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      console.error(`打不开文件夹：${dir}`);
      console.error("确认路径拼写，或先在脚本旁边新建这个文件夹。");
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
