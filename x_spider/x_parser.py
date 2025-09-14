import json
from logging import NullHandler
import re
import traceback

def extract_tweet_id(text):
    match = re.search(r'(tweet-(\d+))', text)
    if match:
        return match.group(1)
    return text

def parse_user_timeline(data):
    x_items = []
    try:
        timelines_result = data.get("data").get("user").get("result")
        if timelines_result.get("timeline_v2"):
            timelines = timelines_result.get("timeline_v2").get("timeline")
        else:
            timelines = timelines_result.get("timeline").get("timeline")
        # timelines = data.get("data").get("user").get("result").get("timeline_v2").get("timeline")
        instructions = timelines.get("instructions")
    except Exception as e:
        print("获取timeline错误", e)
        return x_items
    for instruction in instructions:
        try:
            _type = instruction.get("type")
            if _type == "TimelineAddEntries":
                entries = instruction.get("entries")
                for entry in entries:
                    entryId = entry.get("entryId")
                    print(entryId)
                    if str(entryId).startswith("who-to-follow"):
                        continue
                    content = entry.get("content")
                    if content.get("entryType") == "TimelineTimelineItem":
                        itemContent = content.get("itemContent")
                        x_item = parse_timeline_tweet_item(entryId, itemContent)
                        x_item['created_at'] = x_item.get("data", {}).get("created_at")
                        # print(x_item)
                        x_items.append(x_item)
                    elif content.get("entryType") == "TimelineTimelineModule":
                        x_id_list = []
                        x_item = {'x_id': entryId, 'itemType': "TimelineTimelineModule", 'data': []}
                        for item in content.get("items"):
                            _entryId = item.get("entryId")
                            _itemContent = item.get("item").get("itemContent")
                            parsed_data = parse_timeline_tweet_item(_entryId, _itemContent)
                            x_id_list.append(parsed_data['x_id'])
                            x_item['data'].append(parsed_data)
                            if not x_item.get("created_at"):
                                x_item['created_at'] = parsed_data.get("data", {}).get("created_at")
                        x_item['x_id'] = 'profile-conversation-' + '-'.join(x_id_list)
                        # print(x_item)
                        x_items.append(x_item)
        except Exception as e:
            print("解析单条twitter 错误 ", e)
            traceback.print_exc()
    return x_items


def parse_text_from_tweet(tweet_results):
    legacy_full_text = None
    note_tweet_full_text = None
    quoted_full_text = None
    retweeted_full_text = None

    legacy = tweet_results.get('legacy')
    if not legacy:
        legacy = tweet_results.get('tweet').get('legacy')
    
    legacy_full_text = legacy.get('full_text')

    if tweet_results.get('note_tweet'):
        note_tweet_full_text = tweet_results.get('note_tweet_results', {}).get('result', {}).get('text')

    if tweet_results.get('quoted_status_result'):
        quoted_status_result = tweet_results.get('quoted_status_result', {}).get('result')
        # print(quoted_status_result)

        if quoted_status_result:
            quoted_full_text = parse_text_from_tweet(quoted_status_result)
            if quoted_full_text: 
                quoted_user_name = quoted_status_result.get('core', {}).get('user_results', {}).get('result', {}).get('legacy', {}).get('screen_name', '')
                if not quoted_user_name:
                    quoted_user_name = quoted_status_result.get('core', {}).get('user_results', {}).get('result', {}).get('core', {}).get('screen_name', '')
                quoted_full_text = 'quoted From @' + quoted_user_name + ': ' + quoted_full_text

    if legacy.get('retweeted_status_result'):
        retweeted_status_result = legacy.get('retweeted_status_result').get('result')
        if retweeted_status_result:
            retweeted_full_text = parse_text_from_tweet(retweeted_status_result)
            if retweeted_full_text:
                retweeted_user_name = retweeted_status_result.get('core', {}).get('user_results', {}).get('result', {}).get('legacy', {}).get('screen_name', '')
                if not retweeted_user_name:
                    retweeted_user_name = retweeted_status_result.get('core', {}).get('user_results', {}).get('result', {}).get('core', {}).get('screen_name', '')
                retweeted_full_text = 'RT @' + retweeted_user_name + ': ' + retweeted_full_text

    full_text = legacy_full_text
    if note_tweet_full_text:
        full_text = note_tweet_full_text
    if retweeted_full_text:
        full_text = retweeted_full_text
    if quoted_full_text:
        full_text = f'{full_text}\n{quoted_full_text}'
    return full_text


def parse_timeline_tweet_item(entryId, itemContent):
    itemType = itemContent.get('itemType')
    x_item = {}
    x_item['x_id'] = extract_tweet_id(entryId)
    x_item['itemType'] = itemType
    if itemType == "TimelineTweet":
        tweet_results = itemContent.get("tweet_results").get("result")
        legacy = tweet_results.get('legacy')
        if not legacy:
            legacy = tweet_results.get('tweet').get('legacy')
        x_data = {}
        x_data['created_at'] = legacy.get('created_at')
        x_data['bookmark_count'] = legacy.get('bookmark_count')
        x_data['favorite_count'] = legacy.get('favorite_count')
        full_text = parse_text_from_tweet(tweet_results)
        x_data['full_text'] = full_text

        # 添加外链和多媒体内容解析
        x_urls = {}
        x_medias = {}

        entities = legacy.get('entities')
        if entities:
            e_urls = entities.get("urls")
            if e_urls:
                for e_url in e_urls:
                    url_tag = e_url.get('url')
                    if url_tag:
                        tmp_list = x_urls.get(url_tag, [])
                        if e_url.get('expanded_url') not in tmp_list:
                            tmp_list.append(e_url.get('expanded_url'))
                        x_urls[url_tag] = tmp_list
            medias = entities.get("media")
            if medias:
                for media in medias:
                    media_tag = media.get('url')
                    if media_tag:
                        tmp_list = x_medias.get(media_tag, [])
                        if media.get('media_url_https') not in tmp_list:
                            tmp_list.append(media.get('media_url_https'))
                        x_medias[media_tag] = tmp_list

        extended_entities = legacy.get('extended_entities')
        if extended_entities:
            e_urls = extended_entities.get("urls")
            if e_urls:
                for e_url in e_urls:
                    url_tag = e_url.get('url')
                    if url_tag:
                        tmp_list = x_urls.get(url_tag, [])
                        if e_url.get('expanded_url') not in tmp_list:
                            tmp_list.append(e_url.get('expanded_url'))
                        x_urls[url_tag] = tmp_list
            medias = extended_entities.get("media")
            if medias:
                for media in medias:
                    media_tag = media.get('url')
                    if media_tag:
                        tmp_list = x_medias.get(media_tag, [])
                        if media.get('media_url_https') not in tmp_list:
                            tmp_list.append(media.get('media_url_https'))
                        x_medias[media_tag] = tmp_list

        x_data['urls'] = x_urls
        x_data['medias'] = x_medias

        x_item['data'] = x_data

        return x_item


if __name__ == "__main__":
    with open('demo.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    output = parse_user_timeline(data)
    with open('output.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=4)


