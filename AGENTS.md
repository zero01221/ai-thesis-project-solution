# 毕业设计 AI 助手 - 项目上下文

## 项目概述

毕业设计 AI 助手是一个基于 Next.js 的全栈 Web 应用，帮助用户从毕业论文题目出发，通过 AI 自动生成需求、README 文档和完整项目代码，并打包下载。

核心流程：论文题目/需求输入 → 需求确认编辑 → README 文档生成 → 代码生成与下载

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4 + @tailwindcss/typography
- **AI SDK**: coze-coding-dev-sdk (LLM 集成)
- **ZIP 打包**: jszip
- **Markdown 渲染**: react-markdown + remark-gfm

## 目录结构

```
├── public/                     # 静态资源
├── scripts/                    # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 根布局
│   │   ├── page.tsx            # 首页（导入 GraduationWizard）
│   │   ├── globals.css         # 全局样式 + Tailwind 配置
│   │   └── api/
│   │       ├── generate-requirements/  # [POST] 根据论文题目生成需求
│   │       ├── analyze-requirements/   # [POST] 分析手动输入的需求
│   │       ├── generate-readme/        # [POST] 生成 README.md
│   │       ├── generate-code/          # [POST] 生成项目代码
│   │       └── download-package/       # [POST] 打包为 ZIP 下载
│   ├── components/
│   │   ├── graduation-wizard.tsx  # 核心：4步向导组件（客户端）
│   │   └── ui/                    # shadcn/ui 组件库
│   ├── hooks/
│   ├── lib/
│   │   └── utils.ts
│   └── server.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心组件说明

### graduation-wizard.tsx

4 步向导式交互组件，管理全部状态和 AI 调用：

- **Step 1 - 需求输入**: 两种模式（智能生成/手动输入），调用 LLM 流式输出
- **Step 2 - 需求确认**: 可编辑/删除/新增需求的列表
- **Step 3 - 生成README**: 调用 LLM 生成 Markdown 文档，实时渲染预览
- **Step 4 - 代码生成**: 调用 LLM 生成多文件代码，文件树预览 + ZIP 下载

### API 路由

所有 AI 接口使用 SSE 流式输出（`text/event-stream`），通过 `coze-coding-dev-sdk` 的 `LLMClient.stream()` 实现：

| 路由 | 方法 | 功能 | 请求体 |
|------|------|------|--------|
| `/api/generate-requirements` | POST | 根据论文题目生成需求 JSON | `{ title }` |
| `/api/analyze-requirements` | POST | 分析手动需求返回结构化 JSON | `{ requirements }` |
| `/api/generate-readme` | POST | 生成 README.md Markdown | `{ title, requirements[] }` |
| `/api/generate-code` | POST | 生成代码文件 JSON 数组 | `{ readme, title }` |
| `/api/download-package` | POST | 返回 ZIP 文件 | `{ files[], title }` |

## 包管理规范

**仅允许使用 pnpm**，严禁 npm 或 yarn。

## 开发规范

- TypeScript strict 模式
- 禁止隐式 any
- 所有 API 路由的 LLM 调用使用 `HeaderUtils.extractForwardHeaders` 转发请求头
- 前端流式读取使用 `fetch` + `body.getReader()`
- 客户端组件使用 `'use client'` 指令

## 常见问题与修复

- **archiver 导入问题**: archiver 是 CJS 模块，在 Next.js ESM 环境下默认导入不兼容，已替换为 jszip
- **Response 构造类型问题**: `Buffer`/`Uint8Array` 不能直接作为 `BodyInit`，需类型断言
- **LLM 返回格式解析**: AI 可能返回带 markdown 代码块的 JSON，`parseRequirements`/`parseCodeFiles` 已做兼容处理
