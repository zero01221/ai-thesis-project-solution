import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/bidding/engine';

export async function GET() {
  try {
    const config = loadConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('[API /api/config GET] 读取配置失败:', error);
    return NextResponse.json(
      { success: false, error: '读取配置失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const currentConfig = loadConfig();

    // 合并更新
    const updatedConfig = {
      ...currentConfig,
      ...body,
      keywords: {
        ...currentConfig.keywords,
        ...(body.keywords as Record<string, unknown> | undefined),
      },
      notification: {
        ...currentConfig.notification,
        ...(body.notification as Record<string, unknown> | undefined),
      },
      schedule: {
        ...currentConfig.schedule,
        ...(body.schedule as Record<string, unknown> | undefined),
      },
    };

    saveConfig(updatedConfig);
    return NextResponse.json({ success: true, data: updatedConfig });
  } catch (error) {
    console.error('[API /api/config POST] 保存配置失败:', error);
    return NextResponse.json(
      { success: false, error: '保存配置失败' },
      { status: 500 }
    );
  }
}
