import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/ai-client';
import { createStreamResponse } from '@/lib/stream-utils';
import { GenerateRequirementsSchema, validateRequest } from '@/lib/api-validation';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { title } = validateRequest(GenerateRequirementsSchema, data);

    const client = createOpenAIClient();

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位资深的毕业设计指导老师，擅长根据论文题目分析并生成详细的项目功能需求。
你的输出必须是纯JSON数组格式，不要包含任何markdown代码块标记或其他文字说明。
每个需求包含 id、name、description 三个字段。
生成6-8条功能需求，每条需求的description应详细说明功能点、交互流程、数据流向等。
注意你指导的是本科大学生，所以使用最简单的方法完成基础的功能即可，数据永远保存在本地数据库，不用考虑性能，安全等企业软件才要考虑的东西。`,
      },
      {
        role: 'user' as const,
        content: `请根据以下毕业论文题目，生成详细的项目功能需求列表。

论文题目：${title.trim()}

请以如下JSON数组格式输出（不要加\`\`\`json\`\`\`标记）：
[
  {
    "id": 1,
    "name": "需求名称",
    "description": "详细的功能描述，包括交互流程、数据处理逻辑、界面元素等"
  }
]

要求：
1. 需求应覆盖完整的项目功能，包括前端交互、后端逻辑、数据管理
2. 每条需求描述不少于50字
3. 需求之间不应有重叠
4. 按重要性和实现顺序排列`,
      },
    ];

    return createStreamResponse(client, { scenario: 'requirements', messages });
  } catch (error) {
    console.error('Generate requirements error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '需求生成失败，请重试' }, { status: 500 });
  }
}
