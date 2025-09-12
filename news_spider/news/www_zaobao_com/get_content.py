from readability import Document
from bs4 import BeautifulSoup
from datetime import datetime

def get_content(_content):
    doc = Document(_content)
    # 获取文章的标题
    title = doc.title()
    summary_html = doc.summary()
    soup = BeautifulSoup(summary_html, 'html.parser')
    inner_text = soup.get_text(separator='\n')  # Using separator for better readability
    return {
        "title": title,
        "pub_date": datetime.now().strftime("%Y-%m-%d"),
        "content": inner_text   
    }
