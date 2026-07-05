import * as crypto from 'crypto';
import type { BiddingItem, DingTalkMessage } from './types';

/**
 * 钉钉机器人通知模块
 * 支持签名验证的 Webhook 推送
 */
export class DingTalkNotifier {
  private webhookUrl: string;
  private secret: string;

  constructor(webhookUrl: string, secret: string) {
    this.webhookUrl = webhookUrl;
    this.secret = secret;
  }

  /**
   * 生成签名
   */
  private generateSign(): { timestamp: string; sign: string } {
    const timestamp = Date.now().toString();
    const stringToSign = `${timestamp}\n${this.secret}`;
    const hmac = crypto.createHmac('sha256', this.secret).update(stringToSign).digest('base64');
    const sign = encodeURIComponent(hmac);
    return { timestamp, sign };
  }

  /**
   * 获取带签名的完整 URL
   */
  private getSignedUrl(): string {
    if (!this.secret) return this.webhookUrl;
    const { timestamp, sign } = this.generateSign();
    const separator = this.webhookUrl.includes('?') ? '&' : '?';
    return `${this.webhookUrl}${separator}timestamp=${timestamp}&sign=${sign}`;
  }

  /**
   * 发送原始消息
   */
  private async send(message: DingTalkMessage): Promise<{ success: boolean; error?: string }> {
    try {
      const url = this.getSignedUrl();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      const result = await response.json() as {
        errcode: number;
        errmsg: string;
      };

      if (result.errcode !== 0) {
        return { success: false, error: `钉钉API错误: ${result.errmsg}` };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `发送失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 推送招标信息汇总 (Markdown 格式)
   */
  async pushBiddingItems(items: BiddingItem[]): Promise<{ success: boolean; error?: string }> {
    if (items.length === 0) {
      return { success: true };
    }

    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const lines: string[] = [
      `## 招标信息速报`,
      `> 采集时间: ${now} | 共 ${items.length} 条新信息`,
      '',
    ];

    for (const item of items.slice(0, 20)) {
      const dateStr = item.publishDate || '未知';
      const keywordStr = item.matchedKeywords.slice(0, 3).join('、');
      lines.push(`### [${item.title}](${item.url})`);
      lines.push(`- 来源: ${item.source} | 日期: ${dateStr}`);
      if (keywordStr) lines.push(`- 匹配: ${keywordStr}`);
      if (item.budget) lines.push(`- 预算: ${item.budget}`);
      if (item.deadline) lines.push(`- 截止: ${item.deadline}`);
      lines.push('');
    }

    if (items.length > 20) {
      lines.push(`> ... 还有 ${items.length - 20} 条，请登录系统查看完整列表`);
    }

    const message: DingTalkMessage = {
      msgtype: 'markdown',
      markdown: {
        title: `招标速报: ${items.length}条新信息`,
        text: lines.join('\n'),
      },
    };

    return this.send(message);
  }

  /**
   * 发送测试消息
   */
  async sendTest(): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const message: DingTalkMessage = {
      msgtype: 'text',
      text: {
        content: `[招标监控系统] 测试消息\n发送时间: ${now}\n\n如果您收到此消息，说明钉钉通知配置正确。`,
      },
    };
    return this.send(message);
  }
}
