# cover-batch

用一张 SVG 模板批量生成 1080×1440 的封面图。

```bash
npm install          # 需要 sharp
node cover-batch/render.mjs
```

文案在 `data/covers.json`：`title` 用 `\n` 换行，`subtitle` 一行，`badge` 是左上角标签。
输出到 `cover-batch/output/cover-01.jpg` 起。

配色和版式在 `render.mjs` 顶部的 `buildSvg` 里，改颜色只改那几个色值。

对应教程：[20 张封面，十分钟做完](https://www.genwozuo.com/tutorials/xiaohongshu-pifu-fengmian/)
