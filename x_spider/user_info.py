from curl_cffi import requests
import json
from db_utils import upsert_x_user


with open('./headers.json', 'r', encoding='utf-8') as file:
    cookie = json.load(file)

def x_user_info(screen_name):
    url = f"https://x.com/i/api/graphql/96tVxbPqMZDoYB5pmzezKA/UserByScreenName?variables=%7B%22screen_name%22%3A%22{screen_name}%22%2C%22withGrokTranslatedBio%22%3Afalse%7D&features=%7B%22hidden_profile_subscriptions_enabled%22%3Atrue%2C%22payments_enabled%22%3Afalse%2C%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22subscriptions_verification_info_is_identity_verified_enabled%22%3Atrue%2C%22subscriptions_verification_info_verified_since_enabled%22%3Atrue%2C%22highlights_tweets_tab_ui_enabled%22%3Atrue%2C%22responsive_web_twitter_article_notes_tab_enabled%22%3Atrue%2C%22subscriptions_feature_can_gift_premium%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22withAuxiliaryUserLabels%22%3Atrue%7D"


    payload = ""
    headers = cookie.get('headers')
    headers["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0"
    response = requests.request("GET", url, headers=headers, data=payload, impersonate="chrome124", timeout=30)
    if response.status_code == 200:
        return response.json()
    else:
        print(response.status_code)
        


def parse_user_info(data):
    result = data.get('data').get('user').get('result')
    user_id = result.get('rest_id')
    user_name = result.get('core').get('name')
    screen_name = result.get('core').get('screen_name')
    avatar = result.get('avatar', {}).get('image_url')
    return {
        'user_id': user_id,
        'user_name': user_name,
        'screen_name': screen_name,
        'user_link': f"https://x.com/{screen_name}",
        'avatar': avatar
    }


if __name__ == "__main__":
    user_screen_name = input("请输入要抓取用户名（url后面那串字符）: ")
    if user_screen_name == "":
        print("用户名不能为空")
        exit()
    data = x_user_info(user_screen_name)
    print(data)
    user_info = parse_user_info(data)
    upsert_x_user([user_info])



