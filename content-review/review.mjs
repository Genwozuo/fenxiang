import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = import.meta.dirname;

// 平台后台导出的 CSV 常常带 BOM、CRLF 和引号包裹的逗号，先统一处理再按行切。
export function parseCsv(text) {
  const source = text.replace(/^﻿/, "").replaceAll("\r\n", "\n");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((line) => line.some((cell) => cell.trim() !== ""));
}

export function toNumber(value) {
  const number = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(number) ? number : 0;
}

export function parseDate(value) {
  const text = String(value ?? "").trim().replaceAll("/", "-");
  const date = new Date(text.replace(" ", "T"));
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function median(numbers) {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDate(date) {
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : "未知";
}

export function detectPlatform(filename, header, config) {
  const byName = Object.entries(config.platforms).find(([key]) => filename.startsWith(key));
  if (byName) return byName[0];

  const byColumn = Object.entries(config.platforms).find(([, platform]) =>
    header.includes(platform.columns.title),
  );
  return byColumn?.[0] ?? null;
}

export function normalizeRow(row, header, platformKey, config) {
  const platform = config.platforms[platformKey];
  const pick = (column) => {
    const index = header.indexOf(column);
    return index === -1 ? "" : row[index];
  };

  const views = toNumber(pick(platform.columns.views));
  const likes = toNumber(pick(platform.columns.likes));
  const comments = toNumber(pick(platform.columns.comments));
  const collects = toNumber(pick(platform.columns.collects));
  const shares = toNumber(pick(platform.columns.shares));
  const engagements = likes + comments + collects + shares;

  return {
    platform: platform.label,
    title: String(pick(platform.columns.title)).trim(),
    date: parseDate(pick(platform.columns.date)),
    views,
    likes,
    comments,
    collects,
    shares,
    engagements,
    rate: views > 0 ? engagements / views : 0,
  };
}

export async function loadRows(inputDir, config) {
  const files = (await readdir(inputDir)).filter((file) => file.toLowerCase().endsWith(".csv"));
  const posts = [];
  const skipped = [];

  for (const file of files.sort()) {
    const rows = parseCsv(await readFile(path.join(inputDir, file), "utf8"));
    if (rows.length < 2) {
      skipped.push({ file, reason: "没有数据行" });
      continue;
    }

    const [header, ...body] = rows;
    const platformKey = detectPlatform(file, header, config);

    if (!platformKey) {
      skipped.push({ file, reason: "无法识别平台，请检查文件名或表头" });
      continue;
    }

    for (const row of body) {
      const post = normalizeRow(row, header, platformKey, config);
      if (post.title) posts.push(post);
    }
  }

  return { posts, skipped };
}

export function summarize(posts) {
  return {
    count: posts.length,
    views: posts.reduce((sum, post) => sum + post.views, 0),
    engagements: posts.reduce((sum, post) => sum + post.engagements, 0),
    rate:
      posts.reduce((sum, post) => sum + post.views, 0) > 0
        ? posts.reduce((sum, post) => sum + post.engagements, 0) /
          posts.reduce((sum, post) => sum + post.views, 0)
        : 0,
  };
}

export function buildMarkdown({ posts, skipped, range }) {
  const platforms = [...new Set(posts.map((post) => post.platform))];
  const overall = summarize(posts);
  const qualified = posts.filter((post) => post.views >= 100);
  const medianRate = median(qualified.map((post) => post.rate));
  const ranked = [...qualified].sort((a, b) => b.rate - a.rate);
  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-3).reverse();
  const high = qualified.filter((post) => medianRate > 0 && post.rate >= medianRate * 1.8);
  const low = qualified.filter((post) => medianRate > 0 && post.rate <= medianRate * 0.5);

  const platformTable = [
    "| 平台 | 条数 | 曝光 | 互动 | 互动率 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...platforms.map((platform) => {
      const stats = summarize(posts.filter((post) => post.platform === platform));
      return `| ${platform} | ${stats.count} | ${stats.views} | ${stats.engagements} | ${percent(stats.rate)} |`;
    }),
    `| **合计** | ${overall.count} | ${overall.views} | ${overall.engagements} | ${percent(overall.rate)} |`,
  ].join("\n");

  const rankLines = (items) =>
    items.length === 0
      ? `暂无（有效样本不足 100 曝光）`
      : items
          .map(
            (post, index) =>
              `${index + 1}. **${post.title}**（${post.platform}）— ${post.views} 曝光 / ${post.engagements} 互动 / ${percent(post.rate)}`,
          )
          .join("\n");

  const anomalies = [
    ...high.map((post) => `- 高于中位数 1.8 倍：**${post.title}**（${post.platform}，${percent(post.rate)}）`),
    ...low.map((post) => `- 低于中位数一半：**${post.title}**（${post.platform}，${percent(post.rate)}）`),
  ];

  const actions = [];
  if (best.length > 0) {
    actions.push(
      `把《${best[0].title}》拆成 2–3 个变体，下周同一时段再发一次，验证是选题有效还是时间有效。`,
    );
  }
  if (worst.length > 0) {
    actions.push(
      `回看《${worst[0].title}》的封面和前 3 秒：曝光有 ${worst[0].views}，互动率只有 ${percent(worst[0].rate)}，优先改钩子而不是改选题。`,
    );
  }
  if (platforms.length > 1 && ranked.length > 0) {
    const others = platforms.filter((platform) => platform !== best[0].platform);
    actions.push(
      `把表现最好的内容改写成 ${others.join("、")} 平台的尺寸和语气，复用素材而不是重新拍。`,
    );
  }
  if (platforms.length === 1) {
    actions.push("再接一个平台的数据：单平台看不出内容结构问题，只能看出平台问题。");
  }
  if (skipped.length > 0) {
    actions.push(`有 ${skipped.length} 个文件没读进来，先修字段映射，避免周报漏数据。`);
  }
  actions.push("从上面两条异常里各挑一条，写下你判断的原因，下周用一条新内容验证。");

  return `# 内容周报（${range}）

> 共 ${overall.count} 条内容，覆盖 ${platforms.length} 个平台；曝光 ${overall.views}，互动 ${overall.engagements}，整体互动率 ${percent(overall.rate)}。

## 总览

${platformTable}

## 表现最好

${rankLines(best)}

## 需要复盘

${rankLines(worst)}

## 异常提醒

中位数互动率：${percent(medianRate)}（仅统计曝光 ≥ 100 的内容）

${anomalies.length > 0 ? anomalies.join("\n") : "本周没有明显异常。"}

## 下周动作

${actions.map((action) => `- ${action}`).join("\n")}
`;
}

async function main() {
  const configPath = path.resolve(ROOT, process.argv[2] ?? "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const inputDir = path.resolve(ROOT, config.inputDir);
  const outputDir = path.resolve(ROOT, config.outputDir);

  const { posts, skipped } = await loadRows(inputDir, config);

  if (posts.length === 0) {
    console.error(`没有从 ${inputDir} 读到任何内容，请检查 CSV 和 config.json 的字段映射。`);
    process.exit(1);
  }

  const dates = posts.map((post) => post.date).filter(Boolean).sort((a, b) => a - b);
  const range =
    dates.length > 0
      ? `${formatDate(dates[0])} ~ ${formatDate(dates.at(-1))}`
      : "日期缺失";
  const markdown = buildMarkdown({ posts, skipped, range });

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "report.md"), markdown);
  await writeFile(
    path.join(outputDir, "report.json"),
    JSON.stringify(
      {
        range,
        generatedAt: new Date().toISOString(),
        posts: posts.map((post) => ({ ...post, date: formatDate(post.date) })),
        skipped,
      },
      null,
      2,
    ),
  );

  console.log(`已生成 ${path.relative(ROOT, path.join(outputDir, "report.md"))}`);
  console.log(`已生成 ${path.relative(ROOT, path.join(outputDir, "report.json"))}`);
  if (skipped.length > 0) {
    console.log(`跳过 ${skipped.length} 个文件：`);
    for (const item of skipped) console.log(`- ${item.file}: ${item.reason}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
