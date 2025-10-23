import { NextResponse } from 'next/server';
import { getXUserByUsername, getPagedXData } from '@/db_lib/supabase';
import { generateXUserFeed, generateRSSXML } from '@/db_lib/rss-generator';

interface RouteParams {
  params: Promise<{
    username: string;
  }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { username } = await params;
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 50;
    const onlyImportant = searchParams.get('onlyImportant') === 'true';

    // Get user information to verify user exists
    const user = await getXUserByUsername(username);
    
    if (!user) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>User Not Found</title><description>User not found</description></channel></rss>',
        {
          status: 404,
          headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
          },
        }
      );
    }

    // Get user's X data with optional important filter
    const result = await getPagedXData({ 
      userId: user.user_id,
      limit, 
      onlyImportant 
    });
    const xDataList = result.items;
    
    if (xDataList.length === 0) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>No Posts</title><description>No posts found for @${username}</description></channel></rss>`,
        {
          status: 200,
          headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=600', // Cache for 10 minutes
          },
        }
      );
    }

    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Generate RSS feed
    const feed = generateXUserFeed(xDataList, username, baseUrl);
    const rssXML = generateRSSXML(feed);

    return new NextResponse(rssXML, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600', // Cache for 10 minutes
      },
    });
  } catch (error) {
    console.error('Error generating X user RSS:', error);
    
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

