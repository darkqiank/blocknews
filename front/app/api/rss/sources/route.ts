import { NextResponse } from 'next/server';
import { getAllSources, getSourceStats } from '@/lib/supabase';

export async function GET() {
  try {
    // Get all available sources and their stats
    const [sources, stats] = await Promise.all([
      getAllSources(),
      getSourceStats()
    ]);

    const sourceData = sources.map(source => {
      const stat = stats.find(s => s.source === source);
      return {
        source,
        count: stat?.count || 0,
        rssUrl: `/api/rss/source/${encodeURIComponent(source)}`
      };
    });

    return NextResponse.json({
      sources: sourceData,
      latestRssUrl: '/api/rss/latest'
    });
  } catch (error) {
    console.error('Error fetching RSS sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS sources' },
      { status: 500 }
    );
  }
}
