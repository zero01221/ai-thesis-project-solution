# 毕业设计 AI 助手 — 重构跟踪文档

> 本文件记录重构计划任务、完成情况与已知缺陷，随重构进度持续更新。
> 状态图例：⬜待办 / 🟦进行中 / ✅完成 / ⚠️有缺陷

## 一、计划任务表

| WP | 任务 | 状态 | 备注 |
|:--|:--|:--:|:--|
| WP1 | 配置环境变量化 + 模型修正 | ⬜ | ai-config.ts 读 env、.env.local/.env.example |
| WP2 | 抽取共享类型 src/types/project.ts | ⬜ | 消除 5+ 文件重复 interface |
| WP3 | 项目类型注册表统一 | ⬜ | 消除两套 constraints 真相源 |
| WP4 | 流式工具重构 | ⬜ | streamCompletion 原语 + 单轮/多轮 + 哨兵错误 |
| WP5 | zod 入参校验 | ⬜ | 启用已装 zod，8 路由 safeParse |
| WP6 | 向导组件拆分 | ⬜ | 1354 行 → 薄容器 + step 子组件 + hooks |
| WP7 | 清理死依赖 + 修 README | ⬜ | grep 确认后删 drizzle/pg/supabase/s3/recharts/rhf |
| WP8 | 维护本跟踪文档 | 🟦 | 持续更新 |
| WP9 | 端到端验证 | ⬜ | ts-check→lint→build→dev→5 步实测 |

## 二、完成情况

（每完成一个 WP 在此记录产出与验证结果）

## 三、已知缺陷

（重构期间发现的回归与遗留问题记于此，含修复状态）
