# content-review

把小红书 / 公众号 / 抖音导出的数据 CSV 汇总成一份周报。

```bash
node content-review/review.mjs
```

读 `config.json` 里的 `inputDir`（默认 `sample/`），输出到 `outputDir`（默认 `out/`）。
平台按文件名前缀或列名自动识别，列名映射写在 `config.json` 的 `platforms` 里，改配置就能适配你自己的导出格式。

`sample/` 里有三个平台的样例 CSV，可以直接跑通看效果。

对应教程：[14 条内容，一张周报](https://www.genwozuo.com/tutorials/meizhou-shuju-fupan-csv/)
