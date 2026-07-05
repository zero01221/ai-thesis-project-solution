import { NextResponse } from 'next/server';
import { scrapeAndNotify } from '@/lib/bidding/engine';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      siteIds?: string[];
      daysBack?: number;
      skipNotify?: boolean;
    };

    const result = await scrapeAndNotify({
      siteIds: body.siteIds,
      daysBack: body.daysBack ?? 7,
      skipNotify: body.skipNotify ?? false,
    });

    return NextResponse.json({
      success: true,
      data: {
        siteResults: result.siteResults.map((r) => ({
          siteName: r.siteName,
          success: r.success,
          itemCount: r.items.length,
          error: r.error,
          duration: r.duration,
        })),
        totalScraped: result.siteResults.reduce((sum, r) => sum + r.items.length, 0),
        filteredCount: result.newItems.length,
        newItems: result.newItems.slice(0, 50),
        notification: result.notificationResult,
        totalDuration: result.totalDuration,
      },
    });
  } catch (error) {
    console.error('[API /api/scrape] 采集失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '采集过程发生未知错误',
      },
      { status: 500 }
    );
  }
}
