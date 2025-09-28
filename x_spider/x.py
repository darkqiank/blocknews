from collections import UserString
from curl_cffi import requests
import json
from x_parser import parse_user_timeline
import time
import os
from datetime import datetime
import pytz
from db_utils import get_all_x_users
from dotenv import load_dotenv

load_dotenv()


with open('./headers.json', 'r', encoding='utf-8') as file:
    cookie = json.load(file)


def xx(user_id):
    try:
        url = f"https://x.com/i/api/graphql/E3opETHurmVJflFsUBVuUQ/UserTweets?variables=%7B%22userId%22%3A%22{user_id}%22%2C%22count%22%3A20%2C%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D"

        payload = ""
        headers = cookie.get('headers')
        headers["referer"] = "x.com"
        headers["user-agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0"
        

        response = requests.request("GET", url, headers=headers, data=payload, impersonate="chrome124", timeout=30)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Error fetching user tweets: {e}")
        return None


def upload_to_db(data):
    from db_utils import insert_x_data
    try:
        insert_x_data(data)
    except Exception as e:
        print(f"Error uploading to database: {e}")

# xx("129711053", "https://x.com/StopMalvertisin")
# exit()

# with open('users.json', 'r', encoding='utf-8') as uf:
#     users = json.load(uf)

users = get_all_x_users()


timezone = pytz.timezone('Asia/Shanghai')
current_time = datetime.now(timezone)
formatted_cur_day = current_time.strftime('%Y-%m-%d')
output_name = os.path.join('risk', 'twitter', f'{formatted_cur_day}.json')
output_datas = {}

for user in users:
    username = user.get('screen_name')
    user_id = user.get('user_id')
    user_link = user.get('user_link')

    if not user.get('expire'):
        x_data_raw = xx(user_id)
        # with open(f'{user_id}.json',  'w', encoding='utf-8') as f:
        #     json.dump(x_data_raw, f, ensure_ascii=False, indent=4)
        if x_data_raw:
            x_items = parse_user_timeline(x_data_raw)
            print(f'user {username} 爬取到 {len(x_items)} 条twitter！')
            for x_item in x_items:
                x_item['username'] = username
                x_item['user_id'] = user_id
                x_item['user_link'] = user_link
                output_datas[x_item['x_id']] = x_item
            # print(x_items)
        time.sleep(2)

upload_to_db(output_datas)

# with open('output_2.json', 'w', encoding='utf-8') as f:
#     json.dump(output_datas, f, ensure_ascii=False, indent=4)