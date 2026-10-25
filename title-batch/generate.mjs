import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = import.meta.dirname;

// 固定 seed，保证同一份词库每次跑出来的候选一致，方便和同事或过去的自己对比。
export function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lengthOf = (text) => [...text].length;
export const normalize = (text) =>
  text.replaceAll(/\s|[，。！？、：；“”"'’]/g, "");

const pick = (list, random) => list[Math.floor(random() * list.length)];

export function fill(pattern, config, random) {
  const slots = [...pattern.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  const values = {};
  for (const slot of slots) {
    const pool = slot === "keyword" ? config.keywords : config[slot];
    if (!Array.isArray(pool) || pool.length === 0) {
      throw new Error(`模板里的 {${slot}} 在 config.json 中找不到对应数组`);
    }
    values[slot] = pick(pool, random);
  }
  return values;
}

export function render(pattern, values) {
  return pattern.replaceAll(/\{(\w+)\}/g, (_, slot) => values[slot]);
}

export function findBanned(title, config) {
  return config.banned.find((word) => title.includes(word)) ?? null;
}

export function score(title, config) {
  const length = lengthOf(title);
  const keyword = config.keywords.find((word) => title.includes(word));
  let value = 40;
  if (keyword) value += 25;
  value += Math.max(0, 15 - Math.abs(length - 18));
  if (/[？?！!]/.test(title)) value += 5;
  if (/\d/.test(title)) value += 5;
  return { value, keyword: keyword ?? "" };
}

export function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function generateTitles(config) {
  const random = mulberry32(config.seed);
  const seen = new Set();
  const candidates = [];
  const patternCount = new Map();
  const stats = {
    attempts: 0,
    duplicated: 0,
    rejectedPattern: 0,
    rejectedLength: 0,
    rejectedBanned: 0,
    rejectedKeyword: 0,
  };
  const maxAttempts = config.count * 2000;

  while (candidates.length < config.count && stats.attempts < maxAttempts) {
    stats.attempts += 1;
    const pattern = pick(config.patterns, random);

    // 同一个句式最多用几次，否则 30 条里会有一半读起来一样。
    if ((patternCount.get(pattern) ?? 0) >= config.maxPerPattern) {
      stats.rejectedPattern += 1;
      continue;
    }

    const values = fill(pattern, config, random);
    const title = render(pattern, values);
    const key = normalize(title);

    if (seen.has(key)) {
      stats.duplicated += 1;
      continue;
    }

    const length = lengthOf(title);
    if (length < config.minLength || length > config.maxLength) {
      stats.rejectedLength += 1;
      continue;
    }

    if (findBanned(title, config)) {
      stats.rejectedBanned += 1;
      continue;
    }

    if (!config.keywords.some((word) => title.includes(word))) {
      stats.rejectedKeyword += 1;
      continue;
    }

    seen.add(key);
    patternCount.set(pattern, (patternCount.get(pattern) ?? 0) + 1);
    const { value, keyword } = score(title, config);
    candidates.push({ title, length, score: value, keyword, pattern, ...values });
  }

  candidates.sort((a, b) => b.score - a.score || a.length - b.length);

  return { candidates, stats };
}

function pickShortlist(candidates) {
  // 精选用贪心方式限制每个句式最多 2 条，避免清单被同一种说法刷屏。
  const shortlist = [];
  const picked = new Map();
  for (const item of candidates) {
    if (shortlist.length >= 10) break;
    if ((picked.get(item.pattern) ?? 0) >= 2) continue;
    shortlist.push(item);
    picked.set(item.pattern, (picked.get(item.pattern) ?? 0) + 1);
  }
  return shortlist;
}

async function main() {
  const configPath = path.resolve(ROOT, process.argv[2] ?? "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const OUTPUT_DIR = path.join(ROOT, "out");

  const { candidates, stats } = generateTitles(config);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const headers = ["title", "length", "score", "keyword"];
  const csv = [
    headers.join(","),
    ...candidates.map((item) => headers.map((header) => csvCell(item[header])).join(",")),
  ].join("\n");

  await writeFile(path.join(OUTPUT_DIR, "titles.csv"), `${csv}\n`);

  const shortlist = pickShortlist(candidates);
  const markdown = `# 标题候选（前 10 条）

共生成 ${candidates.length} 条，按分数排序。分数只做初筛，最终以你愿不愿意点开为准。

${shortlist
  .map(
    (item, index) =>
      `${index + 1}. **${item.title}**（${item.length} 字，${item.score} 分）\n   - 模板：\`${item.pattern}\``,
  )
  .join("\n")}

## 下一步

1. 从这 10 条里挑 3 条，改成你账号自己的语气。
2. 剩下的交给读者投票，或先各发一次小范围测试。
3. 被否掉的词回到 \`config.json\`，下次不再生成。
`;

  await writeFile(path.join(OUTPUT_DIR, "shortlist.md"), markdown);

  console.log(`已生成 ${candidates.length} 条标题`);
  console.log(`尝试 ${stats.attempts} 次；重复 ${stats.duplicated}，句式配额 ${stats.rejectedPattern}，超长/过短 ${stats.rejectedLength}，违禁词 ${stats.rejectedBanned}，缺少关键词 ${stats.rejectedKeyword}`);
  console.log(`结果：${path.relative(ROOT, path.join(OUTPUT_DIR, "titles.csv"))}、${path.relative(ROOT, path.join(OUTPUT_DIR, "shortlist.md"))}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
