# check-media

检查 `ffmpeg` 和 `ffprobe` 是否在 PATH 里、常见安装目录有没有文件，并按 Windows / macOS / Linux 给出下一步。

```bash
node check-media/check-ffmpeg.mjs
```

不装任何依赖。输出会告诉你：找到了没有、在哪、版本是多少；没找到时列出常见安装位置并给对应系统的修复顺序。

对应教程：[ffmpeg 提示「不是内部或外部命令」：先查 PATH，再谈重装](https://www.genwozuo.com/tutorials/ffmpeg-path-baocuo/)
