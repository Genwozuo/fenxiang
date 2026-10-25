# tidy

按扩展名把文件夹里的文件归类：图片、文档、视频、音频、压缩包、其他。

```bash
node tidy/tidy.mjs ~/Downloads          # 只预览，不动文件
node tidy/tidy.mjs ~/Downloads --move   # 真的移动
```

- 分类表在文件顶部，想加「电子书」「安装包」改一行就行。
- 不删除任何文件；遇到同名文件自动加 `-1`、`-2` 后缀。
- 不处理子文件夹里的内容。
- 第一次跑请在练习目录里试，别直接对着桌面或下载目录。

对应教程：[从 0 开始：装好 Node，跑通第一个自动整理文件的脚本](https://www.genwozuo.com/tutorials/cong-0-kaishi-node/)
