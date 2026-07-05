import { NextResponse } from 'next/server';
import { getHistory, getStats } from '@/lib/bidding/engine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const history = getHistory(limit, offset);
    const stats = getStats();

    return NextResponse.json({
      success: true,
      data: {
        items: history,
        stats,
        hasMore: history.length === limit,
      },
    });
  } catch (error) {
    console.error('[API /api/history] 获取历史失败:', error);
    return NextResponse.json(
      { success: false, error: '获取历史记录失败' },
      { status: 500 }
    );
  }
}
