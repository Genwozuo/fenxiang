# title-batch

用模板 + 词库批量组合标题，过滤超长、重复和禁用词。

```bash
node title-batch/generate.mjs
```

参数在 `config.json`：数量、长度区间、受众、痛点、结果、格式、关键词、模板句式。
输出 `out/titles.csv`。

随机种子固定（`seed`），同样配置每次结果一致，方便你改一处只对比一处。

对应教程：[30 条标题一次生成](https://www.genwozuo.com/tutorials/piliang-biaoti-muban/)
