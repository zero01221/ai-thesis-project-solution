/**
 * AI 输出 JSON 的清理与解析工具（服务端 / 客户端通用）
 *
 * 大模型常在 JSON 外包裹 ```json 代码块标记或附加说明文字，
 * 这里提供统一的清理与容错解析，避免在各路由/组件中重复实现。
 */

/** 去除首尾的 markdown 代码块标记（```json ... ```） */
export function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '');
}

/** 清理 AI 输出：去代码块标记 + trim */
export function cleanAiJson(text: string): string {
  return stripCodeFences(text).trim();
}

/** 从文本中提取第一个 JSON 对象字面量 `{...}`（贪婪匹配最外层） */
export function extractJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/** 从文本中提取第一个 JSON 数组字面量 `[...]`（贪婪匹配最外层） */
export function extractJsonArray(text: string): string | null {
  const match = text.match(/\[[\s\S]*\]/);
  return match ? match[0] : null;
}

/**
 * 解析 AI 输出为 JSON 对象：先尝试直接解析清理后的文本，
 * 失败则回退到正则提取 `{...}` 再解析。
 * 解析失败返回 null（不抛出），由调用方决定如何处理。
 */
export function parseJsonObject<T = unknown>(text: string): T | null {
  const cleaned = cleanAiJson(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const extracted = extractJsonObject(cleaned);
    if (!extracted) return null;
    try {
      return JSON.parse(extracted) as T;
    } catch {
      return null;
    }
  }
}
