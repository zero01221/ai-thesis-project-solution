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
  apiKey: 'sk-6c80654470df4425a904a1c2ba191628',

  /** 默认模型 */
  model: 'qwen-plus',

  /** 各场景模型配置（可单独指定不同模型） */
  models: {
    /** 需求生成 */
    requirements: 'qwen-plus',
    /** 需求分析 */
    analyzeRequirements: 'qwen-plus',
    /** README 生成 */
    readme: 'qwen-plus',
    /** 设计说明书生成（需要长文本输出，建议用上下文长的模型） */
    designDoc: 'qwen-plus',
    /** 代码生成 */
    code: 'qwen-plus',
  },

  /** 各场景默认参数 */
  params: {
    requirements: { temperature: 0.7, max_tokens: 4096 },
    analyzeRequirements: { temperature: 0.7, max_tokens: 4096 },
    readme: { temperature: 0.5, max_tokens: 8192 },
    designDoc: { temperature: 0.5, max_tokens: 16384 },
    code: { temperature: 0.3, max_tokens: 8192 },
  },
} as const;

/**
 * 常用模型 baseURL 参考：
 *
 * | 平台         | baseURL                                              | model 值        |
 * |-------------|------------------------------------------------------|-----------------|
 * | 阿里云百炼    | https://dashscope.aliyuncs.com/compatible-mode/v1    | qwen-plus       |
 * | DeepSeek    | https://api.deepseek.com                             | deepseek-chat   |
 * | Kimi        | https://api.moonshot.cn/v1                           | moonshot-v1-128k|
 * | 豆包(火山引擎) | https://ark.cn-beijing.volces.com/api/v3             | 你的接入点ID     |
 * | OpenAI      | https://api.openai.com/v1                            | gpt-4o          |
 */
