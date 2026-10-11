# Thiết kế phần 1: Nền của bản web (LostArk Web)

- **Ngày:** 2026-10-10
- **Trạng thái:** chờ Traine duyệt bản viết
- **Người quyết định:** Traine (cùng làm với Khang)
- **Repo:** `madieukhang/lostarkweb` (public)

## 1. Bối cảnh

### Mục đích của bản web
1. **Dự phòng cho bot Discord.** Railway gói free chỉ có $1 mỗi tháng. Khi Railway hết tiền hoặc có sự cố, bot tắt. Web phải vẫn chạy được trong lúc đó.
2. **Nơi đặt tính năng chỉ web mới làm được,** về sau.
3. **Sản phẩm đầu tư lâu dài** cho người dùng thật.

### Chương trình gồm 5 phần
Mỗi phần có spec, kế hoạch và bản dựng riêng. Theo quyết định của Traine, **LoaLogs được làm trọn vẹn trước**, RaidManage làm sau.

| # | Phần | Trạng thái |
|---|---|---|
| 0 | Spike: MongoDB trên Cloudflare Workers | ✅ Xong (2026-10-10) |
| 1 | **Nền: khung web, đăng nhập Discord, cửa API, deploy. Chỉ nối với LoaLogs** | 📝 Spec này |
| 2 | Tab Checklist: toàn bộ tính năng list của LoaLogs, kể cả duyệt trên web (chia nhiều lát) | Chưa |
| 3 | Sửa bot LoaLogs: quét đơn chờ duyệt lúc khởi động, nhắc mỗi 24 giờ, nút link sang web | Chưa |
| 4 | Tab RaidManage: `/raid-status`, `/raid-check`, cùng `cloud/` của RaidManage | Chưa, sau khi LoaLogs hoàn chỉnh |

### Kết quả spike quyết định kiến trúc
- Một Worker thường ở gói Free có **10 ms CPU** mỗi request. Nếu mỗi request tự mở kết nối Mongoose thì tốn **93–274 ms CPU**, nên cách này bị loại.
- Request vào **Durable Object (DO)** có **30 giây CPU, kể cả ở gói Free.** Một DO giữ sẵn kết nối thì mỗi lượt check list chỉ tốn 8–11 ms CPU. Worker bên ngoài chuyển việc vào DO chỉ tốn 0–2 ms.
- DO đặt xa cluster Atlas thì chậm gấp khoảng 7 lần. Phải ghim DO cạnh cluster bằng `locationHint`.
- Atlas cho Cloudflare kết nối vào. lostark.bible trả 200 khi gọi từ Worker đã deploy (3 lần trên 3).
- DO và MongoDB **không thuộc phần 1**. Chúng vào ở phần 2 (LoaLogs) và phần 4 (RaidManage).

## 2. Các quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Thứ tự làm | **LoaLogs trọn vẹn trước** (nền, tab Checklist, sửa bot LoaLogs), RaidManage sau |
| Kiến trúc chung | **Hướng 3.** API nằm trong thư mục `cloud/` của chính repo bot và import luật của bot đó. Web chỉ làm giao diện |
| Phạm vi khi bot tắt | **Đầy đủ như bot (C)**, kể cả duyệt trên web |
| Nhắc duyệt | Bot sống lại thì gửi ngay mọi đơn đang treo, sau đó nhắc mỗi 24 giờ tới khi có người duyệt. Giờ bot tắt không tính (đồng hồ chạy theo `lastRemindedAt`). Làm ở phần 3 |
| Nơi đặt repo web | **Tài khoản GitHub của Khang (C):** `madieukhang/lostarkweb`, public, cùng tài khoản với repo LoaLogs |
| Ai được đăng nhập | **Luật B:** chỉ người ở ít nhất một server có bot. Sau khi vào, quyền y hệt bot. Mỗi tab chỉ hiện nếu người dùng chung server với đúng bot đó |
| Ngôn ngữ | **vi và en trước, jp sau (C).** Hạ tầng dịch dựng từ đầu |
| Dáng phần nền | **Cách 1: một cửa.** Worker cửa phục vụ trang tĩnh, giữ đăng nhập, chuyển `/api/*` qua Service Binding tới các API ẩn (LoaLogs ở phần 1, RaidManage ở phần 4) |
| Ứng dụng Discord | **Tạo ứng dụng mới cho web.** Traine tạo và giữ, có thể thêm Khang vào Developer Team |
| `lostark-central` | Không dùng, không lấy gì từ đó (Khang đồng ý bỏ) |

## 3. Kiến trúc

```
Trình duyệt
   │  https://lostark-web.<subdomain>.workers.dev
   ▼
Worker "web" (repo web, TypeScript)
   ├─ /, /checklist, /raid, /login ...  → file tĩnh từ Next.js export (không chạy code, không tính phí)
   ├─ /auth/login, /auth/callback, /auth/logout, /auth/session → code đăng nhập
   └─ /api/checklist/*  ──Service Binding──▶ Worker "loalogs-api"   (repo LoaLogs, cloud/, ẩn)
      /api/raid/*       ──Service Binding──▶ Worker "raidmanage-api" (repo RaidManage, cloud/, ẩn)   ← thêm ở phần 4
```

Worker API **không có địa chỉ công khai** (`workers_dev: false`, không có route). Cách duy nhất để gọi nó là qua Service Binding từ Worker web.

**Phần 1 chỉ dựng nhánh LoaLogs.** Mọi chỗ trong spec có nhắc RaidManage (tab `raid`, binding `RAIDMANAGE_API`, `tabs.raid`) là thiết kế sẵn cho phần 4. Ở phần 1, chúng không được dựng, và `tabs.raid` luôn rỗng.

## 4. Mục 1: Cấu trúc repo

### Repo web `madieukhang/lostarkweb` (Worker tên `lostark-web`)
```
lostarkweb/
├─ app/                      Next.js 16 (16.4.0 lúc lập kế hoạch), App Router, output: 'export'
│  ├─ page.tsx               trang chủ, chọn tab theo quyền
│  ├─ checklist/page.tsx     khung tab LoaLogs (nội dung ở phần 2)
│  ├─ raid/page.tsx          khung tab RaidManage (tạo ở phần 4)
│  └─ login/page.tsx         trang đăng nhập và các trang từ chối
├─ components/
├─ lib/
│  ├─ i18n/vi.json, en.json, index.ts
│  └─ api.ts                 gọi /api/... cùng origin, cookie tự đi kèm
├─ worker/
│  ├─ index.ts               định tuyến: /auth/*, /api/*
│  ├─ auth.ts                OAuth Discord
│  ├─ session.ts             ký và kiểm cookie phiên (HMAC-SHA256)
│  ├─ access.ts              luật B và quyền theo tab
│  └─ forward.ts             chuyển tiếp qua Service Binding
├─ test/
├─ package.json
└─ wrangler.jsonc
```

- Phần web viết TypeScript.
- Next.js build tĩnh, nên không có SSR, server action hay middleware. Dữ liệu được tải từ trình duyệt sau khi trang hiện ra.
- Công cụ và phong cách giao diện để dành cho **vòng thiết kế hình ảnh riêng**. Phần 1 chỉ dựng khung tối thiểu.

### Thư mục `cloud/` trong mỗi repo bot (khung ở phần 1)
```
<repo bot>/cloud/
├─ package.json
├─ wrangler.jsonc        workers_dev: false, compatibility_flags: ["nodejs_compat"]
└─ src/index.js
```
- Viết JavaScript cho khớp với code bot: LoaLogs dùng ESM, RaidManage dùng CommonJS.
- Phần 1 chỉ tạo `cloud/` trong **repo LoaLogs**. `cloud/` của RaidManage được tạo ở phần 4.
- Các phần sau sẽ import thẳng các file luật trong `../bot/`.
- `cloud/` không làm thay đổi cách Railway build và chạy bot (xem Mục 5 về `watchPatterns`).

## 5. Mục 2: Đăng nhập Discord

### Ứng dụng Discord
- Đây là một ứng dụng **mới, riêng cho web**, do Traine tạo.
- Redirect URI là `${PUBLIC_ORIGIN}/auth/callback`.
- Scope là `identify guilds`.

### Luồng đăng nhập
1. `GET /auth/login`
   - Tạo `state` ngẫu nhiên (32 byte).
   - Đặt cookie `__Host-oauth_state` (HttpOnly, Secure, SameSite=Lax, Path=/, sống 10 phút).
   - Chuyển hướng tới `https://discord.com/oauth2/authorize`.
   - Khi `?silent=1` thì kèm `prompt=none` (xem bên dưới).
2. `GET /auth/callback?code&state`
   - So `state` với cookie. Lệch thì trả trang lỗi, và xoá cookie state.
   - Đổi `code` lấy access token bằng `POST https://discord.com/api/v10/oauth2/token`.
   - Gọi `GET /users/@me`, lấy id, tên, avatar và `locale`.
   - Gọi `GET /users/@me/guilds`, lấy danh sách server của người dùng.
   - Access token của Discord **không được lưu lại**. Đọc xong là bỏ.
3. **Kiểm luật B.**
   - Gọi từng API bot qua Service Binding ở đường nội bộ `GET /internal/bot-guilds`, để biết bot đang ở những server nào.
   - Lấy phần giao với server của người dùng.
   - Cả hai bot đều không có phần giao thì trả trang "chỉ dành cho thành viên server có bot", và không cấp phiên.
   - Còn lại, `tabs.checklist` là các server chung với LoaLogs, `tabs.raid` là các server chung với RaidManage. Danh sách rỗng thì tab đó ẩn.
   - **Ở phần 1 chỉ có API LoaLogs,** nên luật B xét các server có bot LoaLogs, và `tabs.raid` luôn rỗng. Phần 4 thêm RaidManage vào bước này mà không đổi luật.
4. **Đặt cookie phiên** `__Host-session` (HttpOnly, Secure, SameSite=Lax, Path=/).

### Cookie phiên
- Nội dung là JSON, mã hoá base64url, kèm chữ ký HMAC-SHA256 bằng `SESSION_SECRET`:
  ```
  { v: 1, uid, name, avatar, tabs: { checklist: [guildId…], raid: [guildId…] }, iat, exp }
  ```
- **Hạn 24 giờ.** Phiên hết hạn thì web gọi `/auth/login?silent=1`. Người dùng đã cho phép trước đó nên Discord không hiện màn hình xác nhận. Danh sách server vì thế được làm mới ít nhất mỗi ngày.
- `prompt=none` mà thất bại (người dùng đã thu hồi quyền) thì quay về trang đăng nhập bình thường.
- Phiên không lưu trong database. Worker chỉ kiểm chữ ký và hạn.
- `GET /auth/session` trả `{ uid, name, avatar, tabs: { checklist: bool, raid: bool } }` để giao diện vẽ menu. Không trả danh sách server.
- `POST /auth/logout` xoá cookie phiên. Lệnh này cũng phải qua bước kiểm `Origin`.

### Danh sách server của bot
- Mỗi API bot tự giữ **bot token** của mình. Nó gọi `GET /users/@me/guilds` với `Authorization: Bot …`, có phân trang, và cache kết quả 5 phút.
- Worker web **không giữ bot token nào.**
- Đường `/internal/*` của API **không bao giờ được chuyển tiếp từ trình duyệt.** Worker web chỉ ánh xạ `/api/<tab>/*` sang `/api/*` của API.

### Lỗi từ Discord
- Discord trả 429 thì đọc `retry_after` và hiện trang "thử lại sau ít giây".
- Discord trả lỗi khác thì hiện trang lỗi chung kèm mã lỗi, không lộ chi tiết nội bộ.

## 6. Mục 3: Chuyển tiếp API

Với mỗi request `/api/<tab>/*`, Worker web làm đúng bốn bước:
1. **Kiểm phiên.** Thiếu, sai chữ ký hoặc hết hạn thì trả `401`.
   - Giao diện nhận `401` từ một lệnh **đọc** thì gọi đăng nhập ngầm rồi quay lại đúng trang đó.
   - Nhận `401` từ một lệnh **ghi** thì không chuyển hướng ngay. Giao diện giữ thao tác lại, báo "phiên hết hạn", và để người dùng bấm đăng nhập lại rồi gửi lại.
2. **Kiểm quyền tab.** `tabs[<tab>]` rỗng thì trả `403`.
3. **Thay danh tính.**
   - Xoá mọi header `x-web-*` do trình duyệt gửi.
   - Gắn `x-web-user` dạng JSON `{ uid, name, guilds: tabs[<tab>], lang }`.
   - Đổi đường dẫn `/api/<tab>/x` thành `/api/x`, rồi gọi `env.<TAB>_API.fetch(request)`.
4. **Chặn lệnh ghi từ trang lạ.** Với POST, PUT, PATCH, DELETE, header `Origin` phải bằng `PUBLIC_ORIGIN`, nếu không thì trả `403`.

Ánh xạ tab sang binding: `checklist → LOALOGS_API`, `raid → RAIDMANAGE_API`. Worker web không hiểu nghiệp vụ, nên thêm endpoint ở repo bot không phải sửa Worker web.

### Quy ước phản hồi giữa web và API
- Thành công: `{ "ok": true, "data": … }`.
- Thất bại: `{ "ok": false, "error": { "code": "<mã>" } }`. Giao diện đổi `code` thành câu thông báo qua khoá dịch `errors.<mã>`.
- Mã trạng thái:

| Mã | Nghĩa |
|---|---|
| `401` | chưa đăng nhập |
| `403` | không có quyền |
| `404` | không tìm thấy |
| `409` | dữ liệu vừa bị bên khác đổi |
| `503` | không nối được database |

- **Lệnh ghi là thao tác nhỏ** (ví dụ "đánh dấu G1 của raid X đã xong"), không gửi lại cả khối trạng thái. API áp thao tác lên document mới nhất bằng chính hàm cập nhật của bot. Nguyên tắc này áp dụng từ phần 2 trở đi.
- Giao diện luôn hiện khung chờ (skeleton) trong lúc gọi API.

### API dạng khung ở phần 1
Mỗi API có hai endpoint:
- `GET /internal/bot-guilds` trả `{ ok: true, data: { guildIds: [...] } }`. Chỉ Worker web gọi được.
- `GET /api/whoami` trả lại danh tính trong `x-web-user`, dùng để chứng minh đường ống hoạt động.

## 7. Mục 4: Ngôn ngữ

- **Một lựa chọn chung cho cả web**, không lấy theo từng bot.
- **Mặc định:**
  - Trước khi đăng nhập (trang `/login`, trang từ chối), giao diện lấy theo `navigator.language` của trình duyệt: bắt đầu bằng `vi` thì dùng `vi`, còn lại dùng `en`.
  - Ở `/auth/callback`, nếu chưa có cookie `lang`, Worker đặt cookie này theo `locale` của Discord với cùng luật. Đã có cookie thì giữ nguyên lựa chọn của người dùng.
- **Nút đổi** vi ⇄ en ở góc trên. Lựa chọn lưu trong cookie `lang` (không HttpOnly, Path=/, sống 1 năm).
- Mọi chữ trên giao diện đi qua `t('<khoá>')`.
  - Kiểu khoá sinh từ `en.json`, nên sai khoá là lỗi lúc build.
  - Có test kiểm `vi.json` và `en.json` có cùng bộ khoá.
- Ngôn ngữ đang chọn được gửi xuống API trong `x-web-user.lang`, để chữ do bot sinh ra cũng đúng ngôn ngữ.
- Giờ giấc hiển thị theo múi giờ của trình duyệt. Mốc reset vẫn tính theo luật của bot.
- Giọng văn (tab RaidManage có giữ giọng Artist không) để dành cho vòng thiết kế giao diện.
- Thêm tiếng Nhật sau này là thêm `jp.json` và một lựa chọn trên nút đổi.

## 8. Mục 5: Deploy

### Thứ tự lần đầu (phần 1)
1. `loalogs-api`, từ `cloud/` của `madieukhang/lostarkbotcheckstatus`.
2. `lostark-web`, từ `madieukhang/lostarkweb`.

Worker web khai Service Binding tới API, nên API phải tồn tại trước. Từ lần thứ hai trở đi, các Worker deploy độc lập. Ở phần 4, `raidmanage-api` (từ `cloud/` của `dreamsofdolls/lostarkbotmanageraid`) được deploy trước, rồi Worker web thêm binding `RAIDMANAGE_API`.

### Cách deploy
- Dùng **Workers Builds**: push lên `main` là tự build và deploy.
  - Mỗi Worker đặt *root directory* về thư mục của nó.
  - Lệnh build: `npm ci && npm test && npm run build`. Test đỏ thì không deploy.
  - Gói Free có 3.000 phút build mỗi tháng, 1 build chạy cùng lúc, mỗi build tối đa 20 phút.
- **Khang phải làm một lần:** cài app Cloudflare cho tài khoản `madieukhang` (chứa cả repo LoaLogs lẫn repo web), và chỉ cấp quyền cho hai repo đó. Tài khoản `dreamsofdolls` để tới phần 4. Bước này phải kiểm lại khi dựng (xem mục 10).
- **Dự phòng:** Traine deploy tay bằng `wrangler deploy` từ máy mình.

### Secret và biến (gắn tay trong dashboard)

| Worker | Secret | Biến thường |
|---|---|---|
| `lostark-web` | `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` | `DISCORD_CLIENT_ID`, `PUBLIC_ORIGIN` |
| `loalogs-api` | `BOT_TOKEN` (phần 2 thêm `MONGODB_URI`) | ID officer, senior, member, `OWNER_GUILD_ID` (phần 2) |
| `raidmanage-api` (phần 4) | `BOT_TOKEN`, `MONGO_URI` | danh sách ID Raid Manager |

- Từ phần 2 trở đi, **mỗi API dùng một user Atlas riêng**, chỉ có quyền đọc ghi database của bot đó.
- Giá trị trong `.env` của bot được bọc ngoặc kép. Khi dán sang Cloudflare phải bỏ ngoặc.

### Khác
- **Địa chỉ:** đổi subdomain `spike-mongo-worker` sang tên mới (đề xuất `lostark-tool`). Web nằm ở `lostark-web.lostark-tool.workers.dev`. Tên miền riêng để sau.
- **Quay lui:** Cloudflare giữ các phiên bản cũ. Bản mới lỗi thì dùng `wrangler rollback` hoặc nút trong dashboard.
- **Railway:** thêm `watchPatterns` vào `railway.toml` của mỗi bot (LoaLogs ở phần 1, RaidManage ở phần 4) để bỏ qua `cloud/**`. Sửa riêng API sẽ không làm bot khởi động lại. Thay đổi này nằm trong commit thêm `cloud/` của từng repo bot, kèm CHANGELOG.

## 9. Mục 6: Kiểm thử và định nghĩa "xong"

### Test tự động
Chạy bằng Vitest. Phần Worker chạy trong runtime thật của Cloudflare qua `@cloudflare/vitest-pool-workers`. Discord và API LoaLogs được thay bằng stub.

Các ca bắt buộc:
- `state` lệch thì từ chối, và không cấp phiên.
- Cookie phiên bị sửa chữ ký thì trả `401`. Cookie hết hạn thì trả `401`.
- Người dùng không chung server nào với bot LoaLogs thì bị từ chối (luật B).
- Phiên có `tabs.checklist` rỗng (ví dụ cookie cũ, hoặc người dùng đã rời server) thì `/api/checklist/whoami` trả `403`.
- `/api/raid/*` trả `404` ở phần 1, vì chưa có binding.
- Header `x-web-user` tự khai từ trình duyệt bị xoá. API nhận đúng danh tính do cửa gắn.
- POST với `Origin` lạ trả `403`.
- Đường `/internal/*` không gọi được qua `/api/*`.
- `vi.json` và `en.json` có cùng bộ khoá.

Không viết test cầu kỳ cho phần giao diện hiển thị đơn giản.

### Kiểm bằng tay trên bản preview
- Traine đăng nhập bằng Discord thật và thấy đúng tab.
- Một tài khoản không ở server nào có bot thì bị từ chối.
- Đăng xuất, đổi ngôn ngữ, đăng nhập ngầm khi phiên hết hạn.
- Helper `haiku-tester` bấm phá thử như người dùng mới.

### Phần 1 xong khi
- [ ] Đăng nhập, từ chối và hiện tab đúng luật B.
- [ ] Đổi ngôn ngữ và đăng xuất hoạt động.
- [ ] `/api/checklist/whoami` đi xuyên qua cửa tới API LoaLogs.
- [ ] Toàn bộ test xanh.
- [ ] Hai Worker (`loalogs-api`, `lostark-web`) đã deploy, và bot LoaLogs trên Railway không khởi động lại khi chỉ sửa `cloud/`.
- [ ] **Đã thử gọi thẳng API LoaLogs từ Internet và thất bại** (bằng chứng thật, không chỉ dựa vào cấu hình).

## 10. Rủi ro và điểm phải kiểm khi dựng

| Điểm | Vì sao chưa chắc | Cách xử lý |
|---|---|---|
| Khang cài app Cloudflare cho repo của tài khoản cá nhân | Tài liệu Cloudflare không nói rõ ai được cài | Thử khi dựng. Không được thì deploy tay bằng `wrangler` |
| Cú pháp mẫu đường dẫn của `run_worker_first` (ví dụ `/api/*`) | Tài liệu chỉ có ví dụ đường dẫn cố định | Kiểm khi dựng. Nếu cần thì liệt kê đường dẫn cụ thể |
| Hành vi `prompt=none` của Discord | Chưa thử thật | Có test thủ công. Thất bại thì quay về trang đăng nhập |
| Next.js 16.3 build tĩnh với App Router | Chưa dựng thử | Kiểm ngay bước đầu của kế hoạch |
| Gói Free: 100.000 request mỗi ngày cho Worker | Lượng dùng thật chưa biết | Theo dõi Metrics sau khi ra mắt |

## 11. Ngoài phạm vi phần 1
- Durable Object, MongoDB và mọi tính năng thật của tab Checklist (phần 2).
- Duyệt trên web (phần 2) và nhắc duyệt trong bot (phần 3).
- Mọi thứ của RaidManage: `cloud/`, binding, tab (phần 4).
- Phong cách hình ảnh và giọng văn (vòng thiết kế riêng, có so sánh phương án cạnh nhau).
- Tiếng Nhật, tên miền riêng.
