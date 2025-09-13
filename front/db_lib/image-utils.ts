/**
 * 图片代理工具函数
 * 通过环境变量配置的反代URL处理外部图片资源
 */

/**
 * 获取代理后的图片URL
 * @param originalUrl 原始图片URL
 * @returns 代理后的图片URL或原始URL
 */
export function getProxiedImageUrl(originalUrl: string): string {
  // 如果原始URL为空或无效，直接返回
  if (!originalUrl || typeof originalUrl !== 'string') {
    return originalUrl;
  }

  // 获取环境变量中的反代URL
  const proxyUrl = process.env.NEXT_PUBLIC_IMAGE_PROXY_URL;
  
  // 如果没有配置反代URL，直接返回原始URL
  if (!proxyUrl) {
    return originalUrl;
  }

  // 如果原始URL已经是本地路径或data URI，不需要代理
  if (originalUrl.startsWith('/') || 
      originalUrl.startsWith('data:') || 
      originalUrl.startsWith('blob:')) {
    return originalUrl;
  }

  // 如果原始URL已经通过代理服务器，避免重复代理
  if (originalUrl.startsWith(proxyUrl)) {
    return originalUrl;
  }

  // 构建代理URL：反代URL + "/" + 外部图片URL
  const normalizedProxyUrl = proxyUrl.endsWith('/') ? proxyUrl.slice(0, -1) : proxyUrl;
  return `${normalizedProxyUrl}/${originalUrl}`;
}

/**
 * 检查URL是否需要代理
 * @param url 图片URL
 * @returns 是否需要代理
 */
export function shouldProxyImage(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // 本地路径和data URI不需要代理
  if (url.startsWith('/') || 
      url.startsWith('data:') || 
      url.startsWith('blob:')) {
    return false;
  }

  // 如果没有配置代理URL，不需要代理
  const proxyUrl = process.env.NEXT_PUBLIC_IMAGE_PROXY_URL;
  if (!proxyUrl) {
    return false;
  }

  // 已经代理过的URL不需要再次代理
  if (url.startsWith(proxyUrl)) {
    return false;
  }

  return true;
}

/**
 * 批量处理图片URL代理
 * @param urls 图片URL数组
 * @returns 代理后的图片URL数组
 */
export function getProxiedImageUrls(urls: string[]): string[] {
  return urls.map(url => getProxiedImageUrl(url));
}
