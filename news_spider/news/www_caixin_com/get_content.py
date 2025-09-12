import re
from bs4 import BeautifulSoup
from datetime import datetime

def get_content(_content: str) -> dict:
    """
    从给定的HTML字符串中提取文章标题、发布时间和正文内容。

    Args:
        _content: 包含文章HTML的字符串。

    Returns:
        一个包含'title', 'pub_date', 'content'键的字典。
        如果提取失败，对应的值将为None。
    """
    article = {
        "title": None,
        "pub_date": None,
        "content": None
    }

    if not isinstance(_content, str) or not _content:
        return article

    soup = BeautifulSoup(_content, 'html.parser')

    # 1. 提取文章标题 (title)
    # 优先选择文章内容区的h1，其次是页面主h1，最后是<title>标签
    title_tag = soup.select_one('div.article h1, div#conTit h1') or soup.find('h1') or soup.find('title')
    if title_tag:
        article['title'] = title_tag.get_text(strip=True)

    # 2. 提取发布时间 (pub_date)
    # 首先尝试在特定信息区域查找
    date_container = soup.find('div', class_='artInfo')
    date_text = date_container.get_text() if date_container else ''
    
    # 如果在特定区域找不到，则在整个页面（头部）搜索，因为时间信息通常靠前
    if not re.search(r'\d{4}', date_text) and soup.body:
        # 限制搜索范围以提高效率
        search_text = ' '.join(soup.body.get_text().split()[:400])
        # 匹配多种常见日期和时间格式
        match = re.search(
            r'(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})',
            search_text
        )
        if match:
             date_text = match.group(0) # 使用匹配到的字符串进行下一步解析

    if date_text:
        date_match = re.search(r'(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})', date_text)
        if date_match:
            try:
                year, month, day = map(int, date_match.groups())
                
                time_match = re.search(r'(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?', date_text)
                hour, minute, second = (0, 0, 0)
                if time_match:
                    hour = int(time_match.group(1))
                    minute = int(time_match.group(2))
                    second = int(time_match.group(3) or 0)

                dt_obj = datetime(year, month, day, hour, minute, second)
                article['pub_date'] = dt_obj.strftime('%Y-%m-%d %H:%M:%S')
            except (ValueError, IndexError):
                # 处理无效日期，如 2023-02-30
                article['pub_date'] = None

    # 3. 提取正文内容 (content)
    # 使用减法策略：找到一个大的容器，然后移除所有不需要的部分
    content_container = soup.find('div', id='the_content') or soup.find('div', class_='article')
    
    if content_container:
        # 克隆节点进行清理，避免影响原始的 soup 对象
        content_clone = BeautifulSoup(str(content_container), 'html.parser')
        
        # 定义要移除的元素的CSS选择器列表
        selectors_to_remove = [
            'script', 'style',  # 脚本和样式
            '.pip',             # 相关报道和广告的容器
            '#chargeWall',      # 付费墙
            '.page', '#pageNext', # 分页
            '.content-tag',     # 文章标签
            '.article_topic',   # 文章专题
            '.pnArt',           # 上一篇/下一篇
            '#comment', '.comment', # 评论区
            '.function01',      # 功能按钮（分享、评论等）
            '.fenxiangRig',     # 分享按钮
            'wb\\:follow-button', # 微博关注按钮
            '#conTit h1',       # 移除内容中的主标题，避免重复
            '.artInfo', '#artInfo', # 移除作者和日期信息，避免重复
            '.idetor'           # 责任编辑信息
        ]
        
        for selector in selectors_to_remove:
            for element in content_clone.select(selector):
                element.decompose()
        
        # 提取清理后的文本，用换行符连接，保证表格和ioc等内容不粘连
        article['content'] = content_clone.get_text(separator='\n', strip=True)

    return article