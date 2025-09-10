import { NextResponse } from 'next/server';
import sourceMap from '@/public/source_map.json';

export async function GET() {
  try {
    // Build sources from public/source_map.json
    const entries = Object.entries(sourceMap as Record<string, string>);
    const sources = entries.map(([key, label]) => ({
      source: key,
      label,
      rssUrl: `/api/rss/source/${encodeURIComponent(key)}`,
    }));

    return NextResponse.json({
      sources,
      latestRssUrl: '/api/rss/latest'
    });
  } catch (error) {
    console.error('Error building RSS sources:', error);
    return NextResponse.json(
      { error: 'Failed to build RSS sources' },
      { status: 500 }
    );
  }
}
