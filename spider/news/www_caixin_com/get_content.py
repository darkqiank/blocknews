import re
from bs4 import BeautifulSoup

def get_content(_content: str) -> dict:
    """
    从给定的HTML字符串中提取文章标题、发布日期和正文内容。

    Args:
        _content: 包含文章的HTML内容的字符串。

    Returns:
        一个包含'title', 'pub_date', 和 'content'键的字典。
    """
    article = {
        'title': '',
        'pub_date': '',
        'content': ''
    }
    if not _content:
        return article

    soup = BeautifulSoup(_content, 'html.parser')

    # 1. 提取文章标题
    # 优先使用 <title> 标签，因为它通常最准确。
    # 如果 <title> 标签不存在或内容为空，则尝试查找 <h1> 标签作为备选。
    title_tag = soup.find('title')
    if title_tag and title_tag.string:
        article['title'] = title_tag.get_text(strip=True)
    else:
        h1_tag = soup.find('h1')
        if h1_tag:
            article['title'] = h1_tag.get_text(strip=True)

    # 2. 提取发布时间
    # 使用正则表达式在整个HTML文本中搜索日期模式。
    # 这种方法不依赖于特定的HTML标签或class，鲁棒性较好。
    # 正则表达式可以匹配 "YYYY-MM-DD", "YYYY.MM.DD", "YYYY年MM月DD日" 等常见格式。
    date_match = re.search(r'(\d{4})\s*[年.-]\s*(\d{1,2})\s*[月.-]\s*(\d{1,2})', _content)
    if date_match:
        year, month, day = date_match.groups()
        article['pub_date'] = f"{year}-{int(month):02d}-{int(day):02d}"

    # 3. 提取正文内容
    # 尝试选择一个可能性最高的文章主内容容器。
    # 'div#the_content', 'div.article' 是常见的文章容器标识。
    content_container = soup.select_one('div#the_content, div.article, [role="main"]')

    if content_container:
        # 为了保证内容的纯净，移除常见的不属于正文的部分，如相关推荐、评论、分页、作者信息等。
        # .decompose() 方法会彻底从解析树中移除标签及其所有内容。
        elements_to_remove = [
            '.pip',           # 相关报道
            '.page',          # 分页
            '#pageNext',      # 分页
            '.content-tag',   # 标签
            '.idetor',        # 责任编辑
            '.moreReport',    # 更多报道
            '.pnArt',         # 上一篇/下一篇
            '.comment',       # 评论区
            '#comment',       # 评论区
            '.article_topic', # 文章主题
            '#chargeWall',    # 付费墙
            '.lanmu_textend', # 推荐链接
            '.function01',    # 分享功能
            '.fenxiangRig',   # 分享
            'form'            # 表单（如搜索框）
        ]
        for selector in elements_to_remove:
            for element in content_container.select(selector):
                element.decompose()

        # 使用 get_text(separator='\n') 提取所有文本。
        # separator='\n' 会在不同标签块的文本之间插入换行符，
        # 完美解决了文本、表格内容粘连的问题，符合要求。
        # strip=True 会移除每个文本块前后的空白字符。
        article['content'] = content_container.get_text(separator='\n', strip=True)
    else:
        # 如果找不到主容器，作为备选方案，可以尝试查找更通用的 class，
        # 如 'text' 或 'content'，但这可能会包含非正文内容。
        fallback_container = soup.select_one('div.text, div.content, #Main_Content_Val')
        if fallback_container:
            article['content'] = fallback_container.get_text(separator='\n', strip=True)

    return article