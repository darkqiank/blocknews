import { NextResponse } from 'next/server';
import { getArticlesBySource } from '@/lib/supabase';
import { generateSourceArticlesFeed, generateRSSXML } from '@/lib/rss-generator';

interface Params {
  source: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { source } = await params;
    const decodedSource = decodeURIComponent(source);
    
    // Get latest 30 articles for this source from Supabase
    const articles = await getArticlesBySource(decodedSource, 30);
    
    if (articles.length === 0) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>No Articles for ${decodedSource}</title><description>No articles found for source: ${decodedSource}</description></channel></rss>`,
        {
          status: 200,
          headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          },
        }
      );
    }

    // Get the base URL from the request
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // Generate RSS feed for this source
    const feed = generateSourceArticlesFeed(articles, decodedSource, baseUrl);
    const rssXML = generateRSSXML(feed);

    return new NextResponse(rssXML, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating source-specific RSS:', error);
    
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title><description>Error generating RSS feed</description></channel></rss>',
      {
        status: 500,
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
        },
      }
    );
  }
}
