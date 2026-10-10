# 🤖 ᴶᴼᴴᴺ ᵀᴿᴬᴺ

**ᴶᴼᴴᴺ ᵀᴿᴬᴺ** là một chatbot Zalo được phát triển bằng Node.js, dựa trên thư viện [Zalo-Client](https://github.com/DEVTRAN07/Zalo-Client)

> Nhóm Zalo giao lưu, hỗ trợ: [https://zalo.me/g/xwxdtp685](https://zalo.me/g/xwxdtp685)

> [!IMPORTANT]
> 🚧 **ᴶᴼᴴᴺ ᵀᴿᴬᴺ** hiện đang trong quá trình phát triển.
> 
> Nếu bạn gặp bất kỳ sự cố, lỗi hoặc vấn đề nào trong quá trình sử dụng,  
> hãy **đóng góp** bằng cách báo lỗi hoặc gửi pull request.
>
> 💡 Chúng tôi luôn hoan nghênh mọi sự hỗ trợ từ cộng đồng!

---

## 📚 Tài liệu
📚 Xem tài liệu API tại: [https://github.com/DEVTRAN07/Zalo-Client#readme](https://github.com/DEVTRAN07/Zalo-Client#readme)

📚 Tải liệu Plugins

<details>
<summary>📁 Sự kiện mẫu</summary>

```javascript
module.exports.config = {
    name: "example", // Tên của sự kiện
    event_type: ["message"], // Loại event, có thể nhận nhiều event 1 lúc
    version: "1.0.0", // Phiên bản của sự kiện
    author: "ShinTHL09 ", // Tác giả của sự kiện
    description: "Sự kiện mẫu", // Thông tin sự kiện
    dependencies: {} // Các thư viện cần thiết (Bot sẽ tự cài khi load sự kiện)
};

module.exports.onLoad =  async function({ api, Users, Threads }) {
  console.log("Sự kiện example đã được load");
}

// Bot nhại tin nhắn
module.exports.run = async function({ api, event, eventType, Users, Threads, replyData }) {
    const { threaId, type, data } = event;
    const msg = data.content;
    return api.sendMessage(msg, threaId, type);
};

// Bot nhại tin nhắn có reply
module.exports.run = async function({ api, event, eventType, Users, Threads, replyData }) {
    const { threaId, type, data } = event;
    const msg = data.content;
    return api.sendMessage({ msg, quote: replyData }, threaId, type);
};
```

</details>

<details>
<summary>📁 Lệnh mẫu mẫu</summary>

```javascript
module.exports.config = {
  name: 'example', // Tên của lệnh
  version: '1.0.0', // Phiên bản của lệnh
  role: 0, // Quyền hạn 0: thành viên, 1: support bot, 2: admin bot
  author: 'ShinTHL09', // Tác giả của lệnh
  description: 'Lệnh mẫu', // Thông tin lệnh
  category: 'Tiện ích', // Mục của lệnh
  usage: 'restart', // Cách dùng lệnh
  cooldowns: 2, // Thời gian hồi lệnh
  dependencies: {} // Các thư viện cần thiết (Bot sẽ tự cài khi load lệnh)
};

module.exports.onLoad = async ({ api, Users, Threads }) => {
  console.log("Lệnh example đã được load")
}

module.exports.handleEvent = async ({ api, event, eventType, Users, Threads, replyData }) => {
  console.log("đã có event xảy ra");
}

// lệnh mẫu
module.exports.run = async ({ args, event, api, Users, Thread }) => {
  const { threadId, type } = event;

  return api.sendMessage("Đây là lệnh mẫu", threadId, type);

};

// lệnh mẫu có reply tin nhắn
module.exports.run = async ({ args, event, api, Users, Thread }) => {
  const { threadId, type } = event;

  return api.sendMessage({ msg: "Đây là lệnh mẫu", quote: replyData }, threadId, type);

};
```

</details>

<details>
<summary>📁 Các hàm để xử lí media</summary>

```js
const { processVideo, processAudio } = require("../../utils/index");

processVideo(videoPath, threadId, type); // Xử lí video
processAudio(audioPath, threadId, type); // Xử lí audio

```
</details>


<details>
<summary>📁 Các biến global</summary>

```js
global.client.config // Config bot
global.client.config.prefix // Prefix hiện tại

global.client.commands // Tất cả command
global.client.commands.get("example").config.author // lấy author của lệnh example

global.client.events // Tất cả event
global.client.events.get("example").config.author // lấy author của lệnh example

global.users.admin[0] // ID admin đầu tiên
global.users.support[0] // ID support đầu tiên
```

</details>


<details>
<summary>📁 Các hàm để cập nhật config</summary>

```js
const { updateConfigArray, updateConfigValue, reloadConfig } = require("../../utils/index");

updateConfigArray(key, newArray); // Sửa array trong config
// Example: updateConfigArray("admin_bot", ["1", "2"])

updateConfigValue(key, newValue); // Sửa giá trị trong config
// Example: updateConfigValue("prefix", "!")

reloadConfig();
// Reload lại file config
```
</details>


🗃️ Database (Users & Threads)

<details>
<summary>🧵 Threads</summary>

```js
await Thread.getData("id_box"); // Lấy dữ liệu
await Thread.setData("id_box", data_json); // Lưu dữ liệu
await Thread.getAll(); // Lấy tất cả dữ liệu

// Ví dụ
const databox = (await Thread.getData("id_box")).data;
databox.prefix = "!";
await Thread.setData("id_box", databox);
```
</details>

<details>
<summary>👤 Users</summary>

```js
await Users.getData("user_id"); // Lấy dữ liệu
await Users.setData("user_id", data_json); // Lưu dữ liệu
await Users.getAll(); // Lấy tất cả dữ liệu

// Ví dụ
const datauser = (await Users.getData("user_id")).data;
datauser.money = 1000;
await Users.setData("user_id", datauser);
```
</details>

---

## 🚀 Cài đặt

### 🎵 Lệnh nhạc (scl • zing • nct • spt)

Bot có sẵn 4 lệnh tải nhạc, tất cả đều gọi **trực tiếp API của nền tảng** (hoặc endpoint do admin tự cấu hình), không qua proxy trung gian nên không rò rỉ dữ liệu:

| Lệnh | Nguồn | Cần cấu hình? |
|------|-------|---------------|
| `/zing <từ khóa>` | Zing MP3 | Không |
| `/nct <từ khóa>` | NhacCuaTui (có ký số WASM tự động) | Không |
| `/scl <từ khóa>` | SoundCloud | Không (tự lấy client_id từ asset chính chủ) |
| `/spt <link spotify>` | Spotify (oEmbed) | Không |
| `/spt <từ khóa>` | Spotify (tìm kiếm) | Cần `spotify_client_id` + `spotify_client_secret` trong config.yml |

**Cách dùng:**
```
/zing Sơn Tùng MTP      → hiện danh sách 5 bài
/zing 2                 → tải bài số 2 về dạng voice
/spt https://open.spotify.com/track/xxx  → lấy thông tin bài hát
```
Danh sách kết quả được nhớ 5 phút; trả lời bằng số thứ tự để tải bài.

---

## 🏗️ Kiến trúc (ᴶᴼᴴᴺ ᵀᴿᴬᴺ v3)

```
core/
├── config/        # nạp config.yml + override env JT_* → validate → đóng băng (immutable)
├── http/          # HTTP client: timeout, retry/backoff, redirect, PRIVACY GUARD chặn host lạ
├── services.js    # endpoint do admin cấu hình (trống = tính năng TẮT, không gửi data đi đâu)
├── ai/            # gemini (nhớ hội thoại) + tts (đọc giọng nói)
├── music/         # registry nhạc: model Track + 4 provider + lyric + chart + cache chọn bài
├── message.js     # TTL chuẩn (>= 60s vì Zalo bỏ qua TTL nhỏ hơn) + reply helper + wrap api (auto TTL + auto card + reaction)
├── canvas/        # render thẻ: vip.js (glassmorphism, icon vector, avatar, progress) + icons.js
├── cache.js       # LRU cache TTL cho group/user info + kết quả nhạc
├── storage/       # JSON store atomic (write-behind + ghi khi thoát), thay sqlite
├── metrics.js     # thống kê ngày + audit log (data/audit.log)
├── hotReload.js   # theo dõi plugin thay đổi → tự nạp lại
├── health.js      # health server (PORT env) cho Render/Koyeb + UptimeRobot ping
├── bootstrap.js   # khôi phục account/cookie/db từ env khi deploy cloud
├── handle/        # pipeline lệnh: resolve → chống spam → phân quyền → cooldown → chạy
├── loader/        # nạp plugin commands/events
└── controller/    # tầng dữ liệu (Users/Threads)
panel/
├── botManager.js  # quản lý bot con: spawn/stop/restart/logs/QR/watchdog
└── server.js      # web panel zero-dependency (không cần express)
plugins/
├── commands/      # 36 lệnh (gồm scl, zing, nct, spt, bxh, lyric, noi, stats)
└── events/        # 6 event module
```

**Tính năng nổi bật v3:**
- **Canvas VIP cho mọi lệnh**: `reply.card()` render thẻ ảnh cao cấp (glassmorphism, glow, icon vector vẽ tay không cần font emoji, avatar tròn, progress bar, 6 theme) — gọi tự động qua api wrapper cho cả lệnh cũ.
- **Reaction trạng thái**: 🙏 khi bắt đầu xử lý → ✅ khi xong / 😢 khi lỗi (thay text chờ).
- **Welcome card ảnh** khi có thành viên mới vào nhóm.
- **Menu phân trang**: `/menu`, `/menu 2`, ... mỗi trang 5 nhóm lệnh.
- **TTL chuẩn hoá**: mọi tin nhắn TTL ≥ 60.000ms (Zalo chỉ tự xóa tin từ 1 phút) — `ttl.message/error/media/card` trong config.yml.
- **Đổi storage**: bỏ better-sqlite3 (native), dùng JSON store atomic ghi `data/store.json`, mỗi bot con một file riêng.
- **Web panel + bot con**: bật `panel.enabled: true` rồi chạy `npm start`, mở `http://localhost:3000` — tạo/dừng/xoá bot con, log realtime, QR đăng nhập, metrics bar, auto-restart, watchdog crash loop.
- **Đã xoá toàn bộ lệnh game** (taixiu, baucua, daily, tiền tệ...) và dữ liệu liên quan.

**Nguyên tắc bảo mật:**
- `privacy.allowed_hosts`: chỉ các host được liệt kê mới được phép gửi request (kiểm tra ở cả `core/http` và interceptor axios toàn cục).
- Endpoint dịch vụ ngoài (autodown, qrheart, itik, girltt, fbin4, ai proxy...) **không hardcode** — admin đặt trong `config.yml → services`, để trống là tắt hoàn toàn.
- Secret (token, key, cookie, URL ký...) tự động che `***` trong log.
- Config đóng băng sau khi nạp; không thể bị sửa lúc chạy.

**Lệnh nhạc VIP:**
| Lệnh | Chức năng |
|---|---|
| `/zing`, `/nct`, `/scl`, `/spt` | Tìm nhạc → trả lời số → tải voice; thêm `320` hoặc `-q 320` để lấy chất lượng cao |
| `/bxh` | Bảng xếp hạng Top 20 Zing → trả lời số để tải |
| `/lyric <từ khóa>` | Lời bài hát (thẻ AI) — không nhập = bài tìm gần nhất |
| `/spt <link spotify>` | Lấy preview 30s chính chủ từ trang embed Spotify (không cần key) |

**Lệnh AI VIP:**
| Lệnh | Chức năng |
|---|---|
| `/gpt <câu hỏi>` | AI nhớ ngữ cảnh hội thoại (8 tin nhắn gần nhất theo user) |
| `/gpt reset` | Xoá lịch sử hội thoại |
| `/noi <văn bản>` | Bot đọc thành giọng nói (viếng `ai.tts_enabled: true`) |

**Kiến trúc + vận hành:**
- `/stats` — thẻ thống kê ngày (lệnh, nhạc, AI, lỗi, top lệnh, cache hit rate).
- **Hot-reload**: sửa file plugin là tự nạp lại (`hot_reload: true`).
- **LRU cache** cho group/user info + kết quả nhạc (ít gọi API Zalo hơn).
- **Audit log**: mọi hành động admin ghi vào `data/audit.log`, xem qua panel `/api/metrics`.
- Test harness: `node scripts/test-commands.js` — **78/78 PASS** (cấu hình + chạy pipeline mọi lệnh).

---

## 🖥️ Chạy 24/7 miễn phí

### ⚠️ Vì sao KHÔNG dùng được Vercel

Bot Zalo là tiến trình **chạy liên tục**: giữ kết nối WebSocket tới Zalo 24/7, ghi file (cookie, database), xử lý ảnh bằng canvas/ffmpeg. Vercel là **serverless**:

| Hạn chế Vercel | Hệ quả |
|---|---|
| Function chạy xong là tắt (free: tối đa 10-60s mỗi lần gọi) | WS tới Zalo bị ngắt ngay khi function kết thúc → không nhận được tin nhắn |
| Không có ổ đĩa bền vững | cookie/database mất mỗi lần chạy → phải quét QR lại liên tục |
| Không spawn được tiến trình con | bot con + ffmpeg không chạy được |
| Cron free chỉ chạy ~1 lần/ngày | Không thể "gom" tin nhắn theo phiên |

Nền tảng tương tự (Netlify Functions, Cloudflare Workers) cũng **không dùng được**.

### 🟦 Còn Vercel thì làm được gì? (đã setup sẵn)

Vercel vẫn **dùng được cho tầng giám sát** — repo đã có sẵn:

| File | Vai trò |
|---|---|
| `public/index.html` | Trang status realtime: trạng thái edge + bot runtime |
| `api/health.js` | JSON health của tầng giám sát (UptimeRobot ping được luôn) |
| `api/status.js` | Proxy trạng thái bot runtime (set env `JT_STATUS_URL` = URL Render/Koyeb) |

Deploy: vercel.com → Add New → Project → import repo → Deploy (không cần build).
Sau đó set `JT_STATUS_URL` trỏ tới service bot trên Render để trang status hiện dữ liệu thật.

### ✅ Cách free chạy thật: Render + UptimeRobot (khuyến nghị)

Render free **không sleep** nếu có request HTTP tới trong mỗi 15 phút — bot đã có sẵn health server (`/health`) cho việc này.

**Bước 1 — đăng nhập 1 lần ở máy bạn** để có cookie:

```bash
npm install
node JohnTran.js      # quét QR, thấy "Đã đăng nhập thành công" là Ctrl+C
```

**Bước 2 — lấy nội dung cookie** (dán vào biến môi trường trên Render sau này):

```bash
cat account.json     # → JT_ACCOUNT_JSON
cat cookie.json      # → JT_COOKIE_JSON
cat data/store.json  # → JT_DB_JSON (tuỳ chọn)
```

**Bước 3 — push code lên GitHub** (repo private nhớ).

**Bước 4 — Render Dashboard** → New → Blueprint → chọn repo (file `render.yaml` đã có sẵn) → rồi vào Settings → Environment → thêm các biến:

```yaml
JT_ACCOUNT_JSON: {"imei":"...","userAgent":"...","cookie":"cookie.json"}
JT_COOKIE_JSON:  [ ...nội dung cookie.json... ]
JT_AI__GEMINI_KEYS: key1,key2   # tuỳ chọn
```

Bot sẽ **tự ghi lại account.json/cookie.json từ biến môi trường** mỗi lần khởi động (`core/bootstrap.js`) nên ổ đĩa tạm mất cookie cũng không sao.

**Bước 5 — UptimeRobot** (miễn phí) → New Monitor → HTTP(s) → URL: `https://<ten-service>.onrender.com/health` → mỗi **5 phút** ping một lần. Nhờ đó Render không sleep.

> Khi cookie hết hạn (vài tuần), lặp lại bước 1-2 và cập nhật biến môi trường trên Render.

### ✅ Cách khác

| Nền tảng | Cách | Phù hợp |
|---|---|---|
| **Koyeb free** | New Service → từ GitHub (có sẵn `Dockerfile`) → thêm env như trên | Ổn định, không sleep |
| **GitHub Actions** | Cron chạy ~50 phút/lượt (xong tự khởi động lại) | Không cần đăng ký đâu, nhưng bot ngắt 2-3 phút mỗi chu kỳ |
| **Oracle Cloud Always Free** | ARM VM miễn phí vĩnh viễn + chạy `node JohnTran.js` trong `screen` | Muốn như VPS thật (4 CPU/24GB RAM) |
| **PM2 trên VPS/Mac** | `npm i -g pm2 && pm2 start JohnTran.js` | Chạy ở nhà 24/7 |

---
## 🎛️ Mở Panel quản lý

```yaml
# config.yml
panel:
  enabled: true
  host: "0.0.0.0"
  port: 3000
  token: "doi-thanh-mat-khau"   # để trống = không cần đăng nhập
```

```bash
npm start        # hoặc: node index.js
```

Mở trình duyệt: **http://localhost:3000** (trên VPS: **http://IP-VPS:3000** — nhớ mở port 3000 trong firewall / security-list của Oracle Cloud).

Panel có: tạo bot con, bắt đầu/dừng/khởi động lại, log realtime, xem QR đăng nhập từng bot, metrics bar (lệnh / nhạc / AI / lỗi / cache / RAM), cảnh báo crash loop.

> Bot con khi chạy trên VPS riêng cũng có thể mở panel riêng với port khác nhau (`panel.port`).

---

## 🔧 Yêu cầu

- **Node.js** phiên bản **v20 trở lên**

- **Khi sử dụng hệ điều hành Windowns bạn cần phải cài các font trong plugins/cache/... để có font chữ cho canvas**

### 📦 Cài đặt Bot

```bash
git clone https://github.com/DEVTRAN07/JOHNTRAN
cd JOHNTRAN
npm install
```

> **Lưu ý `zalo-client`:** thư viện chưa publish lên npm. Bot đang gắn bản build sẵn qua `file:../Zalo-Client` (clone + `npm run build` repo [Zalo-Client](https://github.com/DEVTRAN07/Zalo-Client) cạnh thư mục bot). Khi đã publish npm, đổi thành `"zalo-client": "^3.0.0"` trong package.json.

---

## 🔐 Đăng nhập Bot

### ✅ Cách 1: Đăng nhập bằng **QR Code**

1. Chạy bot bằng lệnh:
   ```bash
   npm start
   ```
2. Mở file `qr.png` được tạo trong thư mục bot và quét mã bằng ứng dụng Zalo
3. Sau khi đăng nhập thành công, bot sẽ tự động lưu **cookie** cho những lần đăng nhập tiếp theo

📘 Xem tài liệu chi tiết tại:  
👉 [https://github.com/DEVTRAN07/Zalo-Client#qr-login](https://github.com/DEVTRAN07/Zalo-Client#qr-login)

### ✅ Cách 2: Đăng nhập bằng **Cookie**

1. Tạo file `account.json` với nội dung:

   ```json
   {
     "imei": "Imei_Cua_Ban",
     "userAgent": "userAgent_Cua_Ban",
     "cookie": "cookie.json"
   }
   ```

2. Thay thế các giá trị `imei`, `userAgent`

3. Tạo file `cookie.json` và dán nội dung cookie Zalo vào
4. Chạy bot bằng lệnh:
   ```bash
   npm start
   ```

📘 Có thể dùng công cụ ZaloDataExtractor để lấy `imei` `userAgent` `cookie`:
👉 [https://github.com/JustKemForFun/ZaloDataExtractor/](https://github.com/JustKemForFun/ZaloDataExtractor/)

📘 Xem hướng dẫn chi tiết cách lấy cookie tại:  
👉 [https://github.com/DEVTRAN07/Zalo-Client#cookie-login](https://github.com/DEVTRAN07/Zalo-Client#cookie-login)

---

## 📄 Giấy phép

Phát hành theo giấy phép **MIT License**

---
