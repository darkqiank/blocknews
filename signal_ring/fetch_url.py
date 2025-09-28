import requests
import os
import platform
import subprocess
from shutil import which
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()

url = os.getenv("FEED_URL")
x_snapshot_url = os.getenv("X_SNAPSHOT_URL")
# 创建文件夹
cards_dir = './cards'

if not os.path.exists(cards_dir):
    os.makedirs(cards_dir)

def time_ago(time_str):
    """
    将 'Sun Sep 21 23:16:59 +0000 2025' 转换为多久前
    """
    # 解析 Twitter 格式时间
    past = datetime.fromisoformat(time_str)
    now = datetime.now(past.tzinfo)  # 保持时区一致

    diff = now - past
    seconds = diff.total_seconds()

    if seconds < 60:
        return "刚刚"
    elif seconds < 3600:
        return f"{int(seconds // 60)} 分钟前"
    elif seconds < 86400:
        return f"{int(seconds // 3600)} 小时前"
    elif seconds < 2592000:  # 30天
        return f"{int(seconds // 86400)} 天前"
    elif seconds < 31536000:  # 12个月
        return f"{int(seconds // 2592000)} 个月前"
    else:
        return f"{int(seconds // 31536000)} 年前"

def fetch_data():
    response = requests.get(url)
    res_data =response.json()
    return res_data['data']       

def parse_data_to_msg(data):
    """
    用户名称 + ai总结内容 + 时间（xx小时、xx分钟、刚刚）
    """
    user_name = data['username']
    ai_summary = data['more_info']['ai_result']['summary']
    time = data['created_at']
    time_str_ago = time_ago(time)
    msg = f"@{user_name} : {ai_summary} {time_str_ago}"
    return msg

def download_snapshot_image(data):
    # 图片获取
    x_id = data['x_id']
    x_snapshot_file = f"{cards_dir}/{x_id}.png"
    if os.path.exists(x_snapshot_file):
        return
    response = requests.get(f"{x_snapshot_url}/{x_id}")
    if response.status_code == 200:
        with open(x_snapshot_file, "wb") as f:
            f.write(response.content)
    else:
        print(f"Failed to download snapshot image for {x_id}")


def copy_to_clipboard(text):
    """Copy text to system clipboard with best-effort fallbacks."""
    try:
        import pyperclip  # type: ignore

        pyperclip.copy(text)
        return True
    except Exception:
        pass

    system = platform.system()

    try:
        if system == "Darwin":
            subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=True)
            return True
        if system == "Windows":
            subprocess.run(["clip"], input=text.encode("utf-16le"), check=True)
            return True

        if which("xclip"):
            subprocess.run(["xclip", "-selection", "clipboard"], input=text.encode("utf-8"), check=True)
            return True
        if which("xsel"):
            subprocess.run(["xsel", "--clipboard", "--input"], input=text.encode("utf-8"), check=True)
            return True
    except Exception as exc:
        print(f"复制到剪贴板失败: {exc}")

    return False


if __name__ == "__main__":
    datas = fetch_data() 
    messages = []

    # 生成文本消息
    for data in datas:
        msg = parse_data_to_msg(data)
        print(msg)
        messages.append(msg)
        download_snapshot_image(data)
        print("下载图片成功")

    if messages and copy_to_clipboard("\n".join(messages)):
        print("全部消息已复制到剪贴板")
    elif messages:
        print("请手动复制以上消息")
