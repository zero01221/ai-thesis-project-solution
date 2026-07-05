// ============================================
// 招标信息监控系统 - 类型定义
// ============================================

/** 单条招标信息 */
export interface BiddingItem {
  /** 唯一标识 (用于去重) */
  id: string;
  /** 公告标题 */
  title: string;
  /** 公告链接 */
  url: string;
  /** 发布日期 (YYYY-MM-DD) */
  publishDate: string;
  /** 来源网站名称 */
  source: string;
  /** 公告类型: 招标公告/预审公告/变更公告等 */
  type: string;
  /** 匹配到的关键词 */
  matchedKeywords: string[];
  /** 摘要/描述 */
  description?: string;
  /** 预算金额 */
  budget?: string;
  /** 截止时间 */
  deadline?: string;
  /** 地区 */
  region?: string;
  /** 采购人 */
  purchaser?: string;
  /** 采集时间 */
  scrapedAt: string;
}

/** 目标网站配置 */
export interface SiteConfig {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  /** 搜索/列表页 URL 模板 */
  searchUrl: string;
  /** 解析规则类型 */
  parserType: 'ccgp' | 'yunnan_ggzy' | 'cebpubservice' | 'chinabidding' | 'generic';
}

/** 系统配置 */
export interface AppConfig {
  sites: SiteConfig[];
  keywords: {
    include: string[];
    exclude: string[];
  };
  notification: {
    dingtalk: {
      enabled: boolean;
      webhookUrl: string;
      secret: string;
    };
  };
  schedule: {
    /** Cron 表达式 (文档说明用，实际由外部触发) */
    cron: string;
    /** 每次采集最大条数 */
    maxItemsPerRun: number;
  };
}

/** 采集结果 */
export interface ScrapeResult {
  success: boolean;
  siteName: string;
  items: BiddingItem[];
  error?: string;
  duration: number;
}

/** 历史记录存储 */
export interface HistoryStore {
  /** 已推送的指纹集合 */
  fingerprints: Record<string, { firstSeen: string; lastSeen: string; count: number }>;
  /** 历史采集记录 */
  records: BiddingItem[];
}

/** 钉钉消息类型 */
export interface DingTalkMessage {
  msgtype: 'markdown' | 'text' | 'link';
  markdown?: {
    title: string;
    text: string;
  };
  text?: {
    content: string;
  };
  link?: {
    title: string;
    text: string;
    messageUrl: string;
    picUrl?: string;
  };
}
