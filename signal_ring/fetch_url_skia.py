import requests
import os
from dotenv import load_dotenv
from datetime import datetime
import skia
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
    return users

def download_avatar_skia(avatar_url, size=(40, 40)):
    """
    下载并处理用户头像 - Skia版本
    """
    try:
        avatar_url_hash = hashlib.md5(avatar_url.encode()).hexdigest()
        avatar_url_path = f'./avatars/{avatar_url_hash}.png'

        if os.path.exists(avatar_url_path):
            with open(avatar_url_path, 'rb') as f:
                avatar_data = f.read()
        else:
            response = requests.get(f'{cdn_url}{avatar_url}', timeout=10)
            avatar_data = response.content
            with open(avatar_url_path, 'wb') as f:
                f.write(avatar_data)
        
        # 使用Skia处理图片
        avatar_image = skia.Image.MakeFromEncoded(avatar_data)
        if not avatar_image:
            return create_default_avatar_skia(size)
            
        # 创建表面用于绘制圆形头像
        surface = skia.Surface(size[0], size[1])
        canvas = surface.getCanvas()
        canvas.clear(skia.Color(0, 0, 0, 0))  # 透明背景
        
        # 创建圆形路径
        path = skia.Path()
        path.addCircle(size[0]/2, size[1]/2, size[0]/2)
        canvas.clipPath(path, doAntiAlias=True)
        
        # 绘制头像
        paint = skia.Paint()
        paint.setAntiAlias(True)
        
        # 计算缩放和居中
        scale_x = size[0] / avatar_image.width()
        scale_y = size[1] / avatar_image.height()
        scale = max(scale_x, scale_y)
        
        canvas.scale(scale, scale)
        offset_x = (size[0]/scale - avatar_image.width()) / 2
        offset_y = (size[1]/scale - avatar_image.height()) / 2
        
        # 使用高质量采样选项
        sampling = skia.SamplingOptions(skia.FilterMode.kLinear, skia.MipmapMode.kLinear)
        canvas.drawImage(avatar_image, offset_x, offset_y, sampling, paint)
        
        return surface.makeImageSnapshot()
    except Exception as e:
        print(f"Failed to download avatar: {e}")
        return create_default_avatar_skia(size)

def create_default_avatar_skia(size):
    """创建默认头像"""
    surface = skia.Surface(size[0], size[1])
    canvas = surface.getCanvas()
    
    paint = skia.Paint()
    paint.setAntiAlias(True)
    paint.setColor(skia.Color(200, 200, 200, 255))
    
    canvas.drawCircle(size[0]/2, size[1]/2, size[0]/2, paint)
    
    return surface.makeImageSnapshot()

def get_skia_font(size=16):
    """
    获取Skia字体
    """
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    
    for font_path in font_paths:
        try:
            if os.path.exists(font_path):
                typeface = skia.Typeface.MakeFromFile(font_path)
                if typeface:
                    return skia.Font(typeface, size)
        except:
            continue
    
    # 使用默认字体
    return skia.Font(None, size)

def measure_text_width(text, font):
    """测量文本宽度"""
    paint = skia.Paint()
    paint.setAntiAlias(True)
    # Skia的measureText方法参数顺序：text, encoding, bounds, paint
    width = font.measureText(text, skia.TextEncoding.kUTF8, None, paint)
    return width

def wrap_text_skia(text, font, max_width):
    """
    Skia版本的文本换行
    """
    if not text:
        return []
    
    lines = []
    current_line = ""
    
    tokens = text.split(" ") if " " in text else list(text)
    
    i = 0
    while i < len(tokens):
        token = tokens[i]
        candidate = (current_line + (" " if current_line and " " in text else "") + token) if current_line else token
        
        if measure_text_width(candidate, font) <= max_width:
            current_line = candidate
            i += 1
            continue
        
        if not current_line and len(token) > 1:
            sub_line = ""
            for ch in token:
                if measure_text_width(sub_line + ch, font) <= max_width:
                    sub_line += ch
                else:
                    if sub_line:
                        lines.append(sub_line)
                    sub_line = ch
            if sub_line:
                current_line = sub_line
            i += 1
            continue
        
        if current_line:
            lines.append(current_line)
            current_line = ""
        else:
            lines.append(token)
            i += 1
    
    if current_line:
        lines.append(current_line)
    
    return lines

def render_x_card_skia(data):
    """
    使用Skia渲染x卡片 - 更高质量的渲染
    """
    if not data:
        return None
    
    # 获取用户信息
    users = fetch_user_infos()
    user_dict = {user['user_id']: user for user in users}

    # 画布与布局设置
    card_width = 720
    outer_margin_h = 24
    outer_margin_v = 20
    header_height = 64
    padding = 16
    avatar_size = 40  # 小头像
    card_spacing = 12

    # 字体设置 - 突出AI摘要
    username_font = get_skia_font(14)
    summary_font = get_skia_font(18)  # AI摘要使用更大字体
    time_font = get_skia_font(12)
    title_font = get_skia_font(28)

    inner_width = card_width - outer_margin_h * 2
    max_summary_lines = 8

    # 预处理数据
    processed = []
    for item in data:
        user_id = item.get('user_id', '')
        user_name = item.get('username', 'Unknown User')
        nick_name = user_dict.get(user_id, {}).get('user_name', '')
        ai_summary = (item.get('more_info', {}).get('ai_result', {}) or {}).get('summary', '') or ''
        created_at = item.get('created_at')
        time_str_ago = time_ago(created_at) if created_at else ''
        avatar_url = user_dict.get(user_id, {}).get('avatar')

        # 布局计算 - 给AI摘要更多空间
        left_col_width = min(200, int(inner_width * 0.32))
        name_text_x = padding + avatar_size + 6
        name_available_w = left_col_width - name_text_x - padding
        separator_x = left_col_width + 6
        summary_x = separator_x + 12
        summary_width = inner_width - summary_x - padding

        # AI摘要换行
        summary_lines_all = wrap_text_skia(ai_summary, summary_font, summary_width)
        summary_lines = summary_lines_all[:max_summary_lines]

        # 计算高度
        username_height = 16
        summary_line_height = 22
        left_block_h = max(avatar_size, username_height * 2 + 16)
        right_block_h = len(summary_lines) * summary_line_height
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

    # 创建主画布
    total_height = outer_margin_v + header_height + 12 + sum(p['card_height'] for p in processed) + card_spacing * max(len(processed) - 1, 0) + outer_margin_v
    surface = skia.Surface(card_width, total_height)
    canvas = surface.getCanvas()
    
    # 背景
    canvas.clear(skia.Color(245, 245, 245, 255))
    
    # 绘制标题
    paint = skia.Paint()
    paint.setAntiAlias(True)
    
    # 标题左侧彩色条
    paint.setColor(skia.Color(24, 119, 242, 255))
    canvas.drawRect(skia.Rect(outer_margin_h, outer_margin_v + 16, outer_margin_h + 6, outer_margin_v + header_height - 16), paint)
    
    # 标题文字
    paint.setColor(skia.Color(30, 30, 30, 255))
    title_text = "BeNotify 最新信号"
    canvas.drawString(title_text, outer_margin_h + 16, outer_margin_v + header_height/2 + 10, title_font, paint)

    current_y = outer_margin_v + header_height + 12

    for p in processed:
        card_h = p['card_height']
        
        # 绘制阴影
        shadow_paint = skia.Paint()
        shadow_paint.setAntiAlias(True)
        shadow_paint.setColor(skia.Color(0, 0, 0, 10))
        shadow_rect = skia.RRect.MakeRectXY(
            skia.Rect(outer_margin_h + 2, current_y + 2, outer_margin_h + inner_width + 2, current_y + card_h + 2),
            12, 12
        )
        canvas.drawRRect(shadow_rect, shadow_paint)
        
        # 绘制卡片背景
        card_paint = skia.Paint()
        card_paint.setAntiAlias(True)
        card_paint.setColor(skia.Color(255, 255, 255, 255))
        card_rect = skia.RRect.MakeRectXY(
            skia.Rect(outer_margin_h, current_y, outer_margin_h + inner_width, current_y + card_h),
            12, 12
        )
        canvas.drawRRect(card_rect, card_paint)
        
        # 绘制卡片边框
        border_paint = skia.Paint()
        border_paint.setAntiAlias(True)
        border_paint.setStyle(skia.Paint.kStroke_Style)
        border_paint.setStrokeWidth(1)
        border_paint.setColor(skia.Color(220, 220, 220, 255))
        canvas.drawRRect(card_rect, border_paint)

        # 绘制头像
        if p['avatar_url']:
            avatar_image = download_avatar_skia(p['avatar_url'], (avatar_size, avatar_size))
            if avatar_image:
                canvas.drawImage(avatar_image, outer_margin_h + padding, current_y + padding)

        # 绘制用户信息
        text_paint = skia.Paint()
        text_paint.setAntiAlias(True)
        
        name_x = outer_margin_h + p['name_text_x']
        username_y = current_y + padding + 2
        
        # 昵称（如果有）
        if p['nick_name']:
            text_paint.setColor(skia.Color(40, 40, 40, 255))
            canvas.drawString(p['nick_name'][:20], name_x, username_y + 12, username_font, text_paint)
            
            # 用户名
            text_paint.setColor(skia.Color(110, 110, 110, 255))
            canvas.drawString(f"@{p['user_name']}"[:15], name_x, username_y + 28, username_font, text_paint)
            
            # 时间
            text_paint.setColor(skia.Color(128, 128, 128, 255))
            canvas.drawString(p['time_str_ago'], name_x, username_y + 44, time_font, text_paint)
        else:
            # 只有用户名
            text_paint.setColor(skia.Color(40, 40, 40, 255))
            canvas.drawString(f"@{p['user_name']}"[:20], name_x, username_y + 12, username_font, text_paint)
            
            text_paint.setColor(skia.Color(128, 128, 128, 255))
            canvas.drawString(p['time_str_ago'], name_x, username_y + 28, time_font, text_paint)

        # 绘制分隔线
        line_paint = skia.Paint()
        line_paint.setAntiAlias(True)
        line_paint.setColor(skia.Color(230, 230, 230, 255))
        line_paint.setStrokeWidth(1)
        separator_x = outer_margin_h + p['separator_x']
        canvas.drawLine(separator_x, current_y + padding, separator_x, current_y + card_h - padding, line_paint)

        # 绘制AI摘要文字
        summary_paint = skia.Paint()
        summary_paint.setAntiAlias(True)
        summary_paint.setColor(skia.Color(16, 94, 218, 255))  # 深蓝色
        
        summary_x = outer_margin_h + p['summary_x']
        summary_y = current_y + padding + 2
        
        for i, line in enumerate(p['summary_lines']):
            canvas.drawString(line, summary_x, summary_y + 16 + i * 22, summary_font, summary_paint)

        current_y += card_h + card_spacing

    return surface.makeImageSnapshot()

def save_card_skia(card_image, output_dir="cards"):
    """
    保存Skia生成的卡片图片
    """
    if card_image is None:
        print("No card to save")
        return None
        
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    filename = f"x_cards_skia_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    filepath = os.path.join(output_dir, filename)
    
    # 保存图片
    card_image.save(filepath, skia.kPNG)
    print(f"Skia card saved: {filepath}")
    
    return filepath

if __name__ == "__main__":
    try:
        data = fetch_data() 
        
        print("Generating Skia-based X card...")
        
        # 生成高质量的图片卡片
        skia_card = render_x_card_skia(data[:3])
        saved_file = save_card_skia(skia_card)
        
        if saved_file:
            print(f"\nGenerated high-quality Skia card with {len(data)} messages successfully!")
            print(f"Saved file: {saved_file}")
        else:
            print("Failed to generate Skia card")
            
    except ImportError:
        print("Skia-Python not installed. Please install it with: pip install skia-python")
        print("Falling back to original Pillow implementation...")
        
        # 回退到原始实现
        from fetch_url import render_x_card, save_card
        data = fetch_data()
        card = render_x_card(data)
        saved_file = save_card(card)
        
        if saved_file:
            print(f"Generated Pillow card: {saved_file}")
