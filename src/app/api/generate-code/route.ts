import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, createStreamResponse } from '@/lib/ai-client';
import { GenerateCodeSchema, validateRequest } from '@/lib/api-validation';
import type { FileStructure, ProjectTypeInput } from '@/types/project';

''

export async function POST(request: NextRequest) {
  try {
    const { files, readme, title, batchIndex, totalBatches, projectType } = validateRequest(GenerateCodeSchema, await request.json());

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: '缺少文件清单' }, { status: 400 });
    }

    if (!readme || typeof readme !== 'string' || readme.trim().length === 0) {
      return NextResponse.json({ error: '缺少README文档内容' }, { status: 400 });
    }

    const client = createOpenAIClient();

    // 截取README到合理长度
    const readmeTruncated = readme.length > 6000 ? readme.slice(0, 6000) + '\n...(文档已截断)' : readme;

    // 构建文件清单描述
    const fileList = files.map((f, i) => `${i + 1}. ${f.path} - ${f.description}`).join('\n');

    // 获取代码约束
    const codeConstraints = getCodeConstraints(files, projectType || null);

    // 项目类型描述
    const projectTypeDesc = projectType
      ? `\n## 项目类型信息\n类型：${projectType.label}\n后端：${projectType.backend.tech} (${projectType.backend.language})，端口 ${projectType.backend.port}\n前端：${projectType.frontend.tech} (${projectType.frontend.framework})，端口 ${projectType.frontend.port}\n数据库：${projectType.database}\n结构：${projectType.structureMode}\n`
      : '';

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位顶级全栈开发工程师。你需要根据README.md文档和文件清单，生成指定文件的完整代码。

你的输出必须是一个JSON数组，包含所有指定文件的路径和完整代码内容。

格式如下：
[
  {
    "path": "文件相对路径",
    "content": "文件的完整内容"
  }
]

关键要求：
1. 代码必须完整可运行，不能有省略或占位符（如 "// ... 其他代码"、"/* 省略 */"）
2. 严格遵循README中指定的技术栈和项目类型
3. 代码质量要高，包含必要的注释和错误处理
4. UI相关代码要美观现代
5. 文件之间要保持一致的代码风格和命名规范
6. 类之间的引用关系必须正确
7. 配置文件（package.json、pom.xml、requirements.txt等）必须包含完整的依赖列表，不能省略
8. 入口文件必须完整实现初始化逻辑，不能只有框架
${codeConstraints}

【输出格式要求 - 极其重要】
- 直接输出JSON数组，不要加 \`\`\`json \`\`\` 标记
- 不要在JSON前后添加任何说明文字
- 确保JSON格式完整，数组必须以 ] 结尾
- 每个文件的content必须是完整的代码，不能省略
- 代码中的引号需要正确转义（使用 \\" 表示双引号）
- 代码中的换行使用 \\n 表示`,
      },
      {
        role: 'user' as const,
        content: `请为以下项目生成第 ${batchIndex !== undefined ? batchIndex + 1 : 1}/${totalBatches || 1} 批文件的完整代码。

## 项目名称
${title}
${projectTypeDesc}

## README.md 内容
${readmeTruncated}

## 需要生成的文件清单
${fileList}

请生成上述 ${files.length} 个文件的完整代码，以JSON数组格式输出。
确保每个文件的内容完整，不要省略任何代码。
特别注意：配置文件必须包含完整的依赖列表，入口文件必须包含完整的初始化逻辑。`,
      },
    ];

    return createStreamResponse(client, messages, 'code');
  } catch (error) {
    console.error('Generate code batch error:', error);
    return NextResponse.json({ error: '代码生成失败，请重试' }, { status: 500 });
  }
}
