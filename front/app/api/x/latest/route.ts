import { NextRequest, NextResponse } from 'next/server';
import { getLatestXData, getPagedXData } from '@/db_lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const userId = searchParams.get('userId') || undefined;
    const itemType = searchParams.get('itemType') || undefined;
    const cursor = searchParams.get('cursor'); // Now expects created_at timestamp string
    const usePagination = searchParams.get('paginated') === 'true';

    if (usePagination) {
      // Use pagination for better performance with large datasets
      const result = await getPagedXData({
        userId,
        itemType,
        limit,
        beforeCreatedAt: cursor || undefined
      });

      return NextResponse.json({
        success: true,
        data: result.items,
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          count: result.items.length
        }
      });
    } else {
      // Simple latest data fetch
      const data = await getLatestXData(limit);

      return NextResponse.json({
        success: true,
        data,
        total: data.length
      });
    }
  } catch (error) {
    console.error('Error in /api/x/latest:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch latest X data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
