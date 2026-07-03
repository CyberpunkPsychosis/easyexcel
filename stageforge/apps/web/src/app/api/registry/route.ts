import { NextResponse, type NextRequest } from 'next/server';
import { listAdapters, serializeAdapter } from '@stageforge/adapters';
import type { Capability } from '@stageforge/core';

export const dynamic = 'force-dynamic';

/** 模型注册表 —— Stage Rail 下拉与成本徽标的数据源 */
export function GET(req: NextRequest) {
  const capability = req.nextUrl.searchParams.get('capability') as Capability | null;
  const adapters = listAdapters(capability ?? undefined).map(serializeAdapter);
  return NextResponse.json({ adapters });
}
