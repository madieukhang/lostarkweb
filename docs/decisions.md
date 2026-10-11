# Các quyết định của dự án web

Mỗi quyết định ghi: ngày, quyết định, lý do, các phương án bị loại. Quyết định mới thêm xuống cuối. Một quyết định bị thay thì giữ nguyên dòng cũ và ghi rõ dòng nào thay nó.

## 2026-10-10: Mục đích của bản web
- **Quyết định:** web có ba vai trò. Thứ nhất, dự phòng cho hai bot Discord khi Railway hết tiền ($1/tháng ở gói free) hoặc gặp sự cố. Thứ hai, nơi đặt các tính năng chỉ web mới làm được. Thứ ba, một sản phẩm đầu tư lâu dài cho người dùng thật.
- **Lý do:** Traine muốn có đường dự phòng, và về lâu dài muốn web thành một sản phẩm thật.
- **Bị loại:** làm web như một giao diện mỏng gọi API nằm trong bot trên Railway. Bot tắt thì API đó tắt theo, nên không dự phòng được gì.

## 2026-10-10: Phạm vi khi bot tắt
- **Quyết định:** web làm được đầy đủ như bot, kể cả thêm, sửa, xoá list và duyệt ngay trên web.
- **Lý do:** Traine chọn bản đầy đủ.
- **Bị loại:** chỉ xem; xem cộng các thao tác cá nhân.

## 2026-10-10: Nhắc duyệt
- **Quyết định:** đơn chờ duyệt do web tạo nằm trong MongoDB như đơn của bot. Officer duyệt được trên web bất cứ lúc nào. Khi bot sống lại, việc đầu tiên nó làm là gửi mọi đơn đang treo cho officer, sau đó nhắc mỗi 24 giờ tới khi có người duyệt. Giờ bot tắt không tính: đồng hồ chạy theo `lastRemindedAt` và được đặt lại lúc bot khởi động.
- **Lý do:** đây là quy tắc Traine đặt ra.

## 2026-10-10: Kiến trúc chung (Hướng 3)
- **Quyết định:** mỗi repo bot có thêm thư mục `cloud/`, chứa một Worker API import thẳng các file luật của chính bot đó. Repo web chỉ làm giao diện.
- **Lý do:** mỗi luật chỉ có một bản, và không import chéo giữa hai bot.
- **Bị loại:** viết lại luật trong repo web (hai bản luật sẽ lệch nhau); tách lõi thành package dùng chung (phải tái cấu trúc cả hai bot trước).

## 2026-10-10: Nền tảng và cách nối MongoDB
- **Quyết định:** chạy trên Cloudflare Workers gói Free. API nối MongoDB qua một Durable Object giữ kết nối, ghim gần cluster Atlas bằng `locationHint`.
- **Lý do:** spike đo trên Cloudflare thật cho thấy mỗi request tự mở kết nối tốn 93–274 ms CPU, vượt xa 10 ms của Worker thường. Request vào Durable Object có 30 giây CPU kể cả ở gói Free, và một lượt check list trong DO chỉ tốn 8–11 ms.
- **Bị loại:** mỗi request tự mở kết nối.

## 2026-10-10: Nơi đặt repo web
- **Quyết định:** dưới tài khoản GitHub của Khang: `madieukhang/lostarkweb`, public.
- **Lý do:** Traine và Khang cùng làm.
- **Bị loại:** GitHub cá nhân của Traine (private hoặc public).

## 2026-10-10: Ai được đăng nhập
- **Quyết định:** chỉ người đang ở ít nhất một server có bot. Sau khi vào, quyền y hệt bot. Mỗi tab chỉ hiện khi người dùng chung server với đúng bot đó.
- **Lý do:** bot chỉ phục vụ những server đã cài nó, nên web dùng cùng ranh giới đó.
- **Bị loại:** mọi người có Discord; chỉ người được mời.

## 2026-10-10: Ngôn ngữ
- **Quyết định:** tiếng Việt và tiếng Anh trước, tiếng Nhật sau. Một lựa chọn chung cho cả web: mặc định theo trình duyệt (trước khi đăng nhập) hoặc theo `locale` của Discord, đổi được, lưu trong cookie.
- **Lý do:** người dùng tab Checklist phần lớn đọc tiếng Anh, tab RaidManage phần lớn đọc tiếng Việt.
- **Bị loại:** đủ ba ngôn ngữ ngay từ đầu; chỉ tiếng Việt; mỗi tab lấy ngôn ngữ theo bot riêng.

## 2026-10-10: Dáng phần nền (Cách 1)
- **Quyết định:** một cửa duy nhất. Worker web phục vụ trang Next.js build tĩnh, giữ phần đăng nhập Discord bằng cookie HttpOnly, và chuyển `/api/*` qua Service Binding tới các Worker API. Các Worker API không có địa chỉ công khai.
- **Lý do:** an toàn nhất, rẻ nhất về CPU, và không phải xử lý CORS.
- **Bị loại:** Next.js SSR qua OpenNext (tốn CPU, chưa chắc hỗ trợ Next 16); API công khai cộng token cầm trong JavaScript (CORS, token dễ bị lộ qua XSS).

## 2026-10-10: Ứng dụng Discord cho đăng nhập
- **Quyết định:** tạo một ứng dụng Discord mới, riêng cho web. Traine tạo và giữ; Khang tham gia qua Developer Team nếu cần.
- **Lý do:** danh tính trung lập cho cả hai tab, tự quản lý được, và mã bí mật tách khỏi hai bot.
- **Bị loại:** dùng lại ứng dụng của một bot.

## 2026-10-10: Thứ tự làm
- **Quyết định:** làm trọn LoaLogs trước: nền, tab Checklist, sửa bot LoaLogs. RaidManage làm sau.
- **Lý do:** Traine ưu tiên LoaLogs. Làm trọn một bên sớm cho ra một sản phẩm dùng được.
- **Bị loại:** làm song song cả hai tab.

## 2026-10-11: Vòng thiết kế giao diện
- **Quyết định:** làm sau phần 1 và trước phần 2, dùng bộ skill `ui-ux-pro-max` và mock các phương án đặt cạnh nhau. Trong phần 1, giao diện để trơn, chỉ cần chạy đúng.
- **Lý do:** dựng xong đường ống trước, rồi mới chọn diện mạo một lần cho mọi tab.
- **Bị loại:** thiết kế giao diện ngay trong phần 1.

## 2026-10-11: Địa chỉ web
- **Quyết định:** đổi subdomain `workers.dev` của tài khoản Cloudflare từ `spike-mongo-worker` (do lần deploy spike tự đăng ký) thành `lostark-tool`. Web nằm ở `lostark-web.lostark-tool.workers.dev`. Tên miền riêng để sau.
- **Lý do:** miễn phí, và đủ rõ ràng.

## 2026-10-10: `lostark-central`
- **Quyết định:** không dùng và không lấy gì từ `dreamsofdolls/lostark-central`.
- **Lý do:** đó là dự án cũ của Khang, và Khang đồng ý bỏ.
