from bs4 import BeautifulSoup
from urllib.parse import urljoin

def get_links(_content: str) -> list:
    """
    从给定的 HTML 内容中提取正文部分的博客文章链接。

    Args:
        _content: 包含博客文章列表的 HTML 字符串。

    Returns:
        一个包含按时间顺序排列的完整博客文章 URL 的列表。
    """
    base_netloc = "https://www.caixin.com"
    links = []
    
    soup = BeautifulSoup(_content, 'html.parser')

    # 定位到包含文章列表的主内容区域
    # 根据 HTML 结构，文章列表位于 class="stitXtuwen_list" 的 div 中
    article_list_div = soup.select_one('div.stitXtuwen_list')

    if article_list_div:
        # 提取每个文章条目中的标题链接 (h4 > a)
        # 这种选择器可以精确地定位到文章标题，避免提取图片或摘要中的重复链接
        article_items = article_list_div.select('h4 > a')
        
        for item in article_items:
            href = item.get('href')
            if href:
                # 检查链接是否为完整 URL，如果不是则拼接
                if href.startswith('http'):
                    full_link = href
                else:
                    full_link = urljoin(base_netloc, href)
                links.append(full_link)
                
    return links