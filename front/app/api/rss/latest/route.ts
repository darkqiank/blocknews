import { NextResponse } from 'next/server';
import { getLatestArticles } from '@/db_lib/supabase';
import { generateLatestArticlesFeed, generateRSSXML } from '@/db_lib/rss-generator';

export async function GET(request: Request) {
  try {
    // Get latest 30 articles from Supabase
    const articles = await getLatestArticles(30);
    
    if (articles.length === 0) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>No Articles</title><description>No articles found</description></channel></rss>',
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
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Generate RSS feed
    const feed = generateLatestArticlesFeed(articles, baseUrl);
    const rssXML = generateRSSXML(feed);

    return new NextResponse(rssXML, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating latest articles RSS:', error);
    
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
