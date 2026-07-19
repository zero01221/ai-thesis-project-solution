import OpenAI from 'openai';
import { AI_CONFIG } from '@/lib/ai-config';

/**
 * 创建 OpenAI 兼容客户端实例
 */
export function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: AI_CONFIG.apiKey,
    baseURL: AI_CONFIG.baseURL,
  });
}

/**
 * 创建流式 ReadableStream（SSE 格式），用于前端流式读取
 */
export function createStreamResponse(
  client: OpenAI,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  scenario: keyof typeof AI_CONFIG.models,
): Response {
  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const stream = await client.chat.completions.create({
          model: AI_CONFIG.models[scenario],
          messages,
          stream: true,
          ...AI_CONFIG.params[scenario],
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (error) {
        // ERR_INVALID_STATE: 客户端提前断开连接（如超时），属于正常情况
        if (error instanceof Error && error.message.includes('ERR_INVALID_STATE')) {
          try { controller.close(); } catch { /* already closed */ }
        } else {
          // Try to send error info to client as text before closing
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`AI stream error (${scenario}):`, errorMsg);
          try {
            controller.enqueue(encoder.encode(`\n\n[AI_ERROR] ${errorMsg}`));
            controller.close();
          } catch {
            try { controller.error(error); } catch { /* already closed */ }
          }
        }
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
}
