import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);

const LABELS = {
  "utf-8": "UTF-8",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  gb18030: "GBK/GB18030",
};

function startsWith(buffer, prefix) {
  return prefix.every((byte, index) => buffer[index] === byte);
}

function canDecode(buffer, encoding) {
  try {
    new TextDecoder(encoding, { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

export function detectEncoding(buffer) {
  if (startsWith(buffer, UTF8_BOM)) return { encoding: "utf-8", bom: true };
  if (startsWith(buffer, UTF16LE_BOM)) return { encoding: "utf-16le", bom: true };
  if (startsWith(buffer, UTF16BE_BOM)) return { encoding: "utf-16be", bom: true };

  // 二进制文件通常含 NUL；UTF-16 已经在上面按 BOM 处理。
  if (buffer.includes(0)) return { encoding: null, bom: false };

  if (canDecode(buffer, "utf-8")) return { encoding: "utf-8", bom: false };
  if (canDecode(buffer, "gb18030")) return { encoding: "gb18030", bom: false };
  return { encoding: null, bom: false };
}

export function decodeText(buffer, { encoding }) {
  const text = new TextDecoder(encoding, { fatal: false }).decode(buffer);
  return text.replace(/^\uFEFF/, "");
}

export function encodeUtf8(text, { bom = true } = {}) {
  const body = Buffer.from(text, "utf8");
  return bom ? Buffer.concat([UTF8_BOM, body]) : body;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function outputName(file) {
  const extension = path.extname(file);
  return `${file.slice(0, -extension.length)}.utf8${extension}`;
}

export async function convertFile(file, { write = false, bom = true } = {}) {
  const buffer = await readFile(file);
  const detected = detectEncoding(buffer);

  if (!detected.encoding) {
    return { file, status: "skipped", reason: "无法识别编码", detected };
  }

  if (detected.encoding === "utf-8" && detected.bom === bom) {
    return {
      file,
      status: "skipped",
      reason: `已经是 UTF-8${bom ? "（带 BOM）" : "（无 BOM）"}`,
      detected,
    };
  }

  const target = outputName(file);
  if (await exists(target)) {
    return {
      file,
      status: "skipped",
      reason: `输出已存在：${path.basename(target)}`,
      detected,
    };
  }

  const text = decodeText(buffer, detected);

  if (write) {
    await writeFile(target, encodeUtf8(text, { bom }));
  }

  return { file, status: "converted", target, detected, preview: !write };
}

export async function collectFiles(target) {
  const info = await stat(target);
  if (!info.isDirectory()) return [target];

  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".csv") &&
        !/\.utf8(-\d+)?\.csv$/i.test(entry.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => path.join(target, entry.name));
}

export async function convertAll(target, options = {}) {
  const files = await collectFiles(target);
  const results = [];

  for (const file of files) {
    results.push(await convertFile(file, options));
  }

  return results;
}

function printResults(results, { write, directory, bom }) {
  if (results.length === 0) {
    console.log("没有找到 CSV 文件。");
    return;
  }

  let converted = 0;
  let skipped = 0;

  for (const result of results) {
    const from = path.basename(result.file);

    if (result.status === "skipped") {
      skipped += 1;
      console.log(`[跳过] ${from}：${result.reason}`);
      continue;
    }

    converted += 1;
    const to = path.basename(result.target);
    const name = result.detected.encoding ? LABELS[result.detected.encoding] : "未知";
    const sourceBom = result.detected.bom ? "带 BOM" : "无 BOM";
    const targetBom = bom ? "带 BOM" : "无 BOM";
    const prefix = write ? "已转换" : "预览";
    console.log(`[${prefix}] ${from} → ${to}（${name}，${sourceBom} → UTF-8，${targetBom}）`);
  }

  console.log(`\n共 ${results.length} 个文件：转换 ${converted} 个，跳过 ${skipped} 个。`);

  if (write) {
    console.log("原文件没有改动；输出文件名固定为 .utf8.csv，已存在时跳过。");
  } else {
    console.log("这是预览，没有写入任何文件。确认后加 --write 再跑一次。");
    if (directory) console.log("目录模式只处理当前层的 .csv，不递归子目录。");
  }
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("用法：node fix-csv.mjs <文件或目录> [--write] [--no-bom]");
    console.log("  <文件或目录>  要转换的 CSV（默认只预览）");
    console.log("  --write       真的写入文件");
    console.log("  --no-bom      不写 UTF-8 BOM");
    process.exit(0);
  }
  const write = args.includes("--write");
  const bom = !args.includes("--no-bom");
  const target = args.find((arg) => !arg.startsWith("--"));

  if (!target) {
    console.error("用法：node fix-csv.mjs <文件或目录> [--write] [--no-bom]");
    process.exitCode = 1;
  } else {
    try {
      const info = await stat(target);
      const results = await convertAll(target, { write, bom });
      printResults(results, { write, directory: info.isDirectory(), bom });
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        console.error(`打不开路径：${target}`);
        console.error("确认文件或目录是否存在，路径里有空格时用引号包住。");
        process.exitCode = 1;
      } else {
        throw error;
      }
    }
  }
}
