import OpenAI from 'openai';
import { AI_CONFIG, configManager } from '@/lib/ai-config';
import { createStreamResponse, createOpenAIClient } from '@/lib/stream-utils';

/**
 * 请求缓存键类型
 */
type CacheKey = string;

/**
 * 请求缓存项
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * AI 客户端管理器
 */
export class AIClientManager {
  private client: OpenAI;
  private cache: Map<CacheKey, CacheItem<any>> = new Map();
  private maxCacheSize: number;
  private defaultTTL: number;

  constructor(options: {
    maxCacheSize?: number;
    defaultTTL?: number;
  } = {}) {
    this.client = new OpenAI({
      apiKey: AI_CONFIG.apiKey,
      baseURL: AI_CONFIG.baseURL,
    });

    this.maxCacheSize = options.maxCacheSize || 100;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5分钟
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(scenario: string, messages: string[]): CacheKey {
    const messageHash = messages
      .map(msg => `${msg.role}:${msg.content}`)
      .join('|')
      .substring(0, 100);

    return `${scenario}:${messageHash}`;
  }

  /**
   * 检查缓存是否存在且有效
   */
  private getCacheItem<T>(key: CacheKey): T | null {
    const item = this.cache.get(key);

    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * 设置缓存项
   */
  private setCacheItem<T>(key: CacheKey, data: T, ttl: number = this.defaultTTL): void {
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 创建带缓存的客户端
   */
  get clientInstance(): OpenAI {
    return this.client;
  }

  /**
   * 批量生成缓存键
   */
  private generateBatchCacheKey(scenario: string, rounds: Array<{ messages: string[] }>): CacheKey {
    const roundHashes = rounds.map(round =>
      round.messages
        .map(msg => `${msg.role}:${msg.content}`)
        .join('|')
        .substring(0, 50)
    );

    return `${scenario}:batch:${roundHashes.join('-')}`;
  }
}

/**
 * 全局客户端管理器实例
 */
export const aiClientManager = new AIClientManager();

/**
 * 创建 OpenAI 兼容客户端实例
 */
export function createOpenAIClient(): OpenAI {
  return aiClientManager.clientInstance;
}

/**
 * 创建带缓存的流式响应
 */
export function createCachedStreamResponse(
  options: Parameters<typeof createStreamResponse>[1]
) {
  // 尝试从缓存获取
  const cacheKey = aiClientManager.generateCacheKey(
    options.scenario,
    options.messages.map(m => JSON.stringify(m))
  );

  const cachedData = aiClientManager.getCacheItem(cacheKey);
  if (cachedData) {
    // 如果有缓存，直接返回静态响应
    return new Response(cachedData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    });
  }

  // 如果没有缓存，创建新的流式响应
  const client = createOpenAIClient();
  const response = createStreamResponse(client, options);

  // 注意：流式响应无法缓存，这里只是返回流式响应
  // 实际缓存应该在应用层处理
  response.headers.set('X-Cache', 'MISS');

  return response;
}

/**
 * 带重试的AI请求包装器
 */
export async function aiRequestWithRetry<T>(
  requestFn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as Error;

      // 如果是连接错误或超时，重试
      if (error instanceof Error && (
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT')
      )) {
        onRetry?.(attempt, error);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
      }

      // 其他错误直接抛出
      throw error;
    }
  }

  throw lastError!;
}

/**
 * 带重试的流式请求
 */
export async function createStreamResponseWithRetry(
  options: Parameters<typeof createStreamResponse>[1]
) {
  return aiRequestWithRetry(
    () => createStreamResponse(createOpenAIClient(), options),
    {
      maxRetries: 2,
      retryDelay: 500,
    }
  );
}
