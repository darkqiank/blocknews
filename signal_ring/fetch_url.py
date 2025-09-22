import requests
import os
from dotenv import load_dotenv
from datetime import datetime
import json
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import textwrap
import hashlib
load_dotenv()

url = os.getenv("FEED_URL")
user_infos_url = os.getenv("USER_INFOS_URL")
cdn_url = os.getenv("CDN_URL")

# 创建文件夹
avatars_dir = './avatars'
cards_dir = './cards'

if not os.path.exists(avatars_dir):
    os.makedirs(avatars_dir)
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

def fetch_user_infos():
    response = requests.get(user_infos_url)
    res_data = response.json()
    users = res_data['data']
    # 返回样例 [{"user_id":"2922970825","user_name":"ipencil铅笔哥🔆","screen_name":"AdleyWang","user_link":"https://x.com/AdleyWang","avatar":"https://pbs.twimg.com/profile_images/1824077086484783105/V8qbSd3q_normal.jpg","expire":false,"created_at":"2025-09-15T03:19:11.240099+00:00","updated_at":"2025-09-15T03:19:11.240099+00:00"}, ...]
    return users
        

def parse_data_to_msg(data):
    """
    用户名称 + ai总结内容 + 时间（xx小时、xx分钟、刚刚）
    """
    msgs = []
    for item in data:
        user_name = item['username']
        ai_summary = item['more_info']['ai_result']['summary']
        time = item['created_at']
        time_str_ago = time_ago(time)
        msg = f"@{user_name} : {ai_summary} {time_str_ago}"
        msgs.append(msg)
    return msgs

def download_avatar(avatar_url, size=(60, 60)):
    """
    下载并处理用户头像
    """
    try:
        avatar_url_hash = hashlib.md5(avatar_url.encode()).hexdigest()
        # 判断头像是否存在
        avatar_url_path = f'./avatars/{avatar_url_hash}.png'

        if os.path.exists(avatar_url_path):
            avatar = Image.open(avatar_url_path)
        else:
            response = requests.get(f'{cdn_url}{avatar_url}', timeout=10)
            print(f'{cdn_url}{avatar_url}')
            avatar = Image.open(BytesIO(response.content))
            avatar.save(avatar_url_path)
        
        # 转换为圆形头像
        avatar = avatar.resize(size, Image.Resampling.LANCZOS)
        
        # 创建圆形遮罩
        mask = Image.new('L', size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size[0], size[1]), fill=255)
        
        # 应用圆形遮罩
        avatar.putalpha(mask)
        return avatar
    except Exception as e:
        print(f"Failed to download avatar: {e}")
        # 返回默认头像
        avatar = Image.new('RGBA', size, (128, 128, 128, 255))
        draw = ImageDraw.Draw(avatar)
        draw.ellipse((0, 0, size[0], size[1]), fill=(200, 200, 200, 255))
        return avatar

def get_font(size=16):
    """
    获取字体，优先使用系统字体
    """
    font_paths = [
        # macOS 字体
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        # Windows 字体
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/arial.ttf",
        # Linux 字体
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    
    for font_path in font_paths:
        try:
            if os.path.exists(font_path):
                return ImageFont.truetype(font_path, size)
        except:
            continue
    
    # 使用默认字体
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()

def wrap_text(text, font, max_width):
    """
    文本换行处理（支持中英文混排）。
    - 优先按空格分词换行；
    - 若单词过长或无空格，则按字符级回退换行，保证不越界。
    """
    if not text:
        return []

    def measure_width(s: str) -> int:
        bbox = font.getbbox(s)
        return bbox[2] - bbox[0]

    lines = []
    current_line = ""

    # 若存在空格，按词优先；否则按字符处理
    tokens = text.split(" ") if " " in text else list(text)

    i = 0
    while i < len(tokens):
        token = tokens[i]
        # 词模式：需要把空格补回去
        candidate = (current_line + (" " if current_line and " " in text else "") + token) if current_line else token
        if measure_width(candidate) <= max_width:
            current_line = candidate
            i += 1
            continue

        # 如果当前行为空且 token 本身就超宽，回退为字符级切分该 token
        if not current_line and len(token) > 1:
            sub_line = ""
            for ch in token:
                if measure_width(sub_line + ch) <= max_width:
                    sub_line += ch
                else:
                    if sub_line:
                        lines.append(sub_line)
                    sub_line = ch
            if sub_line:
                current_line = sub_line
            i += 1
            continue

        # 将当前行提交，重新开始
        if current_line:
            lines.append(current_line)
            current_line = ""
        else:
            # 兜底：即使单字符过宽（极少见），也直接放入一行
            lines.append(token)
            i += 1

    if current_line:
        lines.append(current_line)

    return lines

def render_x_card(data):
    """
    渲染x卡片 - 将所有消息放在一张图片中
    """
    if not data:
        return None
    
    # 获取用户信息
    users = fetch_user_infos()
    user_dict = {user['user_id']: user for user in users}

    # 画布与布局（更高分辨率 + 更紧凑 + 双栏布局）
    card_width = 1080  # 提高分辨率宽度
    outer_margin_h = 24  # 左右边距
    outer_margin_v = 20  # 上下边距
    header_height = 64   # 顶部标题高度
    padding = 16  # 卡片内边距
    avatar_size = 40  # 头像进一步缩小，突出AI摘要
    card_spacing = 12  # 卡片之间的间距

    # 字体（适配高分辨率，缩小头像昵称字体，增大摘要字体）
    username_font = get_font(14)  # 缩小用户名字体
    summary_font = get_font(18)   # 增大AI摘要字体，使其更突出
    time_font = get_font(12)      # 缩小时间字体

    # 行高根据字体测量，略加间距，更紧凑
    def font_height(font_obj):
        bbox = font_obj.getbbox("汉HgAy")
        return (bbox[3] - bbox[1])

    username_line_h = font_height(username_font)
    summary_line_h = font_height(summary_font) + 2
    time_line_h = font_height(time_font)

    inner_width = card_width - outer_margin_h * 2

    # 预处理每条数据，计算需要的高度和断行
    processed = []
    max_summary_lines = 8  # 增加AI摘要最多显示行数，给予更多展示空间

    for item in data:
        user_id = item.get('user_id', '')
        user_name = item.get('username', 'Unknown User')
        nick_name = user_dict.get(user_id, {}).get('user_name', '')
        ai_summary = (item.get('more_info', {}).get('ai_result', {}) or {}).get('summary', '') or ''
        created_at = item.get('created_at')
        time_str_ago = time_ago(created_at) if created_at else ''

        avatar_url = user_dict.get(user_id, {}).get('avatar')

        # 左栏宽度（头像 + 名称 + 余量）与右栏（摘要）- 缩小左栏，扩大右栏给AI摘要更多空间
        left_col_width = min(320, int(inner_width * 0.32))  # 缩小左栏比例
        name_text_x = padding + avatar_size + 8  # 减少间距
        name_available_w = left_col_width - (name_text_x) - padding
        separator_x = left_col_width + 8
        summary_x = separator_x + 12
        summary_width = inner_width - summary_x - padding  # AI摘要获得更多宽度

        # 右侧摘要断行
        summary_lines_all = wrap_text(ai_summary, summary_font, summary_width)
        summary_lines = summary_lines_all[:max_summary_lines]

        # 高度计算：左侧为 昵称 + 用户名 + 时间
        left_block_h = max(avatar_size, username_line_h + 4 + username_line_h + 4 + time_line_h)
        right_block_h = len(summary_lines) * summary_line_h
        card_height = padding + max(left_block_h, right_block_h, avatar_size) + padding

        processed.append({
            'user_name': user_name,
            'nick_name': nick_name,
            'time_str_ago': time_str_ago,
            'avatar_url': avatar_url,
            'summary_lines': summary_lines,
            'left_col_width': left_col_width,
            'name_text_x': name_text_x,
            'name_available_w': name_available_w,
            'separator_x': separator_x,
            'summary_x': summary_x,
            'summary_width': summary_width,
            'card_height': card_height,
        })

    # 计算总高度并创建画布
    total_height = outer_margin_v + header_height + 12 + sum(p['card_height'] for p in processed) + card_spacing * (max(len(processed) - 1, 0)) + outer_margin_v
    big_image = Image.new('RGB', (card_width, total_height), (245, 245, 245))

    # 绘制标题
    header_draw = ImageDraw.Draw(big_image)
    title_font = get_font(28)
    title_text = "BeNotify 最新信号"
    # 左侧彩色竖条
    header_draw.rectangle([(outer_margin_h, outer_margin_v + 16), (outer_margin_h + 6, outer_margin_v + header_height - 16)], fill=(24, 119, 242))
    header_draw.text((outer_margin_h + 16, outer_margin_v + (header_height - title_font.getbbox(title_text)[3]) // 2 + 6), title_text, font=title_font, fill=(30, 30, 30))

    current_y = outer_margin_v + header_height + 12

    for p in processed:
        card_h = p['card_height']
        card = Image.new('RGB', (inner_width, card_h), (255, 255, 255))
        draw = ImageDraw.Draw(card)

        # 阴影（简易）
        shadow_offset = 2
        shadow = Image.new('RGB', (inner_width, card_h), (0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.rounded_rectangle([(0, 0), (inner_width - 1, card_h - 1)], radius=12, fill=(0, 0, 0))
        shadow = shadow.point(lambda p: int(p * 0.04))
        big_image.paste(shadow, (outer_margin_h + shadow_offset, current_y + shadow_offset))

        # 卡片底
        draw.rounded_rectangle([(0, 0), (inner_width - 1, card_h - 1)], radius=12, outline=(220, 220, 220), width=1, fill=(255, 255, 255))

        # 头像
        if p['avatar_url']:
            avatar = download_avatar(p['avatar_url'], (avatar_size, avatar_size))
            card.paste(avatar, (padding, padding), avatar)
        else:
            draw.ellipse([padding, padding, padding + avatar_size, padding + avatar_size], fill=(200, 200, 200), outline=(150, 150, 150))

        # 昵称（第一行）与用户名（第二行）
        username_y = padding + 2

        def measure_width(font_obj, s: str) -> int:
            bbox = font_obj.getbbox(s)
            return bbox[2] - bbox[0]

        def truncate_to_width(text: str, font_obj, max_w: int) -> str:
            if measure_width(font_obj, text) <= max_w:
                return text
            out = ""
            for ch in text:
                if measure_width(font_obj, out + ch + "...") <= max_w:
                    out += ch
                else:
                    break
            return out + "..."

        # 左列起点和可用宽度
        name_x = p['name_text_x']
        available_name_w = p['name_available_w']
        username_text = f"@{p['user_name']}"
        nick_text = (p.get('nick_name') or '').strip()

        if nick_text:
            nick_draw = truncate_to_width(nick_text, username_font, available_name_w)
            draw.text((name_x, username_y), nick_draw, font=username_font, fill=(40, 40, 40))
            # 第二行：@username
            username_draw = truncate_to_width(username_text, username_font, available_name_w)
            draw.text((name_x, username_y + username_line_h + 4), username_draw, font=username_font, fill=(110, 110, 110))
            # 时间（第三行）
            draw.text((name_x, username_y + username_line_h * 2 + 8), p['time_str_ago'], font=time_font, fill=(128, 128, 128))
        else:
            # 只有用户名
            username_draw = truncate_to_width(username_text, username_font, available_name_w)
            draw.text((name_x, username_y), username_draw, font=username_font, fill=(40, 40, 40))
            draw.text((name_x, username_y + username_line_h + 6), p['time_str_ago'], font=time_font, fill=(128, 128, 128))

        # 中间竖分隔线
        draw.line([(p['separator_x'], padding), (p['separator_x'], card_h - padding)], fill=(230, 230, 230), width=1)

        # 右列摘要（更突出的样式）
        summary_y = padding + 2
        summary_color = (16, 94, 218)  # 更深的蓝色，增强可读性
        
        # 为AI摘要添加轻微的背景高亮
        if p['summary_lines']:
            summary_bg_height = len(p['summary_lines']) * summary_line_h + 8
            draw.rounded_rectangle([
                (p['summary_x'] - 4, summary_y - 4), 
                (p['summary_x'] + p['summary_width'], summary_y + summary_bg_height)
            ], radius=6, fill=(248, 251, 255), outline=(220, 235, 255), width=1)
        
        # 绘制AI摘要文本
        for i, line in enumerate(p['summary_lines']):
            draw.text((p['summary_x'], summary_y + i * summary_line_h), line, font=summary_font, fill=summary_color)

        # 粘贴到大图
        big_image.paste(card, (outer_margin_h, current_y))
        current_y += card_h + card_spacing

    return big_image

def save_card(card, output_dir="cards"):
    """
    保存生成的卡片图片
    """
    if card is None:
        print("No card to save")
        return None
        
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    filename = f"x_cards_combined_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    filepath = os.path.join(output_dir, filename)
    card.save(filepath, 'PNG')
    print(f"Combined card saved: {filepath}")
    
    return filepath

if __name__ == "__main__":
    data = fetch_data() 
    
    # 生成文本消息
    msgs = parse_data_to_msg(data)
    print("Generated messages:")
    for msg in msgs:
        print(msg)
    
    print("\n" + "="*50)
    print("Generating combined X card...")
    
    # 生成合并的图片卡片
    combined_card = render_x_card(data)
    saved_file = save_card(combined_card)
    
    if saved_file:
        print(f"\nGenerated combined card with {len(data)} messages successfully!")
        print(f"Saved file: {saved_file}")
    else:
        print("Failed to generate card")