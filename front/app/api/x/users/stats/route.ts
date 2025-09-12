import { NextResponse } from 'next/server';
import { supabase } from '@/db_lib/supabase';

export async function GET() {
  try {
    // 获取过去24小时的数据统计
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // 获取每个用户在过去24小时的推文数
    const { data: stats, error } = await supabase
      .from('t_x')
      .select('user_id')
      .gte('created_at', yesterday.toISOString())
      .not('user_id', 'is', null);

    if (error) {
      console.error('Error fetching user stats:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user stats' },
        { status: 500 }
      );
    }

    // 统计每个用户的推文数
    const userStats: { [key: string]: number } = {};
    stats?.forEach(item => {
      if (item.user_id) {
        userStats[item.user_id] = (userStats[item.user_id] || 0) + 1;
      }
    });

    return NextResponse.json({
      success: true,
      data: userStats
    });
  } catch (error) {
    console.error('Error in /api/x/users/stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
