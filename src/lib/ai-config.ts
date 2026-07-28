/**
 * AI 模型配置文件
 *
 * 所有敏感配置通过环境变量读取，不再硬编码。
 *
 * 环境变量（见 .env.local / .env.example）：
 *  - DASHSCOPE_API_KEY   : API 密钥（必需）
 *  - AI_BASE_URL         : API 基础地址（默认阿里云百炼 OpenAI 兼容模式）
 *  - AI_DEFAULT_MODEL    : 默认模型
 *
 * 支持所有 OpenAI 兼容接口：阿里云百炼、DeepSeek、Kimi、豆包、OpenAI 等。
 */

/**
 * 流式错误哨兵：服务端在流出错时以此标记附加到流末尾，
 * 前端据此识别错误（见 src/lib/stream-fetch.ts）。
 */
export const AI_ERROR_MARKER = '[AI_ERROR]';

/**
 * 各场景模型配置（可单独指定不同模型）。
 * 当前默认走阿里云百炼兼容模式，模型 id 均为百炼可用模型。
 */
export const SCENARIO_MODELS = {
  /** 需求生成（结构化 JSON，轻量快速） */
  requirements: 'qwen3.7-flash',
  /** 需求分析 */
  analyzeRequirements: 'qwen3.7-flash',
  /** README 生成（Markdown 长文，均衡） */
  readme: 'qwen3.7-plus',
  /** 设计说明书生成（2 万字长文，需最强长上下文） */
  designDoc: 'qwen3.7-max-2026-06-08',
  /** 代码文件结构规划（小 JSON 文件清单，轻量） */
  codeStructure: 'qwen3.7-flash',
  /** 代码生成（代码专精模型） */
  code: 'kimi-k2.7-code',
} as const;

/** AI 场景标识 */
export type Scenario = keyof typeof SCENARIO_MODELS;

/**
 * 配置变更事件
 */
export type ConfigChangeEvent = {
  type: 'update' | 'validate' | 'error';
  key: string;
  value: unknown;
  timestamp: number;
};

/**
 * 配置热重载管理器
 */
export class ConfigManager {
  private config: typeof AI_CONFIG;
  private listeners: Array<(event: ConfigChangeEvent) => void> = [];
  private pollInterval: number;
  private timer?: NodeJS.Timeout;

  constructor(pollInterval = 30000) {
    this.pollInterval = pollInterval;
    this.config = this.createConfig();
    this.startPolling();
  }

  /**
   * 创建配置对象
   */
  private createConfig(): typeof AI_CONFIG {
    return {
      baseURL: process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: process.env.DASHSCOPE_API_KEY || '',
      model: process.env.AI_DEFAULT_MODEL || 'qwen3.7-plus',
      models: SCENARIO_MODELS,
      params: {
        requirements: { temperature: 0.7, max_tokens: 4096 },
        analyzeRequirements: { temperature: 0.7, max_tokens: 4096 },
        readme: { temperature: 0.5, max_tokens: 8192 },
        designDoc: { temperature: 0.5, max_tokens: 16384 },
        codeStructure: { temperature: 0.3, max_tokens: 4096 },
        code: { temperature: 0.3, max_tokens: 16384 },
      } satisfies Record<Scenario, { temperature: number; max_tokens: number }>,
      codeGeneration: {
        batchSize: 4,
      },
      validate: () => this.validate(),
    };
  }

  /**
   * 验证配置
   */
  private validate(): boolean {
    try {
      // 验证API密钥
      if (!this.config.apiKey || this.config.apiKey.length < 10) {
        this.emitEvent({
          type: 'error',
          key: 'apiKey',
          value: this.config.apiKey,
          timestamp: Date.now(),
        });
        return false;
      }

      // 验证baseURL
      if (!this.config.baseURL || !this.config.baseURL.startsWith('http')) {
        this.emitEvent({
          type: 'error',
          key: 'baseURL',
          value: this.config.baseURL,
          timestamp: Date.now(),
        });
        return false;
      }

      // 验证模型
      if (!this.config.model) {
        this.emitEvent({
          type: 'error',
          key: 'model',
          value: this.config.model,
          timestamp: Date.now(),
        });
        return false;
      }

      // 验证场景模型
      for (const scenario of Object.keys(this.config.params) as Scenario[]) {
        const param = this.config.params[scenario];
        if (param.temperature < 0 || param.temperature > 2) {
          this.emitEvent({
            type: 'error',
            key: `params.${scenario}.temperature`,
            value: param.temperature,
            timestamp: Date.now(),
          });
          return false;
        }
        if (param.max_tokens < 100 || param.max_tokens > 100000) {
          this.emitEvent({
            type: 'error',
            key: `params.${scenario}.max_tokens`,
            value: param.max_tokens,
            timestamp: Date.now(),
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      this.emitEvent({
        type: 'error',
        key: 'validation',
        value: error,
        timestamp: Date.now(),
      });
      return false;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): typeof AI_CONFIG {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<typeof AI_CONFIG>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    if (this.validate()) {
      this.emitEvent({
        type: 'update',
        key: 'config',
        value: this.config,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: (event: ConfigChangeEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  removeListener(listener: (event: ConfigChangeEvent) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * 触发配置变更事件
   */
  private emitEvent(event: ConfigChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Config event listener error:', error);
      }
    });
  }

  /**
   * 开始轮询配置变更
   */
  private startPolling(): void {
    this.timer = setInterval(() => {
      const newConfig = this.createConfig();

      // 检查配置是否发生变化
      const hasChanged =
        newConfig.apiKey !== this.config.apiKey ||
        newConfig.baseURL !== this.config.baseURL ||
        newConfig.model !== this.config.model;

      if (hasChanged) {
        this.config = newConfig;
        this.emitEvent({
          type: 'update',
          key: 'environment',
          value: this.config,
          timestamp: Date.now(),
        });
      }
    }, this.pollInterval);
  }

  /**
   * 停止轮询
   */
  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

/**
 * 全局配置管理器实例
 */
export const configManager = new ConfigManager();

/**
 * 兼容性配置对象
 */
export const AI_CONFIG = {
  /** API 基础地址 */
  get baseURL(): string {
    return configManager.getConfig().baseURL;
  },
  /** API 密钥（从环境变量读取） */
  get apiKey(): string {
    return configManager.getConfig().apiKey;
  },
  /** 默认模型 */
  get model(): string {
    return configManager.getConfig().model;
  },
  /** 各场景模型配置 */
  get models(): typeof SCENARIO_MODELS {
    return configManager.getConfig().models;
  },
  /** 各场景默认参数 */
  get params(): Record<Scenario, { temperature: number; max_tokens: number }> {
    return configManager.getConfig().params;
  },
  /** 代码生成分批配置 */
  get codeGeneration(): { batchSize: number } {
    return configManager.getConfig().codeGeneration;
  },
  /** 配置验证 */
  validate: () => configManager.validate(),
};

// 初始化时验证配置
AI_CONFIG.validate();

/**
 * 常用模型 baseURL 参考：
 *
 * 1. 阿里云百炼（当前默认）
 *    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
 *    model: 'qwen-plus'（或 qwen-turbo / qwen-max / qwen3.7-* / kimi-k2.7-code 等）
 *
 * 2. DeepSeek
 *    baseURL: 'https://api.deepseek.com'
 *    model: 'deepseek-chat'
 *
 * 3. Kimi (Moonshot)
 *    baseURL: 'https://api.moonshot.cn/v1'
 *    model: 'moonshot-v1-128k'
 *
 * 4. OpenAI
 *    baseURL: 'https://api.openai.com/v1'
 *    model: 'gpt-4o'
 *
 * 5. 豆包 (火山引擎)
 *    baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
 *    model: '你的接入点ID'
 */
