import type { BiddingItem } from './types';

/**
 * 关键词过滤器
 * 根据 include/exclude 关键词过滤招标信息
 */
export class BiddingFilter {
  private includeKeywords: string[];
  private excludeKeywords: string[];

  constructor(includeKeywords: string[], excludeKeywords: string[]) {
    this.includeKeywords = includeKeywords.map((k) => k.toLowerCase());
    this.excludeKeywords = excludeKeywords.map((k) => k.toLowerCase());
  }

  /**
   * 过滤招标信息列表
   * 规则: 标题或描述必须包含至少一个 include 关键词，且不包含任何 exclude 关键词
   */
  filter(items: BiddingItem[]): BiddingItem[] {
    return items.filter((item) => this.shouldInclude(item));
  }

  /**
   * 判断单条信息是否应保留
   */
  shouldInclude(item: BiddingItem): boolean {
    const text = `${item.title} ${item.description ?? ''}`.toLowerCase();

    // 排除检查: 包含排除词则丢弃
    for (const keyword of this.excludeKeywords) {
      if (text.includes(keyword)) {
        return false;
      }
    }

    // 包含检查: 至少匹配一个 include 关键词
    const matched: string[] = [];
    for (const keyword of this.includeKeywords) {
      if (text.includes(keyword)) {
        matched.push(keyword);
      }
    }

    if (matched.length > 0) {
      item.matchedKeywords = matched;
      return true;
    }

    return false;
  }

  /**
   * 获取匹配到的关键词列表
   */
  getMatchedKeywords(text: string): string[] {
    const lowerText = text.toLowerCase();
    return this.includeKeywords.filter((k) => lowerText.includes(k));
  }
}
