# llm-client

一个不依赖 SDK 的 LLM HTTP 客户端：超时、退避重试、429 处理、JSON 校验、成本日志。

```bash
export LLM_BASE_URL="https://api.example.com/v1"
export LLM_API_KEY="sk-..."
export LLM_MODEL="your-model"
node llm-client/example.mjs
```

`client.mjs` 是可 import 的模块，`example.mjs` 是最小用法。
没有配置环境变量时，`example.mjs` 会打印提示并退出，不会发起请求。

对应教程：[一次 429 不该毁掉整批任务](https://www.genwozuo.com/tutorials/ai-api-zhongshi-kehuduan/)
