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
import os
import re
import sys
import tempfile
import time


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


class SocialError(Exception):
    """Lỗi kèm mã để Node hiển thị đúng nguyên nhân"""
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def tiktok(username):
    url = f"https://www.tiktok.com/@{username}"
    resp = get(url)
    html = resp.text
    # TikTok không tìm thấy user → trả statusCode 10202 trong JSON.
    # CHÚ Ý: không dùng text "Couldn't find this account" — chuỗi đó nằm sẵn
    # trong bundle JS của mọi trang (kể cả trang user hợp lệ).
    if '"statusCode":10202' in html or '"statusCode": 10202' in html:
        raise SocialError("not_found", f"@{username} khong ton tai tren TikTok")
    if resp.status_code != 200:
        raise SocialError("blocked", f"TikTok tra ve HTTP {resp.status_code}")

    out = {"source": "tiktok", "username": username}

    # 1) Ưu tiên đọc JSON trong __UNIVERSAL_DATA (đầy đủ nhất)
    m = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)</script>', html)
    if m:
        try:
            data = json.loads(m.group(1))
            scope = (data.get("__DEFAULT_SCOPE__") or {})
            detail = scope.get("webapp.user-detail") or scope.get("webapp.profile") or {}
            # CHÚ Ý: userInfo có thể có key nhưng value = None (khi bị chặn),
            # nên phải "or {}" — .get("userInfo", {}) chỉ dùng default khi key
            # KHÔNG tồn tại, không xử lý được value None → .get() nổ lỗi.
            info = detail.get("userInfo") or {}
            user = info.get("user") or {}
            stats = info.get("stats") or {}
            # statusCode TikTok: 0 = OK | 10202/10221 = user không tồn tại
            # 209002 = bị CHẶN từ IP/user (account vẫn public!)
            code = detail.get("statusCode")
            if not user:
                if code in (10202, 10221):
                    raise SocialError("not_found", f"@{username} khong ton tai")
                raise SocialError("blocked", f"TikTok dang chan truy cap (ma {code}) - thu lai sau")
            if user:
                found_id = str(user.get("uniqueId") or "").lower()
                if found_id and found_id != username.lower():
                    raise Exception(f"@{username} không tồn tại")
                st = stats if isinstance(stats, dict) else {}
                if not (st.get("followerCount") or st.get("heartCount") or st.get("videoCount")):
                    raise SocialError("empty", f"@{username} chua co noi dung cong khai")
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
        except SocialError:
            raise  # KHÔNG được nuốt: not_found/blocked phải chạm tới fetch_with_retry
        except Exception:
            pass  # JSON hỏng → rơi xuống regex

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
        raise SocialError("empty", f"@{username} chua co noi dung cong khai")
    return out


def facebook(target):
    from urllib.parse import quote
    url = f"https://www.facebook.com/{quote(str(target))}"
    resp = get(url)
    html = resp.text
    if resp.status_code != 200:
        raise SocialError("blocked", f"Facebook tra ve HTTP {resp.status_code}")

    out = {"source": "facebook", "username": str(target)}

    def grab(pattern, idx=1, flags=0):
        mm = re.search(pattern, html, flags)
        return mm.group(idx) if mm else None

    # tên (bỏ hậu tố "• Facebook", "| Facebook", " - Facebook")
    out["name"] = grab(r"<title>([^<]{1,80})</title>") or grab(r'"name":"([^"]{1,80})"')
    if out["name"]:
        out["name"] = out["name"].strip()
        out["name"] = re.sub(r"\s*[|•\-]\s*Facebook.*$", "", out["name"], flags=re.I).strip()
        out["name"] = out["name"].replace("&#064;", "@").replace("&amp;", "&")
        if out["name"] in ("Facebook", ""):
            out["name"] = None

    # id
    out["fb_id"] = (grab(r'"userID":"?(\d+)"?') or grab(r'"entityID":"?(\d+)"?')
                   or grab(r'"profile_id":"?(\d+)"?') or grab(r'"entity_id":\s*"?(\d+)"?'))

    # avatar
    av = (grab(r'"profilePicLarge":"([^"]+)"') or grab(r'"profilePicMedium":"([^"]+)"')
          or grab(r'"profile_picture":\{"uri":"([^"]+)"')
          or grab(r'<meta property="og:image" content="([^"]+)"'))
    out["avatar"] = clean_url(av) if av else None

    # giới tính: FB trả JSON '"gender":"male"' (có thể UPPERCASE)
    g = grab(r'"gender":"([A-Za-z]+)"')
    if g:
        gl = g.lower()
        out["gender"] = "Nam" if gl.startswith("m") else ("Nu" if gl.startswith("f") else g)
    else:
        out["gender"] = None

    # followers + mô tả: nằm trong og:description
    #  "Mark Zuckerberg. 121,434,345 followers · 1,009,053 talking about this. Bringing the world closer together."
    ogd = grab(r'og:description" content="([^"]+)"')
    if ogd:
        ogd = ogd.replace("&#xb7;", "|").replace("&amp;", "&")
        fm = re.search(r"([\d.,]+)\s*followers", ogd, re.I)
        if fm:
            out["followers"] = parse_count(fm.group(1))
        tm = re.search(r"([\d.,]+)\s*talking", ogd, re.I)
        if tm:
            out["talking_about"] = parse_count(tm.group(1))
        # phần mô tả sau cùng (about) — lấy phần KHÔNG RỖNG cuối cùng vì
        # chuỗi og:description hay kết thúc bằng dấu "." → split ra chuỗi rỗng
        tail = ""
        for part in reversed(ogd.split(".")):
            part = part.strip()
            if part:
                tail = part
                break
        if tail and "followers" not in tail.lower():
            out["about"] = tail[:120]

    if not out.get("followers"):
        fm2 = re.search(r"([\d.,]+)\s*followers", html, re.I)
        if fm2:
            out["followers"] = parse_count(fm2.group(1))

    # ngày sinh (nếu công khai)
    bd = (grab(r'"birthday":"([^"]{4,24})"') or grab(r"(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}")
          or grab(r"\d{1,2} tháng \d{1,2}, \d{4}"))
    out["birthday"] = bd if bd else None

    # địa điểm
    loc = (grab(r'"location":\{"name":"([^"]{1,60})"')
           or grab(r'"current_city":\{"name":"([^"]{1,60})"')
           or grab(r'"hometown":\{"name":"([^"]{1,60})"'))
    out["location"] = loc if loc else None

    # xác minh
    out["verified"] = bool(grab(r'"is_verified":(true|false)') == "true" or grab(r'"verified":(true|false)') == "true")
    out["link"] = url

    if not out.get("name") or out["name"] == "Facebook":
        raise SocialError("private", "Ho so rieng tu hoac bi han che")
    return out


CACHE_DIR = os.path.join(tempfile.gettempdir(), "jt_social_cache.json")
CACHE_TTL = 1800  # 30 phút — TikTok hay chặn theo IP nên phải giữ kết quả

def cache_get(key):
    try:
        if os.path.exists(CACHE_DIR):
            raw = json.load(open(CACHE_DIR))
            item = raw.get(key)
            if item and (time.time() - item["at"]) < CACHE_TTL:
                return item["data"]
    except Exception:
        pass
    return None

def cache_put(key, data):
    try:
        raw = {}
        if os.path.exists(CACHE_DIR):
            raw = json.load(open(CACHE_DIR))
        raw[key] = {"at": time.time(), "data": data}
        json.dump(raw, open(CACHE_DIR, "w"))
    except Exception:
        pass

# Lấy info kèm cache + retry (TikTok bất ổn định do chặn theo IP)
def fetch_with_retry(platform, target, tries=2):
    key = f"{platform}:{target.lower()}"
    cached = cache_get(key)
    if cached:
        return cached

    fn = tiktok if platform == "tiktok" else facebook
    # KHÔNG tự đoán biến thể username (bỏ "_"/"."): tìm nhầm user khác tệ
    # hơn báo lỗi. Bot chỉ báo "không tìm thấy" và hướng dẫn copy username
    # chính xác từ link profile.
    last = None
    for i in range(tries):
        try:
            data = fn(target)
            cache_put(key, data)
            return data
        except SocialError as e:
            last = e
            if e.code == "blocked":
                if i < tries - 1:
                    time.sleep(2.5)
                continue
            if i < tries - 1:
                time.sleep(1.2)
    raise last


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: social_info.py <tiktok|facebook> <target>"}))
        return 1
    platform, target = sys.argv[1].lower().strip(), sys.argv[2].strip().lstrip("@")
    try:
        info = fetch_with_retry("tiktok" if platform.startswith("tiktok") else "facebook", target)
        print(json.dumps({"ok": True, "data": info}, ensure_ascii=False))
        return 0
    except SocialError as e:
        print(json.dumps({"ok": False, "code": e.code, "error": str(e)[:160]}, ensure_ascii=False))
        return 2
    except Exception as e:
        print(json.dumps({"ok": False, "code": "unknown", "error": str(e)[:160]}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    sys.exit(main())
