# LostArk Search

Vite + React 18 SPA deployed to Cloudflare Pages, with a Pages Function that searches MongoDB.

## Local

```bash
npm install
copy .dev.vars.example .dev.vars
# điền MONGODB_URI, MONGODB_DB và MONGODB_COLLECTION trong .dev.vars
npm run pages:dev
```

Mở địa chỉ Wrangler in ra (thường là `http://localhost:8788`). `MONGODB_URI` là secret và không được commit.

## Deploy

- Build command: `npm run build`
- Output directory: `dist`
- Nếu cấu hình deploy command thủ công, dùng `npm run deploy` (không dùng `wrangler deploy`, vì đó là lệnh Workers).
- Đặt `MONGODB_URI` dưới dạng Secret trên Cloudflare Pages; đặt `MONGODB_DB` và `MONGODB_COLLECTION` trong Functions environment variables.
- Bật compatibility flag `nodejs_compat` cho Production và Preview.
- MongoDB Atlas cần cho phép mạng của Pages (thường `0.0.0.0/0`) và user chỉ có quyền đọc collection.

Tên field dùng để tìm và hiển thị tập trung ở `src/config/schema.js`; đồng bộ file schema tương ứng trong `functions/config/schema.js` khi schema MongoDB thay đổi. Hiện tại API tìm prefix trên `name` và các phần tử của `allCharacters`, dùng database `la_blacklist` và collection `blacklist`.
