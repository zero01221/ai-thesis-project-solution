/**
 * API 入参校验 - 使用 Zod 进行类型安全的参数验证
 */

import { z } from 'zod';

/**
 * 通用 API 响应类型
 */
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

/**
 * 生成需求 API 参数校验
 */
export const GenerateRequirementsSchema = z.object({
  title: z.string().min(1, '请输入论文题目').max(200, '题目过长'),
});

/**
 * 分析需求 API 参数校验
 */
export const AnalyzeRequirementsSchema = z.object({
  requirements: z.string().min(1, '请输入需求描述').max(5000, '需求描述过长'),
});

/**
 * 生成 README API 参数校验
 */
export const GenerateReadmeSchema = z.object({
  title: z.string().min(1, '请输入项目标题').max(200, '标题过长'),
  requirements: z.array(
    z.object({
      id: z.number(),
      name: z.string().min(1, '需求名称不能为空'),
      description: z.string().min(1, '需求描述不能为空'),
    })
  ),
});

/**
 * 生成设计文档 API 参数校验
 */
export const GenerateDesignDocSchema = z.object({
  title: z.string().min(1, '请输入项目标题').max(200, '标题过长'),
  requirements: z.array(
    z.object({
      id: z.number(),
      name: z.string().min(1, '需求名称不能为空'),
      description: z.string().min(1, '需求描述不能为空'),
    })
  ),
  readme: z.string().min(1, '请提供 README 内容'),
});

/**
 * 生成代码结构 API 参数校验
 */
export const GenerateCodeStructureSchema = z.object({
  readme: z.string().min(1, '请提供 README 内容'),
  title: z.string().min(1, '请输入项目标题').max(200, '标题过长'),
  projectType: z.object({
    type: z.string().optional(),
    label: z.string().optional(),
    backend: z.object({
      tech: z.string().optional(),
      language: z.string().optional(),
      port: z.number().optional(),
    }).optional(),
    frontend: z.object({
      tech: z.string().optional(),
      framework: z.string().optional(),
      buildTool: z.string().optional(),
      port: z.number().optional(),
    }).optional(),
    needsDatabase: z.boolean().optional(),
    database: z.string().optional(),
    needsCache: z.boolean().optional(),
    structureMode: z.string().optional(),
    packageManager: z.string().optional(),
    keyDependencies: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * 生成代码 API 参数校验
 */
export const GenerateCodeSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1, '文件路径不能为空'),
      description: z.string().min(1, '文件描述不能为空'),
    })
  ),
  readme: z.string().min(1, '请提供 README 内容'),
  title: z.string().min(1, '请输入项目标题').max(200, '标题过长'),
  batchIndex: z.number().optional(),
  totalBatches: z.number().optional(),
  projectType: z.object({
    type: z.string().optional(),
    label: z.string().optional(),
    backend: z.object({
      tech: z.string().optional(),
      language: z.string().optional(),
      port: z.number().optional(),
    }).optional(),
    frontend: z.object({
      tech: z.string().optional(),
      framework: z.string().optional(),
      buildTool: z.string().optional(),
      port: z.number().optional(),
    }).optional(),
    needsDatabase: z.boolean().optional(),
    database: z.string().optional(),
    needsCache: z.boolean().optional(),
    structureMode: z.string().optional(),
    packageManager: z.string().optional(),
    keyDependencies: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * 下载包 API 参数校验
 */
export const DownloadPackageSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1, '文件路径不能为空'),
      content: z.string().min(1, '文件内容不能为空'),
    })
  ),
  title: z.string().min(1, '请输入项目标题').max(200, '标题过长'),
  designDoc: z.string().optional(),
  readme: z.string().optional(),
  projectType: z.object({
    type: z.string().optional(),
    label: z.string().optional(),
    backend: z.object({
      tech: z.string().optional(),
      language: z.string().optional(),
      port: z.number().optional(),
    }).optional(),
    frontend: z.object({
      tech: z.string().optional(),
      framework: z.string().optional(),
      buildTool: z.string().optional(),
      port: z.number().optional(),
    }).optional(),
    needsDatabase: z.boolean().optional(),
    database: z.string().optional(),
    needsCache: z.boolean().optional(),
    structureMode: z.string().optional(),
    packageManager: z.string().optional(),
    keyDependencies: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * 检测项目类型 API 参数校验
 */
export const DetectProjectTypeSchema = z.object({
  readme: z.string().min(1, '请提供 README 内容'),
  title: z.string().min(1, '请输入项目标题').max(200, '标题过长'),
  requirements: z.array(
    z.object({
      id: z.number(),
      name: z.string().min(1, '需求名称不能为空'),
      description: z.string().min(1, '需求描述不能为空'),
    })
  ),
});

/**
 * API 请求日志记录器
 */
class ApiLogger {
  private logs: Array<{
    timestamp: number;
    method: string;
    url: string;
    params: unknown;
    validation: boolean;
    duration: number;
    error?: string;
    userId?: string;
    ip?: string;
  }> = [];

  private maxLogs = 1000;

  logRequest(params: {
    method: string;
    url: string;
    params: unknown;
    validation: boolean;
    duration: number;
    error?: string;
    userId?: string;
    ip?: string;
  }): void {
    this.logs.push({
      timestamp: Date.now(),
      ...params,
    });

    // 保持日志数量限制
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getLogs(): Array<{
    timestamp: number;
    method: string;
    url: string;
    params: unknown;
    validation: boolean;
    duration: number;
    error?: string;
    userId?: string;
    ip?: string;
  }> {
    return [...this.logs];
  }

  getStats(): {
    totalRequests: number;
    successRate: number;
    averageDuration: number;
    errorRate: number;
  } {
    const total = this.logs.length;
    const successful = this.logs.filter(log => !log.error).length;
    const errorRate = total > 0 ? (this.logs.filter(log => log.error).length / total) * 100 : 0;
    const averageDuration = total > 0
      ? this.logs.reduce((sum, log) => sum + log.duration, 0) / total
      : 0;

    return {
      totalRequests: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageDuration,
      errorRate,
    };
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const apiLogger = new ApiLogger();

/**
 * 通用参数校验函数（带日志记录）
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  options: {
    logRequest?: boolean;
    url?: string;
    method?: string;
  } = {}
): z.infer<T> {
  const startTime = Date.now();
  let validatedData: z.infer<T>;

  try {
    const result = schema.safeParse(data);
    if (!result.success) {
      const errorMessages = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      const error = new Error(`参数校验失败: ${errorMessages}`);

      // 记录校验失败日志
      if (options.logRequest) {
        apiLogger.logRequest({
          method: options.method || 'POST',
          url: options.url || '/api',
          params: data,
          validation: false,
          duration: Date.now() - startTime,
          error: error.message,
        });
      }

      throw error;
    }

    validatedData = result.data;

    // 记录成功校验日志
    if (options.logRequest) {
      apiLogger.logRequest({
        method: options.method || 'POST',
        url: options.url || '/api',
        params: data,
        validation: true,
        duration: Date.now() - startTime,
      });
    }

    return validatedData;
  } catch (error) {
    throw error;
  }
}

/**
 * API 路由参数校验中间件（增强版）
 */
export function withValidation<T extends z.ZodTypeAny>(
  schema: T,
  handler: (req: Request, validatedData: z.infer<T>) => Promise<Response>,
  options: {
    logValidation?: boolean;
    url?: string;
  } = {}
) {
  return async (req: Request) => {
    const startTime = Date.now();
    const url = options.url || new URL(req.url).pathname;
    const method = req.method;

    try {
      const data = await req.json();
      const validatedData = validateRequest(schema, data, {
        logRequest: options.logValidation,
        url,
        method,
      });

      const response = await handler(req, validatedData);

      // 记录成功请求日志
      if (options.logValidation) {
        apiLogger.logRequest({
          method,
          url,
          params: data,
          validation: true,
          duration: Date.now() - startTime,
        });
      }

      return response;
    } catch (error) {
      // 记录错误日志
      if (options.logValidation) {
        apiLogger.logRequest({
          method,
          url,
          params: await req.json().catch(() => ({})),
          validation: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : '参数校验失败',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

/**
 * 性能监控中间件
 */
export function withPerformanceMonitoring<T extends z.ZodTypeAny>(
  schema: T,
  handler: (req: Request, validatedData: z.infer<T>) => Promise<Response>
) {
  return async (req: Request) => {
    const startTime = Date.now();
    const method = req.method;
    const url = new URL(req.url).pathname;

    try {
      const data = await req.json();
      const validatedData = validateRequest(schema, data);

      // 执行处理器
      const response = await handler(req, validatedData);

      // 添加性能头
      const duration = Date.now() - startTime;
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-Response-Time', `${duration}ms`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // 记录性能数据
      console.log(`${method} ${url} - ${duration}ms - ${error instanceof Error ? error.message : 'Unknown error'}`);

      throw error;
    }
  };
}

/**
 * 获取API统计信息
 */
export function getApiStats() {
  return apiLogger.getStats();
}

/**
 * 获取最近的API日志
 */
export function getRecentApiLogs(limit = 50) {
  return apiLogger.getLogs().slice(-limit);
}