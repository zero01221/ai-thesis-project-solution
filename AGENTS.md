# 招标信息监控系统 - 项目上下文

## 项目概述

云南省铁塔制造及维修行业招标信息自动采集与推送工具。支持多站点爬取、关键词过滤、去重和钉钉通知。

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI**: shadcn/ui + Tailwind CSS 4
- **HTML解析**: cheerio
- **通知**: 钉钉机器人 Webhook

## 目录结构

```
├── data/                           # 运行时数据（配置、历史记录）
│   ├── config.json                 # 用户配置（站点、关键词、通知）
│   └── history.json                # 去重指纹 + 历史记录
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局
│   │   ├── page.tsx                # 首页（渲染 BiddingDashboard）
│   │   └── api/
│   │       ├── scrape/route.ts     # [POST] 触发采集
│   │       ├── config/route.ts     # [GET/POST] 配置管理
│   │       ├── notify/route.ts     # [POST] 钉钉通知（测试/推送）
│   │       └── history/route.ts    # [GET] 历史记录查询
│   ├── components/
│   │   ├── bidding-dashboard.tsx   # 核心：Dashboard 客户端组件
│   │   └── ui/                    # shadcn/ui 组件
│   └── lib/bidding/
│       ├── types.ts               # 类型定义
│       ├── default-config.ts      # 默认配置（站点、关键词）
│       ├── scraper.ts             # 爬虫引擎 + 站点适配器
│       ├── filter.ts              # 关键词过滤器
│       ├── dedup.ts               # 去重模块（MD5指纹）
│       ├── dingtalk.ts            # 钉钉通知模块
│       └── engine.ts              # 统一调度引擎
```

## 核心模块说明

### 爬虫引擎 (scraper.ts)
- 每个目标网站一个 Adapter 类（CcgpAdapter, YunnanGgzyAdapter 等）
- 支持 HTML 解析（cheerio）和 JSON API 两种模式
- 内置请求间隔（1.5s）防止被封

### 过滤与去重
- `filter.ts`: include/exclude 关键词匹配
- `dedup.ts`: 基于 URL+标题+日期 的 MD5 指纹去重，持久化到 data/history.json

### 钉钉通知 (dingtalk.ts)
- 支持加签验证
- Markdown 格式推送招标信息汇总
- 测试消息功能

## API 接口

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/scrape` | POST | 触发采集，body: `{ siteIds?, daysBack?, skipNotify? }` |
| `/api/config` | GET/POST | 读取/更新配置 |
| `/api/notify` | POST | 钉钉通知，body: `{ action: 'test'|'push', items? }` |
| `/api/history` | GET | 查询历史，query: `?limit=50&offset=0` |

## 包管理

仅使用 pnpm。
