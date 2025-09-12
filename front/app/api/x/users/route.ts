import { NextRequest, NextResponse } from 'next/server';
import { getAllXUsers } from '@/db_lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeExpired = searchParams.get('includeExpired') === 'true';

    const users = await getAllXUsers(includeExpired);

    return NextResponse.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    console.error('Error in /api/x/users:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch X users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
