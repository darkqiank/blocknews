import { NextRequest, NextResponse } from 'next/server';
import { getXUserById, getXDataByUserId } from '@/db_lib/supabase';

interface RouteParams {
  params: {
    userid: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userid } = await params;
    const { searchParams } = new URL(request.url);
    const includePosts = searchParams.get('includePosts') !== 'false'; // default true
    const postsLimit = parseInt(searchParams.get('postsLimit') || '30');

    // Get user information
    const user = await getXUserById(userid);
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      );
    }

    // Get user's posts if requested
    let posts = [];
    if (includePosts) {
      posts = await getXDataByUserId(userid, postsLimit);
    }

    return NextResponse.json({
      success: true,
      data: {
        user,
        posts: includePosts ? posts : undefined,
        postsCount: includePosts ? posts.length : undefined
      }
    });
  } catch (error) {
    console.error(`Error in /api/x/user/${params?.userid}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
