/**
 * 时间格式化工具函数
 */

/**
 * 格式化相对时间显示
 * 一天内显示相对时间（刚刚、xx分钟前、xx小时前）
 * 超过一天显示完整时间
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  // 一天内显示相对时间
  if (diffDays < 1) {
    if (diffHours >= 1) {
      return `${diffHours}小时前`;
    }
    if (diffMinutes >= 1) {
      return `${diffMinutes}分钟前`;
    }
    return '刚刚';
  }
  
  // 超过一天显示完整时间
  return date.toLocaleString('zh-CN');
}
