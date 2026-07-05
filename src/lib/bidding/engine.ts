import * as fs from 'fs';
import * as path from 'path';
import type { AppConfig } from './types';
import { DEFAULT_CONFIG } from './default-config';
import { runScraper } from './scraper';
import { BiddingFilter } from './filter';
import { Deduplication } from './dedup';
import { DingTalkNotifier } from './dingtalk';
import type { BiddingItem, ScrapeResult } from './types';

const DATA_DIR = path.join(process.env.COZE_WORKSPACE_PATH ?? '/workspace/projects', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// ============================================
// 配置管理
// ============================================

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(raw) as Partial<AppConfig>;
      // 合并默认配置，确保新增字段不会丢失
      return mergeConfig(DEFAULT_CONFIG, saved);
    }
  } catch (error) {
    console.error('[Engine] 加载配置失败，使用默认配置:', error);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: AppConfig): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Engine] 保存配置失败:', error);
    throw error;
  }
}

function mergeConfig(defaults: AppConfig, saved: Partial<AppConfig>): AppConfig {
  return {
    sites: saved.sites ?? defaults.sites,
    keywords: {
      include: saved.keywords?.include ?? defaults.keywords.include,
      exclude: saved.keywords?.exclude ?? defaults.keywords.exclude,
    },
    notification: {
      dingtalk: {
        enabled: saved.notification?.dingtalk?.enabled ?? defaults.notification.dingtalk.enabled,
        webhookUrl:
          saved.notification?.dingtalk?.webhookUrl ?? defaults.notification.dingtalk.webhookUrl,
        secret: saved.notification?.dingtalk?.secret ?? defaults.notification.dingtalk.secret,
      },
    },
    schedule: {
      cron: saved.schedule?.cron ?? defaults.schedule.cron,
      maxItemsPerRun: saved.schedule?.maxItemsPerRun ?? defaults.schedule.maxItemsPerRun,
    },
  };
}

// ============================================
// 采集引擎 - 完整流程
// ============================================

export interface ScrapeAndNotifyResult {
  /** 各站点采集结果 */
  siteResults: ScrapeResult[];
  /** 过滤后的新条目 */
  newItems: BiddingItem[];
  /** 通知结果 */
  notificationResult?: { success: boolean; error?: string };
  /** 总耗时 */
  totalDuration: number;
}

/**
 * 执行完整的采集-过滤-去重-通知流程
 */
export async function scrapeAndNotify(options?: {
  siteIds?: string[];
  daysBack?: number;
  skipNotify?: boolean;
}): Promise<ScrapeAndNotifyResult> {
  const startTime = Date.now();
  const config = loadConfig();

  // 1. 采集
  const rawResults = await runScraper(config.sites, {
    daysBack: options?.daysBack ?? 7,
    siteIds: options?.siteIds,
  });

  const siteResults: ScrapeResult[] = rawResults.map((r) => ({
    success: !r.error,
    siteName: r.siteName,
    items: r.items,
    error: r.error,
    duration: r.duration,
  }));

  // 合并所有条目
  const allItems = rawResults.flatMap((r) => r.items);

  // 2. 关键词过滤
  const filter = new BiddingFilter(config.keywords.include, config.keywords.exclude);
  const filteredItems = filter.filter(allItems);

  // 3. 去重
  const dedup = new Deduplication();
  const newItems = dedup.filterNew(filteredItems);

  // 4. 标记已处理
  if (newItems.length > 0) {
    dedup.markSeen(newItems);
  }

  // 5. 通知
  let notificationResult: { success: boolean; error?: string } | undefined;
  const shouldNotify =
    !options?.skipNotify &&
    config.notification.dingtalk.enabled &&
    config.notification.dingtalk.webhookUrl &&
    newItems.length > 0;

  if (shouldNotify) {
    const notifier = new DingTalkNotifier(
      config.notification.dingtalk.webhookUrl,
      config.notification.dingtalk.secret
    );
    notificationResult = await notifier.pushBiddingItems(newItems);
  }

  return {
    siteResults,
    newItems,
    notificationResult,
    totalDuration: Date.now() - startTime,
  };
}

/**
 * 获取历史记录
 */
export function getHistory(limit = 100, offset = 0): BiddingItem[] {
  const dedup = new Deduplication();
  return dedup.getHistory(limit, offset);
}

/**
 * 获取统计信息
 */
export function getStats(): {
  totalFingerprints: number;
  totalRecords: number;
  siteCount: number;
  includeKeywordCount: number;
} {
  const dedup = new Deduplication();
  const config = loadConfig();
  return {
    ...dedup.getStats(),
    siteCount: config.sites.filter((s) => s.enabled).length,
    includeKeywordCount: config.keywords.include.length,
  };
}
