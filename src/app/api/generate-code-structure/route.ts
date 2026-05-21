import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, createStreamResponse } from '@/lib/ai-client';

/**
 * 代码生成 - 第1步：生成文件清单
 *
 * 让AI分析项目结构，输出所有需要生成的文件路径和简要说明
 * 输出量小，不会被截断
 */
export async function POST(request: NextRequest) {
  try {
    const { readme, title } = await request.json();

    if (!readme || typeof readme !== 'string' || readme.trim().length === 0) {
      return NextResponse.json({ error: '缺少README文档内容' }, { status: 400 });
    }

    const client = createOpenAIClient();

    // 截取README到合理长度
    const readmeTruncated = readme.length > 8000 ? readme.slice(0, 8000) + '\n...(文档已截断)' : readme;

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位顶级全栈架构师。你需要根据README.md文档的描述，规划完整的项目文件结构。

你的输出必须是一个JSON数组，包含所有项目文件的路径和简要说明。不要输出文件内容，只输出路径和说明。

格式如下：
[
  {
    "path": "文件相对路径",
    "description": "该文件的简要说明（一句话）"
  }
]

关键要求：
1. 列出所有需要生成的文件，包括配置文件、源代码、资源文件等
2. 文件路径必须符合该技术栈的标准目录结构
3. 不要遗漏任何必要的文件
4. 根据项目技术栈决定需要哪些配置文件：
   - Next.js/React：package.json, next.config.js, tsconfig.json 等
   - Vue：package.json, vite.config.ts, tsconfig.json 等
   - Spring Boot/Java：pom.xml, application.yml, Maven目录结构等
   - Python/Flask/Django：requirements.txt, manage.py 等
   - 纯HTML/CSS/JS：index.html, style.css, script.js 等
5. 不要给所有项目都生成Next.js配置文件！

【完整性检查清单 - 必须逐条确认，不可遗漏】
以下类型的文件是项目运行所必需的，必须包含在文件列表中：

A. 入口文件（致命 - 缺少则项目无法启动）
   - React项目：src/index.js 或 src/main.jsx（ReactDOM渲染入口）、src/App.js 或 src/App.jsx（根组件）
   - Vue项目：src/main.js 或 src/main.ts（Vue挂载入口）、src/App.vue（根组件）
   - Next.js项目：src/app/layout.tsx、src/app/page.tsx
   - Spring Boot项目：启动类（如 src/main/java/com/.../Application.java）
   - Python项目：app.py 或 manage.py
   - 纯HTML项目：index.html

B. 配置文件（高优先级）
   - Java/Maven：pom.xml, application.yml/application.properties
   - Node.js：package.json（含正确dependencies和scripts）
   - Python：requirements.txt
   - 前端构建：vite.config.ts / webpack.config.js / next.config.js
   - TypeScript：tsconfig.json

C. 基础设施配置（如果README提到Docker/数据库）
   - docker-compose.yml 中引用的所有配置文件必须存在
   - 如有MySQL：docker/mysql/init.sql（初始化脚本）
   - 如有Nginx：docker/nginx/conf.d/default.conf
   - 如有Redis：不需要额外配置文件，但需要在docker-compose.yml中声明

D. 路由与状态管理
   - 前端项目：router/index.js（路由配置）、stores/index.js（状态管理入口）
   - 后端项目：Controller类必须齐全

E. 公共资源
   - 前端项目：public/index.html（HTML模板，Vue/React webpack项目需要）
   - 前端项目：public/favicon.ico

请仔细对照以上清单，确保文件列表完整。遗漏入口文件将导致项目完全无法启动！

【输出格式要求】
- 直接输出JSON数组，不要加 \`\`\`json \`\`\` 标记
- 不要在JSON前后添加任何说明文字`,
      },
      {
        role: 'user' as const,
        content: `请根据以下README.md文档，列出所有需要生成的项目文件。

## 项目名称
${title}

## README.md 内容
${readmeTruncated}

请列出所有项目文件的路径和简要说明，以JSON数组格式输出。
务必包含入口文件、配置文件、基础设施配置等所有必要文件。`,
      },
    ];

    return createStreamResponse(client, messages, 'codeStructure');
  } catch (error) {
    console.error('Generate code structure error:', error);
    return NextResponse.json({ error: '文件结构生成失败，请重试' }, { status: 500 });
  }
}
