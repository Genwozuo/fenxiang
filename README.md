# 跟我做 · 脚本仓库

[genwozuo.com](https://www.genwozuo.com) 教程里用到的全部脚本，放在这里，可以直接克隆下来跑，不用从网页里复制粘贴。

每一篇教程的产物都能在这里找到对应目录。

## 快速开始

需要 Node 22 或更高版本。

```bash
git clone https://github.com/Genwozuo/fenxiang.git
cd scripts

# 不需要装任何依赖
node tidy/tidy.mjs --help
node fix-csv/fix-csv.mjs --help
```

`cover-batch` 和 `batch-media` 需要额外依赖：`npm install`。

## 这里有什么

| 目录 | 做什么 | 对应教程 | 额外依赖 |
| --- | --- | --- | --- |
| `tidy/` | 按扩展名把文件夹里的文件归类，先预览再移动 | 从 0 开始：装好 Node | 无 |
| `fix-csv/` | 识别 UTF-8 / GBK / BOM，转成 Excel 能正确打开的编码 | Excel 打开 CSV 全是乱码 | 无 |
| `llm-client/` | 带超时、退避重试和 JSON 校验的 LLM HTTP 客户端 | 一次 429 不该毁掉整批任务 | 无 |
| `content-review/` | 把多平台数据 CSV 汇总成一份周报 | 14 条内容一张周报 | 无 |
| `title-batch/` | 模板 + 词库批量生成标题并过滤 | 30 条标题一次生成 | 无 |
| `cover-batch/` | 用 SVG 模板批量生成封面图 | 20 张封面十分钟做完 | `sharp` |
| `batch-media/` | 一条视频转成三平台尺寸，按时间点抽封面 | 一条视频三个平台版本 | `@ffmpeg-installer/ffmpeg` |

## 默认不动你的文件

会改动磁盘的脚本，默认都只**预览**：打印将要进行的操作，不落盘。要真的执行必须显式加参数：

```bash
node tidy/tidy.mjs ~/Downloads           # 只预览
node tidy/tidy.mjs ~/Downloads --move    # 真的移动

node fix-csv/fix-csv.mjs data.csv        # 只预览
node fix-csv/fix-csv.mjs data.csv --write  # 真的写入
```

## 跑一遍自检

```bash
node test/smoke.mjs
```

它会在临时目录里造样例、跑 `tidy` 和 `fix-csv`、校验结果，不会碰你的真实文件。

## 许可

MIT。随便用、改、商用，保留版权声明即可。
