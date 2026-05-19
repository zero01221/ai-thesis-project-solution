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

请列出所有项目文件的路径和简要说明，以JSON数组格式输出。`,
      },
    ];

    return createStreamResponse(client, messages, 'codeStructure');
  } catch (error) {
    console.error('Generate code structure error:', error);
    return NextResponse.json({ error: '文件结构生成失败，请重试' }, { status: 500 });
  }
}
