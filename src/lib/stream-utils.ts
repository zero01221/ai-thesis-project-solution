/**
 * 流式工具重构 - 统一流式响应处理
 *
 * 统一管理单轮/多轮流式响应、错误处理和哨兵机制
 */

import OpenAI from 'openai';
import { AI_CONFIG } from '@/lib/ai-config';
import { ProjectTypeInfo } from '@/types/project';

/**
 * 流式响应类型
 */
export type StreamResponse = {
  content: string;
  done: boolean;
  error?: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
    timestamp: number;
  };
};

/**
 * 流式请求选项
 */
export type StreamOptions = {
  scenario: keyof typeof AI_CONFIG.models;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  projectType?: ProjectTypeInfo;
  maxRetries?: number;
  timeout?: number;
  totalTokens?: number;
  onProgress?: (progress: StreamResponse['progress']) => void;
  checkpointInterval?: number;
};

/**
 * 哨兵错误标记
 */
export const AI_ERROR_MARKER = '[AI_ERROR]';

/**
 * 创建 OpenAI 兼容客户端
 */
export function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: AI_CONFIG.apiKey,
    baseURL: AI_CONFIG.baseURL,
  });
}

/**
 * 流式响应处理器 - 生成器模式（带进度跟踪）
 */
export async function* streamCompletion(
  client: OpenAI,
  options: StreamOptions
): AsyncGenerator<StreamResponse, void, unknown> {
  const {
    scenario,
    messages,
    projectType,
    maxRetries = 3,
    timeout = 30000,
    totalTokens,
    onProgress,
    checkpointInterval = 10000
  } = options;

  let retryCount = 0;
  let accumulatedContent = '';
  let lastCheckpoint = Date.now();
  let checkpointId = 0;
  let tokenCount = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  while (retryCount < maxRetries) {
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);

      // 发送进度信息
      onProgress?.({
        current: 0,
        total: totalTokens || 1000,
        percentage: 0,
        timestamp: Date.now()
      });

      const stream = await client.chat.completions.create(
        {
          model: AI_CONFIG.models[scenario],
          messages,
          stream: true,
          ...AI_CONFIG.params[scenario],
        },
        { signal: controller.signal }
      );

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          accumulatedContent += content;
          tokenCount += content.length;

          // 定期检查点
          const now = Date.now();
          if (now - lastCheckpoint > checkpointInterval) {
            saveCheckpoint(checkpointId++, accumulatedContent, tokenCount);
            lastCheckpoint = now;
          }

          // 发送进度更新
          if (totalTokens) {
            const percentage = Math.min(100, (tokenCount / totalTokens) * 100);
            onProgress?.({
              current: tokenCount,
              total: totalTokens,
              percentage,
              timestamp: now
            });
          }

          yield {
            content: accumulatedContent,
            done: false,
            progress: totalTokens ? {
              current: tokenCount,
              total: totalTokens,
              percentage: Math.min(100, (tokenCount / totalTokens) * 100),
              timestamp: now
            } : undefined
          };
        }
      }

      clearTimeout(timeoutId);

      // 发送最终进度
      onProgress?.({
        current: tokenCount,
        total: totalTokens || tokenCount,
        percentage: totalTokens ? 100 : 100,
        timestamp: Date.now()
      });

      yield {
        content: accumulatedContent,
        done: true,
        progress: totalTokens ? {
          current: tokenCount,
          total: totalTokens,
          percentage: 100,
          timestamp: Date.now()
        } : undefined
      };
      return;
    } catch (error) {
      clearTimeout(timeoutId);

      // 检查是否是超时或连接中断
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'))) {
        retryCount++;
        continue;
      }

      // 检查是否是AI错误
      if (accumulatedContent.includes(AI_ERROR_MARKER)) {
        const errorMatch = accumulatedContent.match(new RegExp(`${AI_ERROR_MARKER}\\s*(.*)`));
        const aiError = errorMatch ? errorMatch[1].trim() : 'AI调用失败';

        yield {
          content: accumulatedContent.replace(new RegExp(`\\n?${AI_ERROR_MARKER}.*`), '').trim(),
          done: true,
          error: aiError,
        };
        return;
      }

      // 其他错误
      throw error;
    }
  }

  throw new Error(`流式请求失败，已重试 ${maxRetries} 次`);
}

/**
 * 检查点管理
 */
class CheckpointManager {
  private checkpoints: Map<string, { content: string; timestamp: number; tokens: number }> = new Map();

  save(checkpointId: string, content: string, tokenCount: number): void {
    this.checkpoints.set(checkpointId, {
      content,
      timestamp: Date.now(),
      tokens: tokenCount
    });

    // 限制检查点数量
    if (this.checkpoints.size > 10) {
      const oldestKey = this.checkpoints.keys().next().value;
      if (oldestKey !== undefined) {
        this.checkpoints.delete(oldestKey);
      }
    }
  }

  restore(checkpointId: string): { content: string; tokens: number } | null {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint && Date.now() - checkpoint.timestamp < 5 * 60 * 1000) { // 5分钟内有效
      return { content: checkpoint.content, tokens: checkpoint.tokens };
    }
    return null;
  }

  clear(): void {
    this.checkpoints.clear();
  }
}

const checkpointManager = new CheckpointManager();

/**
 * 保存检查点
 */
function saveCheckpoint(id: number, content: string, tokens: number): void {
  checkpointManager.save(`checkpoint-${id}`, content, tokens);
}

/**
 * 创建 SSE 流式响应
 */
export function createStreamResponse(
  client: OpenAI,
  options: StreamOptions
): Response {
  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of streamCompletion(client, options)) {
          if (chunk.error) {
            // 发送错误信息
            controller.enqueue(encoder.encode(`\n\n${AI_ERROR_MARKER} ${chunk.error}`));
            controller.close();
            return;
          }

          if (chunk.content) {
            controller.enqueue(encoder.encode(chunk.content));
          }

          // 发送进度信息
          if (chunk.progress) {
            controller.enqueue(encoder.encode(`\n\n[PROGRESS:${chunk.progress.current},${chunk.progress.total},${chunk.progress.percentage.toFixed(1)}]`));
          }

          if (chunk.done) {
            controller.close();
            return;
          }
        }
      } catch (error) {
        // 处理流式错误
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('AI stream error:', errorMsg);

        try {
          controller.enqueue(encoder.encode(`\n\n${AI_ERROR_MARKER} ${errorMsg}`));
          controller.close();
        } catch {
          controller.error(error);
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

/**
 * 多轮对话流式处理器（带进度跟踪）
 */
export async function* multiRoundStream(
  client: OpenAI,
  rounds: Array<{
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    scenario: keyof typeof AI_CONFIG.models;
  }>,
  options: Omit<StreamOptions, 'messages' | 'scenario'> = {}
): AsyncGenerator<StreamResponse, void, unknown> {
  let accumulatedContent = '';
  let totalTokens = 0;

  for (const [index, round] of rounds.entries()) {
    const roundOptions: StreamOptions = {
      ...options,
      ...round,
      totalTokens: options.totalTokens ? (options.totalTokens / rounds.length) : undefined,
    };

    const stream = streamCompletion(client, roundOptions);

    for await (const chunk of stream) {
      if (chunk.error) {
        yield {
          content: accumulatedContent,
          done: true,
          error: chunk.error,
        };
        return;
      }

      accumulatedContent += chunk.content;
      totalTokens += chunk.progress?.current || 0;

      yield {
        content: accumulatedContent,
        done: false,
        progress: chunk.progress ? {
          current: totalTokens,
          total: options.totalTokens || totalTokens,
          percentage: options.totalTokens ? (totalTokens / options.totalTokens) * 100 : 100,
          timestamp: Date.now()
        } : undefined
      };
    }
  }

  yield {
    content: accumulatedContent,
    done: true,
    progress: options.totalTokens ? {
      current: totalTokens,
      total: options.totalTokens,
      percentage: 100,
      timestamp: Date.now()
    } : undefined
  };
}

/**
 * 简单的流式请求包装器（兼容旧接口）
 */
export async function simpleStreamRequest(
  client: OpenAI,
  options: StreamOptions
): Promise<string> {
  let result = '';

  for await (const chunk of streamCompletion(client, options)) {
    if (chunk.error) {
      throw new Error(chunk.error);
    }
    result = chunk.content;
  }

  return result;
}

/**
 * 错误处理工具
 */
export function handleStreamError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes(AI_ERROR_MARKER)) {
      const match = error.message.match(new RegExp(`${AI_ERROR_MARKER}\\s*(.*)`));
      return match ? match[1] : 'AI调用失败';
    }
    return error.message;
  }
  return String(error);
}

/**
 * 检查点恢复功能
 */
export function resumeStreamFromCheckpoint(
  client: OpenAI,
  options: StreamOptions,
  checkpointId: string
): Response {
  const checkpoint = checkpointManager.restore(checkpointId);

  if (!checkpoint) {
    // 如果没有检查点，从头开始
    return createStreamResponse(client, options);
  }

  // 从检查点恢复
  const restoredOptions = {
    ...options,
    messages: [
      ...options.messages,
      {
        role: 'assistant' as const,
        content: checkpoint.content
      }
    ]
  };

  return createStreamResponse(client, restoredOptions);
}

/**
 * 清理所有检查点
 */
export function clearAllCheckpoints(): void {
  checkpointManager.clear();
}