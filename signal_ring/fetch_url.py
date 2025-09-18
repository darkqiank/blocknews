import requests
import os

url = os.getenv("FEED_URL")


def fetch_data():
    response = requests.get(url)
    return response.json()

def parse_data_to_msg(datas):
    """
    用户名称 + ai总结内容 + 时间（xx小时、xx分钟、刚刚） + 链接
    """
    return ""

if __name__ == "__main__":
    data = fetch_data()
    msg = parse_data_to_msg(data)
    print(msg)