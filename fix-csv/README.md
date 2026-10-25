# fix-csv

识别 CSV 的编码（UTF-8 / UTF-8 BOM / GBK）并转成 Excel 能正确打开的 UTF-8。

```bash
node fix-csv/fix-csv.mjs data.csv           # 只预览，不动文件
node fix-csv/fix-csv.mjs data.csv --write   # 写入 data.utf8.csv
node fix-csv/fix-csv.mjs ./exports --write  # 整个目录
node fix-csv/fix-csv.mjs data.csv --write --no-bom   # 不写 BOM
```

- **不会覆盖原文件**。输出固定叫 `原名.utf8.csv`，和原文件同目录；已存在时跳过。
- 二进制文件、UTF-16 会被识别并跳过，不会乱转。

**已知局限**：编码识别是启发式的。如果 GBK 字节恰好也符合 UTF-8 规则，会被误判成 UTF-8——比如 GBK 的「一」是 `D2 BB`，按 UTF-8 读会变成 `һ`。遇到这种情况先用编辑器以 GBK 重新打开确认，或用 `iconv -f gbk -t utf-8` 强制转换。

对应教程：[Excel 打开 CSV 全是乱码：先分清 UTF-8、GBK 和 BOM](https://www.genwozuo.com/tutorials/csv-luanma-bianma/)
