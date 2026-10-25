import {
  assertShape,
  callLLMWithDeadline,
  extractJson,
  logUsage,
} from "./client.mjs";

const baseUrl = process.env.LLM_BASE_URL;
const apiKey = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;

if (!baseUrl || !apiKey || !model) {
  console.error("请设置 LLM_BASE_URL、LLM_API_KEY 和 LLM_MODEL 环境变量");
  process.exit(1);
}

const result = await callLLMWithDeadline({
  baseUrl,
  apiKey,
  deadlineMs: 120_000,
  maxRetries: 3,
  body: {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "你是一个把步骤写清楚的助手，只输出 JSON。" },
      {
        role: "user",
        content:
          '把“把一条视频适配到三个平台”写成 JSON：{"title": string, "steps": string[], "risk": string}',
      },
    ],
  },
});

logUsage(result.meta, "demo");

const content = result.data.choices?.[0]?.message?.content;
const parsed = assertShape(extractJson(content), {
  title: "string",
  steps: "array",
  risk: "string",
});

console.log(JSON.stringify(parsed, null, 2));
