/**
 * AI 模型配置文件
 *
 * 修改此文件即可切换模型和API配置，无需修改业务代码
 *
 * 支持所有 OpenAI 兼容接口，包括：
 * - 阿里云百炼（通义千问）
 * - DeepSeek
 * - Kimi（月之暗面）
 * - 豆包（火山引擎）
 * - OpenAI
 */

export const AI_CONFIG = {
  /** API 基础地址 */
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',

  /** API 密钥 */
  apiKey: 'sk-',

  /** 默认模型 */
  model: 'qwen-plus',

  /** 各场景模型配置（可单独指定不同模型） */
  models: {
    /** 需求生成 */
    requirements: 'qwen3-vl-235b-a22b-thinking',
    /** 需求分析 */
    analyzeRequirements: 'qwen3-vl-235b-a22b-thinking',
    /** README 生成 */
    readme: 'qwen3-vl-235b-a22b-thinking',
    /** 设计说明书生成（需要长文本输出，建议用上下文长的模型） */
    designDoc: 'qwen3-vl-235b-a22b-thinking',
    /** 代码文件结构规划（输出量小，用轻量模型即可） */
    codeStructure: 'qwen-plus',
    /** 代码生成（分批生成，每批3-5个文件） */
    code: 'qwen-plus-2025-07-28',
  },

  /** 各场景默认参数 */
  params: {
    requirements: { temperature: 0.7, max_tokens: 4096 },
    analyzeRequirements: { temperature: 0.7, max_tokens: 4096 },
    readme: { temperature: 0.5, max_tokens: 8192 },
    designDoc: { temperature: 0.5, max_tokens: 16384 },
    codeStructure: { temperature: 0.3, max_tokens: 4096 },
    code: { temperature: 0.3, max_tokens: 16384 },
  },

  /** 代码生成分批配置 */
  codeGeneration: {
    /** 每批生成的文件数量（减少每批输出量，避免截断） */
    batchSize: 4,
  },
} as const;

/**
 * 常用模型 baseURL 参考：
 *
 * 1. DeepSeek
 *    baseURL: 'https://api.deepseek.com'
 *    model: 'deepseek-chat'
 *
 * 2. Kimi (Moonshot)
 *    baseURL: 'https://api.moonshot.cn/v1'
 *    model: 'moonshot-v1-128k'
 *
 * 3. OpenAI
 *    baseURL: 'https://api.openai.com/v1'
 *    model: 'gpt-4o'
 *
 * 4. 豆包 (火山引擎)
 *    baseURL: 'https://ark.cn-beijing.volces.com/api/v3'
 *    model: '你的接入点ID'
 *
 * 5. 阿里云百炼（当前配置）
 *    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
 *    model: 'qwen-plus'（或 qwen-turbo / qwen-max）
 */
