import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = import.meta.dirname;
const DATA_FILE = path.join(ROOT, "data", "covers.json");
const OUTPUT_DIR = path.join(ROOT, "output");
export const WIDTH = 1080;
export const HEIGHT = 1440;

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderLines(text, x, startY, lineHeight) {
  return text
    .split("\n")
    .map((line, index) => {
      const y = startY + index * lineHeight;
      return `<text x="${x}" y="${y}" font-size="96" font-weight="700" fill="#14211d">${escapeXml(line)}</text>`;
    })
    .join("");
}

export function buildSvg({ title, subtitle, badge }, { transparent = false } = {}) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${transparent ? "" : `<rect width="${WIDTH}" height="${HEIGHT}" fill="#faf8f3" />`}
  <rect x="72" y="72" width="${WIDTH - 144}" height="${HEIGHT - 144}" rx="32" fill="#ffffff" fill-opacity="0.92" stroke="#e5e2d8" />

  <rect x="120" y="140" width="240" height="56" rx="28" fill="#009084" />
  <text x="240" y="178" font-size="28" font-weight="600" fill="#ffffff" text-anchor="middle"
    font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif">${escapeXml(badge)}</text>

  <g font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif">
    ${renderLines(title, 120, 380, 128)}
  </g>

  <line x1="120" y1="826" x2="212" y2="826" stroke="#d97706" stroke-width="6" stroke-linecap="round" />

  <text x="120" y="900" font-size="40" fill="#5f6b66"
    font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif">${escapeXml(subtitle)}</text>

  <line x1="120" y1="1120" x2="${WIDTH - 120}" y2="1120" stroke="#e5e2d8" />
  <text x="120" y="1200" font-size="34" fill="#009084"
    font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif">跟我做 · AI 自动化实操</text>
  <text x="${WIDTH - 120}" y="1200" font-size="34" fill="#16201e" text-anchor="end"
    font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif">genwozuo.com</text>
</svg>`;
}

async function renderCover(cover, filename) {
  if (cover.background) {
    const background = sharp(path.resolve(ROOT, cover.background))
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .modulate({ brightness: 0.9 });

    await background
      .composite([{ input: Buffer.from(buildSvg(cover, { transparent: true })), blend: "over" }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(filename);

    return;
  }

  await sharp(Buffer.from(buildSvg(cover)))
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(filename);
}

async function main() {
  const covers = JSON.parse(await readFile(DATA_FILE, "utf8"));

  if (!Array.isArray(covers) || covers.length === 0) {
    throw new Error(`${DATA_FILE} 里没有可渲染的文案`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const [index, cover] of covers.entries()) {
    const filename = path.join(
      OUTPUT_DIR,
      `cover-${String(index + 1).padStart(2, "0")}.jpg`,
    );

    await renderCover(cover, filename);
    console.log(`done: ${filename}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
