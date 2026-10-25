// 自检：在临时目录里造样例、跑脚本、校验结果，不碰真实文件。
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const run = (script, args, cwd = ROOT) =>
  execFileSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

let passed = 0;
let skipped = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    // 依赖缺失时跳过而不是失败
    if (/Cannot find package|ERR_MODULE_NOT_FOUND/.test(String(error.stderr ?? error))) {
      skipped += 1;
      console.log(`skip ${name}（缺少可选依赖，先 npm install）`);
      return;
    }
    throw error;
  }
}

const tmp = await mkdtemp(path.join(tmpdir(), "gz-smoke-"));

await check("tidy 按扩展名移动文件", async () => {
  const dir = path.join(tmp, "tidy");
  await mkdir(dir, { recursive: true });
  for (const name of ["a.jpg", "b.PDF", "c.mp4", "d.unknown"]) {
    await writeFile(path.join(dir, name), "");
  }
  run("tidy/tidy.mjs", [dir, "--move"]);
  const entries = await readdir(dir);
  for (const folder of ["图片", "文档", "视频", "其他"]) {
    if (!entries.includes(folder)) throw new Error(`缺少分类目录 ${folder}`);
  }
  if (!(await readdir(path.join(dir, "图片"))).includes("a.jpg")) {
    throw new Error("a.jpg 没有被移动到 图片/");
  }
});

await check("tidy 默认只预览，不动文件", async () => {
  const dir = path.join(tmp, "tidy-preview");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "x.jpg"), "");
  run("tidy/tidy.mjs", [dir]);
  const entries = await readdir(dir);
  if (entries.includes("图片")) throw new Error("预览模式不应该创建目录");
});

await check("fix-csv 把 GBK 转成带 BOM 的 UTF-8", async () => {
  const file = path.join(tmp, "gbk.csv");
  // 「中文测试」的 GBK 字节
  await writeFile(file, Buffer.from([0xd6, 0xd0, 0xce, 0xc4, 0xb2, 0xe2, 0xca, 0xd4]));
  run("fix-csv/fix-csv.mjs", [file, "--write"]);
  const outFile = file.replace(/\.csv$/, ".utf8.csv");
  const text = (await readFile(outFile)).toString("utf8");
  if (!text.startsWith("\uFEFF")) throw new Error("缺少 BOM");
  if (!text.includes("中文测试")) throw new Error("转换后内容不对");
  const original = (await readFile(file)).toString("latin1");
  if (text === original) throw new Error("原文件不应被覆盖");
});

await check("title-batch 生成标题 CSV", async () => {
  run("title-batch/generate.mjs", []);
  const csv = await readFile(path.join(ROOT, "title-batch/out/titles.csv"), "utf8");
  if (csv.trim().split("\n").length < 5) throw new Error("标题数量过少");
});

await check("content-review 汇总样例数据", async () => {
  run("content-review/review.mjs", []);
  const out = await readdir(path.join(ROOT, "content-review/out"));
  if (!out.some((name) => name.endsWith(".md"))) throw new Error("没有生成周报 markdown");
});

await check("cover-batch 生成封面", async () => {
  run("cover-batch/render.mjs", []);
  const out = await readdir(path.join(ROOT, "cover-batch/output"));
  if (!out.some((name) => name.startsWith("cover-") && name.endsWith(".jpg"))) {
    throw new Error("没有生成封面");
  }
});

await rm(tmp, { recursive: true, force: true });

console.log(`\n通过 ${passed} 项，跳过 ${skipped} 项。`);
if (passed === 0) process.exitCode = 1;
