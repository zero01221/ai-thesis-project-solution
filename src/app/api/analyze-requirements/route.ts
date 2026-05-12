import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { requirements } = await request.json();

    if (!requirements || typeof requirements !== 'string' || requirements.trim().length === 0) {
      return NextResponse.json({ error: '请输入需求内容' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位资深的毕业设计指导老师，擅长分析和结构化项目需求。
你的输出必须是纯JSON数组格式，不要包含任何markdown代码块标记或其他文字说明。
每个需求包含 id、name、description 三个字段。
你需要将用户的需求进行结构化整理，补充缺失的细节，增加必要的隐含需求，使需求更加完整和规范。`,
      },
      {
        role: 'user' as const,
        content: `请分析以下用户输入的需求，将其结构化并补充完善。

用户需求：
${requirements.trim()}

请以如下JSON数组格式输出（不要加\`\`\`json\`\`\`标记）：
[
  {
    "id": 1,
    "name": "需求名称",
    "description": "详细的功能描述"
  }
]

要求：
1. 将用户模糊的描述细化为明确的功能需求
2. 补充缺失的必要功能（如用户管理、数据验证、异常处理等）
3. 每条需求描述不少于50字，需包含具体的功能点
4. 需求之间不应有重叠
5. 按重要性和实现顺序排列
6. 最终生成8-15条需求`,
      },
    ];

    const stream = client.stream(messages, {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Analyze requirements error:', error);
    return NextResponse.json({ error: '需求分析失败，请重试' }, { status: 500 });
  }
}
