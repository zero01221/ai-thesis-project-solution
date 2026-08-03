# 毕业设计 AI 助手 — 重构跟踪文档

> 本文件记录重构计划任务、完成情况与已知缺陷，随重构进度持续更新。
> 状态图例：⬜待办 / 🟦进行中 / ✅完成 / ⚠️有缺陷

## 一、计划任务表

| WP  | 任务                              | 状态 | 备注                                              |
| :-- | :-------------------------------- | :--: | :------------------------------------------------ |
| WP1 | 配置环境变量化 + 模型修正         |  ✅  | ai-config.ts 读 env、.env.local/.env.example      |
| WP2 | 抽取共享类型 src/types/project.ts |  ✅  | 消除 5+ 文件重复 interface                        |
| WP3 | 项目类型注册表统一                |  ✅  | 消除两套 constraints 真相源                       |
| WP4 | 流式工具重构                      |  ✅  | streamCompletion 原语 + 单轮/多轮 + 哨兵错误      |
| WP5 | zod 入参校验                      |  ✅  | 启用已装 zod，8 路由 safeParse                    |
| WP6 | 向导组件拆分                      |  ✅  | 1354 行 → 薄容器 + step 子组件 + hooks            |
| WP7 | 清理死依赖 + 修 README            |  ✅  | grep 确认后删 drizzle/pg/supabase/s3/recharts/rhf |
| WP8 | 维护本跟踪文档                    |  🟦  | 持续更新                                          |
| WP9 | 端到端验证                        |  🟦  | ts-check ✅ build ✅，剩 lint→dev→5 步实测         |

## 二、完成情况

（每完成一个 WP 在此记录产出与验证结果）

### 2026-08-03 修复构建失败（原"待解决问题 1"）

**根因**：重构时路由文件的 import 改为从 `@/lib/project-type-registry` / `@/lib/ai-client` 导入，但目标模块从未导出这些符号，路由文件又残留同名本地定义 → 同一作用域重复声明（Turbopack 语法级错误）；另有 `analyzeProject` 彻底丢失（只有引用无定义）。

**修复内容**：
1. `ai-client.ts`：删除从 stream-utils 重复导入的 `createOpenAIClient`；`generateCacheKey/getCacheItem` 去 private 供模块级函数调用；参数类型、`Response` 构造、`aiRequestWithRetry<Response>` 泛型修正
2. `download-package/route.ts`：删除悬空 import，补 `ProjectTypeInfo` 类型导入，**恢复 `analyzeProject`**（基于 git 2b40edb 旧实现，适配新版 `ProjectAnalysis` 的 services/端口字段），projectType 断言
3. `generate-code-structure/route.ts`：删除悬空 import（`getTypeConstraints`/`ProjectTypeInput`），改用 `ProjectTypeInfo` + 断言
4. `generate-code/route.ts`：删除悬空类型导入，补 `getCodeConstraints` 导入，projectType 断言
5. 5 个路由：`createStreamResponse` 改从 `@/lib/stream-utils` 导入，调用从旧三参数改为新签名 `(client, { scenario, messages })`
6. 其他：`api-validation.ts` zod v4 `errors`→`issues`；`ai-config.ts` validate 去 private；`stream-utils.ts` 修复 `timeoutId` 作用域 bug（真实运行时 bug）；`project-type-registry.ts` 字面量/readonly 类型修正；`detect-project-type` 补 `parseJsonObject` 导入；`GenerateReadmeSchema` 补 `batch` 字段

**验证**：`tsc -p tsconfig.json` 0 错误；`npm run build` 成功（Turbopack 18.4s + tsup）

### 2026-08-03 修复"需求输入解析失败"（需求生成流式回归）

**症状**：步骤 1 输入题目点分析 → 报"AI返回的需求格式无法解析，请重试"。

**根因（两个叠加）**：
1. WP4 流式重构改变了后端语义：`streamCompletion` 每次 yield **累积全文**，而前端 `streamFetch` 仍是旧协议的 `fullText += chunk` 追加拼接 → 文本重复叠加、JSON 损坏
2. 需求场景 `max_tokens: 4096` 不足以输出 8-12 条详细需求（实测截断在 id 8），JSON 不完整且 `parseRequirements` 无截断恢复

**修复**：
1. `graduation-wizard.tsx` `streamFetch`：`fullText += chunk` → `fullText = chunk`（匹配后端累积语义）
2. `ai-config.ts`：requirements / analyzeRequirements 的 max_tokens 4096 → 8192
3. `graduation-wizard.tsx` `parseRequirements`：新增 Strategy 3 截断恢复（对象级正则提取已完整生成的需求条目）

**验证**：tsx 实测 `/api/generate-requirements` 流式调用，289→235 chunk，JSON 完整解析出 9 条需求；截断恢复单测通过（未闭合条目正确跳过）。

## 三、已知缺陷

（重构期间发现的回归与遗留问题记于此，含修复状态）

## 待解决问题

1. ✅ 已解决（2026-08-03）：npm build 构建失败 —— 重构遗留的悬空 import 与本地同名定义冲突（见"完成情况"）。
2. ⚠️ 环境：构建需要 Node ≥ 22.13（pnpm 11 要求），当前全局默认 Node 为 v16.20.2。构建前需 `nvm use 26.0.0`（或 24.18.0）；nvm 已装 26.0.0 / 24.18.0 / 16.20.2。
