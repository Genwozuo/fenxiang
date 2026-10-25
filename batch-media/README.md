# batch-media

一条横屏视频转成抖音 / 小红书 / 视频号三种尺寸，并按时间点抽封面。

```bash
npm install          # 需要 ffmpeg
node batch-media/convert.mjs ./input/demo.mp4
node batch-media/extract-covers.mjs ./input/demo.mp4
```

- 尺寸配置在 `copy.json`
- 输出到 `batch-media/output/`
- 找不到 ffmpeg 时先读 `tools.mjs` 里的 `resolveFfmpeg`，它支持 `FFMPEG_PATH` 环境变量
- 需要裁切填满时，把 `convert.mjs` 里的 `mode` 改成 `"crop"`

对应教程：[一条视频，三个平台版本](https://www.genwozuo.com/tutorials/yitiao-shipin-duopingtai-chicun/)
