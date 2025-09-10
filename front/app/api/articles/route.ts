import { NextResponse } from 'next/server';
import { getPagedArticles } from '@/db_lib/supabase';
import sourceMap from '@/public/source_map.json';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || undefined;
    const limitParam = searchParams.get('limit');
    const before = searchParams.get('before') || undefined;
    const limit = limitParam ? Math.max(1, Math.min(50, parseInt(limitParam, 10))) : 20;

    if (source) {
      const map = sourceMap as Record<string, string>;
      if (!Object.prototype.hasOwnProperty.call(map, source)) {
        return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
      }
    }

    const result = await getPagedArticles({ source, limit, before });

    return NextResponse.json(
      {
        items: result.items,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=30',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}


