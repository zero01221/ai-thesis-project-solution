import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/bidding/engine';
import { DingTalkNotifier } from '@/lib/bidding/dingtalk';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action: 'test' | 'push';
      items?: Array<{
        title: string;
        url: string;
        publishDate: string;
        source: string;
        matchedKeywords: string[];
        budget?: string;
        deadline?: string;
      }>;
    };

    const config = loadConfig();
    const { webhookUrl, secret } = config.notification.dingtalk;

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: '钉钉 Webhook 地址未配置' },
        { status: 400 }
      );
    }

    const notifier = new DingTalkNotifier(webhookUrl, secret);

    if (body.action === 'test') {
      const result = await notifier.sendTest();
      return NextResponse.json(result);
    }

    if (body.action === 'push' && body.items) {
      const biddingItems = body.items.map((item) => ({
        ...item,
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: '招标公告',
        description: '',
        scrapedAt: new Date().toISOString(),
      }));
      const result = await notifier.pushBiddingItems(biddingItems);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: '无效的 action 参数' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API /api/notify] 通知发送失败:', error);
    return NextResponse.json(
      { success: false, error: '通知发送失败' },
      { status: 500 }
    );
  }
}
