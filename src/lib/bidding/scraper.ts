import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import type { BiddingItem, SiteConfig } from './types';

// ============================================
// 通用工具函数
// ============================================

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

function safeText(el: cheerio.Cheerio<cheerio.Element>): string {
  return el.text().replace(/\s+/g, ' ').trim();
}

/**
 * 通用 HTTP 请求
 */
async function fetchPage(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
  } = {}
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? 15000);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: { ...COMMON_HEADERS, ...options.headers },
      body: options.body,
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// 站点适配器接口
// ============================================

interface SiteAdapter {
  /** 站点配置 */
  config: SiteConfig;
  /** 执行采集 */
  scrape(daysBack?: number): Promise<BiddingItem[]>;
}

// ============================================
// 中国政府采购网 (ccgp.gov.cn)
// ============================================

class CcgpAdapter implements SiteAdapter {
  config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  async scrape(daysBack = 7): Promise<BiddingItem[]> {
    const items: BiddingItem[] = [];
    const startDate = getDaysAgo(daysBack);
    const endDate = formatDate(new Date());

    // 搜索关键词列表
    const searchKeywords = ['铁塔', '输电铁塔', '通信铁塔', '电力铁塔'];

    for (const keyword of searchKeywords) {
      try {
        const url = this.config.searchUrl
          .replace('{startDate}', startDate)
          .replace('{endDate}', endDate)
          .replace('{keyword}', encodeURIComponent(keyword));

        const html = await fetchPage(url);
        const parsed = this.parseSearchResults(html, keyword);
        items.push(...parsed);

        // 请求间隔，避免被封
        await new Promise((r) => setTimeout(r, 1500));
      } catch (error) {
        console.warn(`[CCGP] 关键词 "${keyword}" 采集失败:`, error instanceof Error ? error.message : error);
      }
    }

    return this.deduplicateByTitle(items);
  }

  private parseSearchResults(html: string, _keyword: string): BiddingItem[] {
    const $ = cheerio.load(html);
    const items: BiddingItem[] = [];

    // CCGP 搜索结果列表
    $('ul.vT-srch-result-list-bid li, ul.vT-srch-result-list li').each((_i, el) => {
      const $el = $(el);
      const $link = $el.find('a').first();
      const title = safeText($link);
      const url = $link.attr('href') ?? '';
      const dateText = $el.find('span.date, span.pr').text().trim();
      const desc = safeText($el.find('p, span.content'));

      // 提取日期
      const dateMatch = dateText.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
      const publishDate = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
        : formatDate(new Date());

      if (title && url) {
        items.push({
          id: `ccgp-${crypto.randomUUID()}`,
          title,
          url: url.startsWith('http') ? url : `http://www.ccgp.gov.cn${url}`,
          publishDate,
          source: '中国政府采购网',
          type: this.detectType(title),
          matchedKeywords: [],
          description: desc.slice(0, 200),
          scrapedAt: new Date().toISOString(),
        });
      }
    });

    return items;
  }

  private detectType(title: string): string {
    if (title.includes('招标公告') || title.includes('公开招标')) return '招标公告';
    if (title.includes('预审') || title.includes('资格预审')) return '资格预审';
    if (title.includes('变更') || title.includes('更正')) return '变更公告';
    if (title.includes('中标') || title.includes('成交')) return '中标结果';
    return '其他';
  }

  private deduplicateByTitle(items: BiddingItem[]): BiddingItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.title.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// ============================================
// 云南省公共资源交易中心 (ggzy.yn.gov.cn)
// ============================================

class YunnanGgzyAdapter implements SiteAdapter {
  config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  async scrape(daysBack = 7): Promise<BiddingItem[]> {
    const items: BiddingItem[] = [];
    const searchKeywords = ['铁塔', '输电', '电力工程', '钢结构'];

    for (const keyword of searchKeywords) {
      try {
        // 云南省公共资源交易中心的搜索接口
        const apiUrl = `https://ggzy.yn.gov.cn/home/inteligentsearch/searchResult`;
        const startDate = getDaysAgo(daysBack);
        const endDate = formatDate(new Date());

        const body = JSON.stringify({
          token: '',
          searchData: {
            searchKey: keyword,
            searchType: '0',
            startTime: startDate,
            endTime: endDate,
            page: 1,
            pageSize: 20,
          },
        });

        const html = await fetchPage(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Referer: 'https://ggzy.yn.gov.cn/',
          },
          body,
        });

        // 尝试解析 JSON 响应
        try {
          const json = JSON.parse(html) as {
            result?: Array<{
              title: string;
              url: string;
              publishDate?: string;
              areaName?: string;
              typeName?: string;
            }>;
          };
          if (json.result) {
            for (const r of json.result) {
              items.push({
                id: `ynggzy-${crypto.randomUUID()}`,
                title: r.title?.replace(/<[^>]+>/g, '') ?? '',
                url: r.url ?? '',
                publishDate: r.publishDate ?? formatDate(new Date()),
                source: '云南省公共资源交易中心',
                type: r.typeName ?? '招标公告',
                matchedKeywords: [],
                region: r.areaName,
                scrapedAt: new Date().toISOString(),
              });
            }
          }
        } catch {
          // 如果不是 JSON，尝试 HTML 解析
          const parsed = this.parseHtmlResults(html);
          items.push(...parsed);
        }

        await new Promise((r) => setTimeout(r, 1500));
      } catch (error) {
        console.warn(`[云南GGZY] 关键词 "${keyword}" 采集失败:`, error instanceof Error ? error.message : error);
      }
    }

    return items;
  }

  private parseHtmlResults(html: string): BiddingItem[] {
    const $ = cheerio.load(html);
    const items: BiddingItem[] = [];

    $('table tbody tr, .list-item, .result-item').each((_i, el) => {
      const $el = $(el);
      const $link = $el.find('a').first();
      const title = safeText($link);
      const url = $link.attr('href') ?? '';
      const dateText = $el.find('td:last-child, .date, time').text().trim();

      const dateMatch = dateText.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
      const publishDate = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
        : formatDate(new Date());

      if (title && url) {
        const fullUrl = url.startsWith('http') ? url : `https://ggzy.yn.gov.cn${url}`;
        items.push({
          id: `ynggzy-${crypto.randomUUID()}`,
          title,
          url: fullUrl,
          publishDate,
          source: '云南省公共资源交易中心',
          type: '招标公告',
          matchedKeywords: [],
          scrapedAt: new Date().toISOString(),
        });
      }
    });

    return items;
  }
}

// ============================================
// 中国招标投标公共服务平台 (cebpubservice.com)
// ============================================

class CebpubserviceAdapter implements SiteAdapter {
  config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  async scrape(daysBack = 7): Promise<BiddingItem[]> {
    const items: BiddingItem[] = [];
    const searchKeywords = ['铁塔', '输电线路', '电力铁塔'];

    for (const keyword of searchKeywords) {
      try {
        const startDate = getDaysAgo(daysBack);
        const endDate = formatDate(new Date());

        // 尝试 API 接口
        const apiUrl =
          `http://www.cebpubservice.com/ctpsp_iiss/searchbulletin/search` +
          `?searchdata=${encodeURIComponent(keyword)}` +
          `&timebegin=${startDate}&timeend=${endDate}`;

        const html = await fetchPage(apiUrl);

        try {
          const json = JSON.parse(html) as {
            data?: Array<{
              title: string;
              bulletinUrl?: string;
              issueTime?: string;
              areaName?: string;
              bulletinType?: string;
            }>;
          };
          if (json.data) {
            for (const r of json.data) {
              items.push({
                id: `ceb-${crypto.randomUUID()}`,
                title: r.title?.replace(/<[^>]+>/g, '') ?? '',
                url: r.bulletinUrl ?? '',
                publishDate: r.issueTime?.split(' ')[0] ?? formatDate(new Date()),
                source: '中国招标投标公共服务平台',
                type: r.bulletinType ?? '招标公告',
                matchedKeywords: [],
                region: r.areaName,
                scrapedAt: new Date().toISOString(),
              });
            }
          }
        } catch {
          const parsed = this.parseHtmlResults(html);
          items.push(...parsed);
        }

        await new Promise((r) => setTimeout(r, 1500));
      } catch (error) {
        console.warn(`[CEB] 关键词 "${keyword}" 采集失败:`, error instanceof Error ? error.message : error);
      }
    }

    return items;
  }

  private parseHtmlResults(html: string): BiddingItem[] {
    const $ = cheerio.load(html);
    const items: BiddingItem[] = [];

    $('.search-result-list li, .list-box li, .result-list .item').each((_i, el) => {
      const $el = $(el);
      const $link = $el.find('a').first();
      const title = safeText($link);
      const url = $link.attr('href') ?? '';
      const dateText = $el.find('.time, .date, span:last-child').text().trim();

      const dateMatch = dateText.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
      const publishDate = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
        : formatDate(new Date());

      if (title && url) {
        items.push({
          id: `ceb-${crypto.randomUUID()}`,
          title,
          url: url.startsWith('http') ? url : `http://www.cebpubservice.com${url}`,
          publishDate,
          source: '中国招标投标公共服务平台',
          type: '招标公告',
          matchedKeywords: [],
          scrapedAt: new Date().toISOString(),
        });
      }
    });

    return items;
  }
}

// ============================================
// 中国采购与招标网 (chinabidding.com)
// ============================================

class ChinabiddingAdapter implements SiteAdapter {
  config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  async scrape(daysBack = 7): Promise<BiddingItem[]> {
    const items: BiddingItem[] = [];
    const searchKeywords = ['铁塔', '输电铁塔', '电力铁塔'];

    for (const keyword of searchKeywords) {
      try {
        const url = this.config.searchUrl.replace('{keyword}', encodeURIComponent(keyword));
        const html = await fetchPage(url);
        const parsed = this.parseHtmlResults(html);
        items.push(...parsed);

        await new Promise((r) => setTimeout(r, 1500));
      } catch (error) {
        console.warn(`[Chinabidding] 关键词 "${keyword}" 采集失败:`, error instanceof Error ? error.message : error);
      }
    }

    return items;
  }

  private parseHtmlResults(html: string): BiddingItem[] {
    const $ = cheerio.load(html);
    const items: BiddingItem[] = [];

    // chinabidding 搜索结果
    $('.search-result-list li, .zbgg-list li, .list-content .item, table.list tr').each(
      (_i, el) => {
        const $el = $(el);
        const $link = $el.find('a').first();
        const title = safeText($link);
        const url = $link.attr('href') ?? '';
        const dateText = $el.find('.time, .date, td:last-child').text().trim();

        const dateMatch = dateText.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
        const publishDate = dateMatch
          ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
          : formatDate(new Date());

        if (title && url) {
          items.push({
            id: `cb-${crypto.randomUUID()}`,
            title,
            url: url.startsWith('http') ? url : `https://www.chinabidding.com${url}`,
            publishDate,
            source: '中国采购与招标网',
            type: '招标公告',
            matchedKeywords: [],
            scrapedAt: new Date().toISOString(),
          });
        }
      }
    );

    return items;
  }
}

// ============================================
// 爬虫引擎 - 统一调度
// ============================================

export interface ScrapeEngineOptions {
  /** 回溯天数 */
  daysBack?: number;
  /** 只采集指定站点 */
  siteIds?: string[];
}

export async function runScraper(
  sites: SiteConfig[],
  options: ScrapeEngineOptions = {}
): Promise<{ siteName: string; items: BiddingItem[]; error?: string; duration: number }[]> {
  const { daysBack = 7, siteIds } = options;
  const results: {
    siteName: string;
    items: BiddingItem[];
    error?: string;
    duration: number;
  }[] = [];

  const enabledSites = sites.filter((s) => s.enabled && (!siteIds || siteIds.includes(s.id)));

  for (const site of enabledSites) {
    const start = Date.now();
    try {
      const adapter = createAdapter(site);
      const items = await adapter.scrape(daysBack);
      results.push({
        siteName: site.name,
        items,
        duration: Date.now() - start,
      });
    } catch (error) {
      results.push({
        siteName: site.name,
        items: [],
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
    }
  }

  return results;
}

function createAdapter(config: SiteConfig): SiteAdapter {
  switch (config.parserType) {
    case 'ccgp':
      return new CcgpAdapter(config);
    case 'yunnan_ggzy':
      return new YunnanGgzyAdapter(config);
    case 'cebpubservice':
      return new CebpubserviceAdapter(config);
    case 'chinabidding':
      return new ChinabiddingAdapter(config);
    default:
      return new CcgpAdapter(config);
  }
}
