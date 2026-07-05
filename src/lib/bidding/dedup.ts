import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { BiddingItem, HistoryStore } from './types';

const DATA_DIR = path.join(process.env.COZE_WORKSPACE_PATH ?? '/workspace/projects', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

/**
 * 去重模块
 * 基于 URL + 标题 + 日期 生成唯一指纹，避免重复推送
 */
export class Deduplication {
  private store: HistoryStore;

  constructor() {
    this.store = this.loadStore();
  }

  /**
   * 加载历史存储
   */
  private loadStore(): HistoryStore {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        return JSON.parse(raw) as HistoryStore;
      }
    } catch {
      // 文件损坏，重新初始化
    }
    return { fingerprints: {}, records: [] };
  }

  /**
   * 持久化存储
   */
  private saveStore(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch (error) {
      console.error('[Dedup] 保存历史记录失败:', error);
    }
  }

  /**
   * 生成唯一指纹
   */
  generateFingerprint(item: BiddingItem): string {
    const raw = `${item.url}|${item.title}|${item.publishDate}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  /**
   * 过滤出新的（未见过）条目
   */
  filterNew(items: BiddingItem[]): BiddingItem[] {
    const newItems: BiddingItem[] = [];
    for (const item of items) {
      const fp = this.generateFingerprint(item);
      if (!this.store.fingerprints[fp]) {
        newItems.push(item);
      }
    }
    return newItems;
  }

  /**
   * 标记条目为已处理，并保存到历史记录
   */
  markSeen(items: BiddingItem[]): void {
    const now = new Date().toISOString();
    for (const item of items) {
      const fp = this.generateFingerprint(item);
      if (this.store.fingerprints[fp]) {
        this.store.fingerprints[fp].lastSeen = now;
        this.store.fingerprints[fp].count += 1;
      } else {
        this.store.fingerprints[fp] = { firstSeen: now, lastSeen: now, count: 1 };
      }
    }
    // 追加到历史记录 (保留最近 5000 条)
    this.store.records = [...items, ...this.store.records].slice(0, 5000);
    this.saveStore();
  }

  /**
   * 获取历史记录
   */
  getHistory(limit = 100, offset = 0): BiddingItem[] {
    return this.store.records.slice(offset, offset + limit);
  }

  /**
   * 获取统计信息
   */
  getStats(): { totalFingerprints: number; totalRecords: number } {
    return {
      totalFingerprints: Object.keys(this.store.fingerprints).length,
      totalRecords: this.store.records.length,
    };
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.store = { fingerprints: {}, records: [] };
    this.saveStore();
  }
}
