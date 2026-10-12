#!/usr/bin/env python3
"""
Lấy hồ sơ công khai TikTok / Facebook.

Dùng trong @core/socialFetch.js (Node gọi qua child_process).
Lý do: Node.js không giả lập được TLS fingerprint của trình duyệt nên bị
Cloudflare chặn, còn curl_cffi (Python) giả lập được → lấy được dữ liệu.

Cách dùng:
    python3 social_info.py tiktok <username>
    python3 social_info.py facebook <username|uid>
Kết quả: JSON một dòng ra stdout.
"""
import json
import re
import sys


def get(url, timeout=25):
    from curl_cffi import requests as cr
    return cr.get(url, impersonate="chrome124", timeout=timeout)


def clean_url(value):
    """Facebook trả URL trong JSON đã escape dấu /"""
    if not value:
        return value
    return str(value).replace("\\/", "/").replace("&amp;", "&")


def num(value):
    try:
        return int(re.sub(r"[^\d]", "", str(value)) or 0)
    except Exception:
        return 0


def parse_count(value):
    """96.2M / 1.2K -> số"""
    if value is None:
        return 0
    text = str(value).strip().upper()
    m = re.match(r"^([\d.]+)\s*([KMB])?$", text)
    if not m:
        return num(value)
    factor = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}.get(m.group(2), 1)
    return int(float(m.group(1)) * factor)


def tiktok(username):
    url = f"https://www.tiktok.com/@{username}"
    resp = get(url)
    html = resp.text
    if resp.status_code != 200 or "Couldn" in html[:3000] and "followerCount" not in html:
        raise Exception("Khong tim thay tai khoan")

    out = {"source": "tiktok", "username": username}

    # 1) Ưu tiên đọc JSON trong __UNIVERSAL_DATA (đầy đủ nhất)
    m = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)</script>', html)
    if m:
        try:
            data = json.loads(m.group(1))
            scope = (data.get("__DEFAULT_SCOPE__") or {})
            info = (scope.get("webapp.user-detail") or scope.get("webapp.profile") or {}).get("userInfo", {})
            user = info.get("user") or {}
            stats = info.get("stats") or {}
            if user:
                found_id = str(user.get("uniqueId") or "").lower()
                if found_id and found_id != username.lower():
                    raise Exception(f"@{username} không tồn tại")
                st = stats if isinstance(stats, dict) else {}
                if not (st.get("followerCount") or st.get("heartCount") or st.get("videoCount")):
                    raise Exception(f"@{username} không tồn tại (hồ sơ trống)")
                out.update({
                    "nickname": user.get("nickname"),
                    "username": user.get("uniqueId"),
                    "avatar": clean_url(user.get("avatarLarger") or user.get("avatarMedium") or user.get("avatarThumb")),
                    "followers": stats.get("followerCount"),
                    "hearts": stats.get("heartCount"),
                    "videos": stats.get("videoCount"),
                    "following": stats.get("followingCount"),
                    "bio": user.get("signature"),
                    "verified": bool(user.get("verified") or user.get("custom_verify")),
                    "private": bool(user.get("privateAccount")),
                })
                return out
        except Exception:
            pass  # rơi xuống regex

    # 2) Fallback: regex trên HTML
    def grab(pattern, cast=str):
        mm = re.search(pattern, html)
        return cast(mm.group(1)) if mm else None

    out.update({
        "nickname": grab(r'"nickname":"([^"]{1,80})"'),
        "avatar": clean_url(grab(r'"avatarLarger":"([^"]+)"') or grab(r'"avatarMedium":"([^"]+)"')),
        "followers": parse_count(grab(r'"followerCount":(\d+)')),
        "hearts": parse_count(grab(r'"heartCount":(\d+)')),
        "videos": parse_count(grab(r'"videoCount":(\d+)')),
        "following": parse_count(grab(r'"followingCount":(\d+)')),
        "bio": grab(r'"signature":"([^"]{0,200})"'),
        "verified": bool(grab(r'"verified":(true|false)') == "true"),
        "private": bool(grab(r'"privateAccount":(true|false)') == "true"),
    })
    found = str(out.get("username") or "").lower()
    if found and found != username.lower():
        raise Exception(f"@{username} không tồn tại")
    if not (out.get("followers") or out.get("hearts") or out.get("videos")):
        raise Exception(f"@{username} không tồn tại (hồ sơ trống)")
    return out


def facebook(target):
    from urllib.parse import quote
    url = f"https://www.facebook.com/{quote(str(target))}"
    resp = get(url)
    html = resp.text
    if resp.status_code != 200:
        raise Exception(f"HTTP {resp.status_code}")

    out = {"source": "facebook", "username": str(target)}

    def grab(pattern, cast=str, idx=1):
        mm = re.search(pattern, html)
        return cast(mm.group(idx)) if mm else None

    # id + tên
    out["name"] = grab(r"<title>([^<]{1,80})</title>") or grab(r'"name":"([^"]{1,80})"')
    out["fb_id"] = grab(r'"userID":"?(\d+)"?') or grab(r'"entityID":"?(\d+)"?') or grab(r'"profile_id":"?(\d+)"?')
    out["avatar"] = clean_url(grab(r'"profilePicLarge":"([^"]+)"') or grab(r'"profilePicMedium":"([^"]+)"') or grab(r'"profile_picture":\{"uri":"([^"]+)"'))
    out["followers"] = parse_count(grab(r'"follower_count":(\d+)') or grab(r'"followers":\{"count":(\d+)'))
    out["about"] = (grab(r'"biography":"([^"]{0,200})"') or grab(r'"about":\{"text":"([^"]{0,200})"') or "")[:120] or None
    out["category"] = grab(r'"category_name":"([^"]{0,60})"') or grab(r'"categoryType":"([^"]{0,60})"')
    out["verified"] = bool(grab(r'"is_verified":(true|false)') == "true")
    out["link"] = url

    if not out.get("name") or out["name"] == "Facebook":
        raise Exception("Khong doc duoc ho so (private/blocked)")
    return out


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: social_info.py <tiktok|facebook> <target>"}))
        return 1
    platform, target = sys.argv[1].lower().strip(), sys.argv[2].strip().lstrip("@")
    try:
        info = tiktok(target) if platform.startswith("tiktok") else facebook(target)
        print(json.dumps({"ok": True, "data": info}, ensure_ascii=False))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:160]}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    sys.exit(main())
