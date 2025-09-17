from openai import OpenAI
import os
import json
import re
from typing import List, Dict, Any
from datetime import datetime

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    base_url=os.environ.get("OPENAI_BASE_URL"),
)
base_model = os.environ.get("OPENAI_BASE_MODEL")

base_system_prompt = ""

with open('./prompts/x_signal.txt', 'r', encoding='utf-8') as file:
    base_system_prompt = file.read()


def call_llm_api(prompt):
    """调用 OpenAI API 进行推文分析"""
    try:
        # 检查必要的配置
        if not base_model:
            return "API配置错误: OPENAI_BASE_MODEL 环境变量未设置"
        
        if not client.api_key:
            return "API配置错误: OPENAI_API_KEY 环境变量未设置"
        
        print(f"使用模型: {base_model}")
        print(f"API Base URL: {client.base_url}")
        
        stream = client.chat.completions.create(
            model=base_model,
            max_tokens=20000,
            stream=True,
            messages=[
                {"role": "system", "content": base_system_prompt},
                {"role": "user", "content": prompt},
            ],
        )
        
        # 收集流式响应的内容
        content = ""
        for chunk in stream:
            # 检查是否有choices且不为空
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if delta.content is not None:
                    chunk_content = delta.content
                    content += chunk_content

        return content
    except Exception as e:
        print(f"API调用详细错误: {e}")
        import traceback
        traceback.print_exc()
        return f"API调用失败: {str(e)}"


# 从数据库读取最新的推文数据，支持过滤已分析的内容
def get_latest_x_data(limit: int = 20, skip_analyzed: bool = True) -> List[Dict[str, Any]]:
    """
    获取最新的推文数据
    Args:
        limit: 要获取的数据条数
        skip_analyzed: 是否跳过已分析的内容
    Returns:
        推文数据列表
    """
    from db_utils import get_db_connection
    import psycopg2.extras
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            if skip_analyzed:
                # 过滤已分析的内容（data中不包含ai_result字段）
                query = """
                    SELECT id, x_id, item_type, data, username, user_id, user_link, created_at 
                    FROM t_x 
                    WHERE NOT (data ? 'ai_result')
                    ORDER BY created_at DESC 
                    LIMIT %s
                """
            else:
                # 获取所有数据
                query = """
                    SELECT id, x_id, item_type, data, username, user_id, user_link, created_at 
                    FROM t_x 
                    ORDER BY created_at DESC 
                    LIMIT %s
                """
            
            cur.execute(query, (limit,))
            rows = cur.fetchall()
            
            # 转换为字典列表
            results = []
            for row in rows:
                result = dict(row)
                # 确保 created_at 是字符串格式
                if result['created_at']:
                    result['created_at'] = result['created_at'].isoformat()
                results.append(result)
            
            return results
    
    except Exception as e:
        print(f"Error fetching X data: {e}")
        raise
    finally:
        if conn:
            conn.close()


# 解析推文内容，参考前端渲染逻辑
def extract_tweet_content(data: Dict[str, Any]) -> str:
    """从推文数据中提取正文内容"""
    content_parts = []
    
    # 处理单个推文数据
    def process_single_tweet(tweet_data: Dict[str, Any]) -> str:
        full_text = tweet_data.get('full_text', '')
        if not full_text:
            return ''
        
        # 移除多余的空白字符
        full_text = re.sub(r'\s+', ' ', full_text.strip())
        
        # 处理转推和引用的分割
        # 在正文中遇到 "RT @" 或 "quoted From @"（非开头）插入分割标记
        separator_regex = r'(RT\s@|quoted From\s@)'
        first_non_ws = next((i for i, c in enumerate(full_text) if not c.isspace()), 0)
        
        parts = []
        for match in re.finditer(separator_regex, full_text, re.IGNORECASE):
            idx = match.start()
            if idx > first_non_ws:  # 不在开头
                before = full_text[:idx].strip()
                after = full_text[idx:].strip()
                if before:
                    parts.append(before)
                if after:
                    prefix = '转推: ' if after.lower().startswith('rt @') else '引用: '
                    parts.append(prefix + after)
                return ' | '.join(parts)
        
        return full_text
    
    # 根据数据类型处理
    if isinstance(data, list):
        # profile-conversation 类型
        for item in data:
            if isinstance(item, dict) and 'data' in item:
                tweet_content = process_single_tweet(item['data'])
                if tweet_content:
                    content_parts.append(tweet_content)
    elif isinstance(data, dict):
        # 单个推文类型
        tweet_content = process_single_tweet(data)
        if tweet_content:
            content_parts.append(tweet_content)
    
    return ' | '.join(content_parts)


# 调用LLM分析推文
def analyze_x_data(x_data: List[Dict[str, Any]]) -> str:
    """分析推文数据并返回LLM结果"""
    # 构建推文内容字符串
    tweet_contents = []
    
    for item in x_data:
        x_id = item.get('x_id', '')
        username = item.get('username', '')
        user_id = item.get('user_id', '')
        
        # 解析推文内容
        try:
            data = item.get('data')
            if isinstance(data, str):
                data = json.loads(data)
            
            content = extract_tweet_content(data)
            if content:
                tweet_info = f"x_id: {x_id}\n用户: @{username} ({user_id})\n内容: {content}\n"
                tweet_contents.append(tweet_info)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error parsing tweet data for {x_id}: {e}")
            continue
    
    if not tweet_contents:
        return '[]'  # 返回空的JSON数组
    
    # 构建推文内容作为用户输入
    tweets_text = "\n" + "="*50 + "\n".join(tweet_contents)
    
    result = call_llm_api(tweets_text)
    return result


def parse_llm_result(result: str) -> List[Dict[str, Any]]:
    """解析LLM返回的JSON结果"""
    if not result or not result.strip():
        return []
    
    try:
        # 尝试直接解析JSON
        parsed = json.loads(result.strip())
        
        # 如果是单个对象，转换为数组
        if isinstance(parsed, dict):
            parsed = [parsed]
        
        # 验证每个结果的格式
        valid_results = []
        for item in parsed:
            if isinstance(item, dict) and 'x_id' in item:
                # 清理和验证数据
                clean_item = {
                    'x_id': str(item['x_id']),
                    'summary': str(item.get('summary', '')).strip(),
                    'highlight_label': item.get('highlight_label', []),
                    "model": base_model
                }
                
                # 确保 highlight_label 是数组
                if not isinstance(clean_item['highlight_label'], list):
                    clean_item['highlight_label'] = []
                
                # 清理 highlight_label 中的元素
                clean_item['highlight_label'] = [
                    str(label).strip() for label in clean_item['highlight_label'] 
                    if str(label).strip()
                ]
                
                if clean_item['summary']:  # 只有有summary的才保留
                    valid_results.append(clean_item)
        
        return valid_results
        
    except json.JSONDecodeError:
        # 如果JSON解析失败，尝试提取JSON块
        print(f"JSON解析失败，尝试提取JSON块...")
        
        # 使用正则提取JSON块
        json_pattern = r'\[\s*\{[^}]*\}(?:\s*,\s*\{[^}]*\})*\s*\]|\{[^}]*\}'
        matches = re.findall(json_pattern, result, re.DOTALL)
        
        for match in matches:
            try:
                parsed = json.loads(match)
                if isinstance(parsed, dict):
                    parsed = [parsed]
                return parse_llm_result(json.dumps(parsed))  # 递归调用
            except json.JSONDecodeError:
                continue
        
        print(f"Unable to parse LLM result: {result[:200]}...")
        return []
    
    except Exception as e:
        print(f"Error parsing LLM result: {e}")
        return []

def save_llm_result(ai_results: List[Dict[str, Any]], analyzed_x_ids: List[str]) -> None:
    """将AI分析结果保存到数据库，并标记所有已分析的推文"""
    from db_utils import get_db_connection
    
    conn = None
    try:
        conn = get_db_connection()
        updated_count = 0
        
        with conn.cursor() as cur:
            # 先处理有AI分析结果的推文
            for result in ai_results:
                x_id = result['x_id']
                
                # 获取当前记录的data字段
                cur.execute("SELECT data FROM t_x WHERE x_id = %s", (x_id,))
                row = cur.fetchone()
                
                if not row:
                    print(f"Warning: No record found for x_id: {x_id}")
                    continue
                
                current_data = row[0]
                if isinstance(current_data, str):
                    current_data = json.loads(current_data)
                
                # 在data中添加ai_result字段（重要信号）
                current_data['ai_result'] = {
                    'summary': result['summary'],
                    'highlight_label': result['highlight_label'],
                    'analyzed_at': datetime.now().isoformat(),
                    'is_important': True
                }
                
                # 更新数据库
                cur.execute(
                    "UPDATE t_x SET data = %s WHERE x_id = %s",
                    (json.dumps(current_data), x_id)
                )
                updated_count += 1
            
            # 处理已分析但无重要信号的推文
            result_x_ids = {result['x_id'] for result in ai_results}
            no_signal_x_ids = [x_id for x_id in analyzed_x_ids if x_id not in result_x_ids]
            
            for x_id in no_signal_x_ids:
                # 获取当前记录的data字段
                cur.execute("SELECT data FROM t_x WHERE x_id = %s", (x_id,))
                row = cur.fetchone()
                
                if not row:
                    continue
                
                current_data = row[0]
                if isinstance(current_data, str):
                    current_data = json.loads(current_data)
                
                # 标记为已分析但无重要信号
                current_data['ai_result'] = {
                    'analyzed_at': datetime.now().isoformat(),
                    'is_important': False,
                    'summary': None,
                    'highlight_label': []
                }
                
                # 更新数据库
                cur.execute(
                    "UPDATE t_x SET data = %s WHERE x_id = %s",
                    (json.dumps(current_data), x_id)
                )
                updated_count += 1
        
        conn.commit()
        print(f"Successfully updated {updated_count} records:")
        print(f"  - {len(ai_results)} records with important signals")
        print(f"  - {len(no_signal_x_ids)} records marked as analyzed (no important signals)")
        
    except Exception as e:
        print(f"Error saving AI results: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


def main():
    print(f"🚀 开始获取推文数据...")
    x_data = get_latest_x_data(limit=20, skip_analyzed=False)
        
    if not x_data:
        print("⚠️ 未找到任何推文数据")
        return
        
    print(f"📊 找到 {len(x_data)} 条需要分析的推文")
    
    # 记录所有要分析的推文ID
    analyzed_x_ids = [item['x_id'] for item in x_data]
        
    # AI分析
    print(f"🤖 开始AI分析...")
    llm_result = analyze_x_data(x_data)
        
    if not llm_result or llm_result.strip() == '[]':
        print("⚠️ AI分析未返回有效结果")
        # 即使没有结果，也要标记这些推文已经被分析过
        print("📝 标记推文为已分析（无重要信号）...")
        save_llm_result([], analyzed_x_ids)
        return
        
    # 解析结果
    print(f"🔍 解析AI返回结果...")
    parsed_results = parse_llm_result(llm_result)
        
    if not parsed_results:
        print(f"⚠️ 未能解析出AI结果")
        print(f"AI原始返回: {llm_result[:500]}...")
        # 标记为已分析但无有效结果
        print("📝 标记推文为已分析（解析失败）...")
        save_llm_result([], analyzed_x_ids)
        return
        
    print(f"🎉 成功解析出 {len(parsed_results)} 条高价值信号")
        
    # 显示结果预览
    for result in parsed_results[:5]:
        print(f"  • {result['x_id']}: {result['summary']} [{', '.join(result['highlight_label'])}]")
    
    # 保存结果
    print(f"💾 保存AI分析结果...")
    save_llm_result(parsed_results, analyzed_x_ids)
    
    print(f"✅ 完成！共处理了 {len(analyzed_x_ids)} 条推文，其中 {len(parsed_results)} 条为高价值信号")


if __name__ == "__main__":
    main()