import getpass
import jwt
import time

payload = {
    "role": "webuser"
}

role = input("请输入角色(默认webuser): ")
if role == "":
    role = "webuser"
payload["role"] = role

# 隐藏输入
key = getpass.getpass("请输入JWT密钥: ")

# 是否有效期
validity = input("是否有效期(y/n): ")
if validity == "y":
    payload["exp"] = int(time.time()) + 3600
else:
    payload["exp"] = None

token = jwt.encode(payload, key, algorithm="HS256")
print(token)


'''
curl "http://127.0.0.1:4444/todos" -H "Authorization: Bearer xxxx"
'''