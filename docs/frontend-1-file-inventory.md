# Ghi chép chi tiết thư mục `frontend(1)`

## Phạm vi

- Đã đọc 22 file trong `frontend(1)`.
- Đã loại trừ toàn bộ nội dung của `dist/` và `node_modules/`.
- `package-lock.json` được mô tả theo metadata và cây phụ thuộc, không chép lại từng trường integrity/resolved do đây là file sinh tự động.

## Tổng quan dự án

`frontend(1)` là frontend đa trang (multi-page app) cho PriceLens, viết bằng HTML, CSS và JavaScript ES modules, dùng Vite để chạy development server và build. Sản phẩm hướng tới việc theo dõi đúng biến thể sản phẩm, xem giá hiện tại/lịch sử giá, so sánh nhà bán lẻ và tạo cảnh báo giá.

Kiến trúc hiện tại gồm:

- 5 entry HTML: landing, watchlist, thêm sản phẩm, chi tiết sản phẩm, so sánh sản phẩm.
- 5 module JavaScript cấp trang.
- Các module dùng chung cho API, session, shell trang, watchlist item và tiện ích format.
- 4 file CSS tách thành design tokens, base, components và page layouts.
- Vite middleware ánh xạ URL đẹp sang các file HTML tương ứng.

Phần giao diện và accessibility đã được dựng khá đầy đủ, nhưng phần tích hợp nghiệp vụ vẫn chưa hoàn tất. Chỉ có API client/session utilities được chuẩn bị; các trang chưa thực sự gọi API.

## Cây thư mục đã đọc

```text
frontend(1)/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── products/
│   ├── add/
│   │   └── index.html
│   ├── compare.html
│   └── product.html
├── watchlist/
│   └── index.html
└── src/
    ├── api/
    │   └── client.js
    ├── auth/
    │   └── session.js
    ├── components/
    │   ├── common.js
    │   └── watchlist-item.js
    ├── pages/
    │   ├── add-product.js
    │   ├── landing.js
    │   ├── product-compare.js
    │   ├── product-detail.js
    │   └── watchlist.js
    ├── styles/
    │   ├── base.css
    │   ├── components.css
    │   ├── pages.css
    │   └── tokens.css
    ├── utils/
    │   ├── format.js
    │   └── helpers.js
    └── config.js
```

## Các file cấu hình và package

### `package.json`

- Tên package: `pricelens-frontend`, phiên bản `0.1.0`, package private.
- Dùng ES modules qua `"type": "module"`.
- Có ba script:
  - `npm run dev`: chạy Vite development server.
  - `npm run build`: build production bằng Vite.
  - `npm run preview`: xem bản build bằng Vite preview server.
- Chỉ khai báo một dev dependency trực tiếp: `vite` phiên bản tương thích `^8.3.2`.

### `package-lock.json`

- Lockfile npm phiên bản 3 cho `pricelens-frontend@0.1.0`.
- Khóa `vite` ở phiên bản `8.3.2`.
- Gồm 41 package record tính cả root package; 40 package dưới `node_modules`.
- Các nhóm phụ thuộc chính của toolchain gồm `rolldown`, các binary platform của Rolldown, `lightningcss` cùng các binary platform, `postcss`, `nanoid`, `picocolors`, `picomatch`, `tinyglobby`, `fdir`, `source-map-js` và `detect-libc`.
- Nhiều binary platform được đánh dấu optional để npm chỉ dùng binary phù hợp hệ điều hành/kiến trúc.
- Vite/Rolldown yêu cầu Node `^20.19.0 || >=22.12.0`.

### `vite.config.js`

- Tính `projectRoot` từ `import.meta.url` để resolve đường dẫn entry ổn định.
- Khai báo middleware `pageRouteMiddleware` dùng cho cả dev server và preview server.
- Chuẩn hóa URL bằng cách bỏ dấu `/` cuối (trừ root), sau đó ánh xạ:
  - `/watchlist` → `/watchlist/`.
  - `/products/add` → `/products/add/`.
  - `/products/:id/compare` → `/products/compare.html`.
  - `/products/:id` → `/products/product.html`.
- Giữ nguyên query string khi rewrite.
- Cấu hình Rollup multi-page build với 5 entry: landing, watchlist, add product, product detail và product compare.

### `src/config.js`

- Định nghĩa API mặc định là `http://localhost:3000/api`.
- Nếu có biến môi trường `VITE_API_BASE_URL`, giá trị đó được ưu tiên sau khi trim.
- Xuất `API_BASE_URL` và loại bỏ mọi dấu `/` ở cuối.
- File này hiện trùng trách nhiệm với phần đầu của `src/api/client.js` và chưa được file khác import.

## Hạ tầng API và phiên đăng nhập

### `src/api/client.js`

- Tự xác định `API_BASE_URL` từ `VITE_API_BASE_URL`, fallback về localhost; logic này đang lặp lại `src/config.js`.
- Khai báo `ApiError`, mở rộng `Error`, lưu thêm HTTP `status`, mã lỗi nghiệp vụ `code` và `details`.
- `parseResponse(response)`:
  - Trả `null` cho HTTP 204.
  - Parse JSON nếu `Content-Type` chứa `application/json`.
  - Nếu không, đọc text và trả text hoặc `null`.
- `apiRequest(path, options)`:
  - Chuẩn hóa path để không có `/` đầu thừa.
  - Luôn gửi `credentials: 'include'`, phù hợp xác thực bằng cookie/session.
  - Tự gắn `Content-Type: application/json` và `JSON.stringify` body, trừ `FormData`.
  - Chuyển lỗi mạng thành `ApiError('Unable to reach the PriceLens API.')`.
  - Với response không thành công, ưu tiên message/code/details từ `payload.error`; nếu thiếu thì dùng message theo HTTP status.
  - Trả payload đã parse khi thành công.
- Xuất `apiClient` với ba convenience methods: `get`, `post`, `delete`.
- Chưa có `put`, `patch`, timeout, abort, retry hoặc refresh-token flow.

### `src/auth/session.js`

- `getCurrentSession()` gọi `GET /auth/session`, trả `response.data` hoặc `null`.
- `signIn(credentials)` gọi `POST /auth/login`, trả `response.data` hoặc `null`.
- `signOut()` gọi `POST /auth/logout` và không trả dữ liệu.
- `isAuthenticationError(error)` kiểm tra lỗi là `ApiError` có status 401.
- Module đã sẵn sàng nhưng chưa được trang đăng nhập hay trang nghiệp vụ import.

## Component dùng chung

### `src/components/common.js`

- Tạo brand PriceLens bằng DOM API: link về `/`, biểu tượng `⌕`, chữ `Price` và phần nhấn `Lens`.
- Tạo link điều hướng và gắn `aria-current="page"` cho route đang active.
- Header đọc `data-active-route` và `data-variant`:
  - Biến thể home chỉ hiển thị nút “Open watchlist”.
  - Các trang còn lại hiển thị link Watchlist và nút Add product.
- Footer hiển thị brand và thông điệp “Prices are observed, not live.”
- `initializePageShell()` tìm `#site-header` và `#site-footer`, sau đó render shell tương ứng.
- `renderRouteError(message)` tìm vùng status có id kết thúc bằng `page-status` hoặc `[data-page-status]`, gắn class lỗi và nội dung message.

### `src/components/watchlist-item.js`

- Xây dựng một `<li class="watchlist-card">` hoàn toàn bằng DOM API.
- Có helper tạo element, chọn text an toàn và kiểm tra URL ngoài chỉ cho phép giao thức HTTP/HTTPS.
- Hiển thị:
  - Tên sản phẩm và tên biến thể với fallback.
  - Badge trạng thái tracking.
  - Giá hiện tại hoặc “Price unavailable”.
  - Thời điểm quan sát bằng phần tử `<time>`.
  - Badge freshness, đổi `STALE` thành “Stale data” và `UNAVAILABLE` thành “Price unavailable”.
  - Nhà bán lẻ dưới dạng link mở tab mới với `noopener noreferrer`, nếu URL hợp lệ.
- Dùng `formatMoney`, `formatObservationTime`, `formatStatusLabel` từ utilities.
- Component này hiện chưa được `watchlist.js` import và các class `watchlist-card*` không có rule tương ứng trong CSS hiện tại. HTML watchlist lại dùng template `product-card`, cho thấy có hai hướng render chưa được hợp nhất.

## JavaScript theo trang

### `src/pages/landing.js`

- Khởi tạo header/footer.
- Điều khiển dialog đăng nhập:
  - Nút Sign in mở modal và focus ô email.
  - Nút đóng đóng modal.
  - Click trực tiếp lên backdrop đóng modal.
  - Khi modal đóng, focus trở lại nút Sign in.
- Submit form chỉ `preventDefault()`; chưa validate, gọi `signIn`, hiển thị lỗi hay redirect.

### `src/pages/watchlist.js`

- Chỉ gọi `initializePageShell()`.
- Chưa lấy session, gọi API, chuyển các trạng thái placeholder/loading/empty/error/data, render item hoặc xử lý retry.

### `src/pages/add-product.js`

- Khởi tạo header/footer.
- Chặn submit form URL bằng `preventDefault()`.
- Chưa resolve URL, validate phía client, render danh sách biến thể hoặc gửi lệnh thêm vào watchlist.

### `src/pages/product-detail.js`

- Khởi tạo header/footer.
- Lấy product ID từ pathname.
- Nếu hợp lệ:
  - Điền ID vào mọi `[data-product-id]`.
  - Cập nhật link so sánh thành `/products/{encoded-id}/compare`.
- Nếu không hợp lệ, hiển thị lỗi route.
- Chặn submit form tạo alert nhưng chưa gọi API hay validate logic target price.
- Chưa tải metadata sản phẩm, giá hiện tại, lịch sử giá hay active alerts.

### `src/pages/product-compare.js`

- Khởi tạo header/footer.
- Lấy product ID từ pathname.
- Nếu hợp lệ:
  - Điền ID vào `[data-product-id]`.
  - Cập nhật link quay lại chi tiết sản phẩm thành `/products/{encoded-id}`.
- Nếu không hợp lệ, hiển thị lỗi route.
- Chưa tải hoặc render retailer offers và best offer.

## Utilities

### `src/utils/format.js`

- `formatMoney(amount, currencyCode)` yêu cầu amount là chuỗi số thập phân không âm và currency là đúng ba chữ in hoa.
- Nhóm hàng nghìn bằng dấu phẩy.
- Với VND, bỏ phần thập phân và trả dạng `1,234 VND`.
- Với currency khác, luôn pad/cắt còn hai chữ số thập phân, ví dụ `12.5` → `12.50 USD`.
- Dữ liệu không hợp lệ trả “Price unavailable”.
- `formatObservationTime(value)` parse ngày và dùng locale của trình duyệt với date/time style medium/short; dữ liệu lỗi trả “Update time unavailable”.
- `formatStatusLabel(value, fallback)` trim, chuyển về lowercase, thay `_` bằng khoảng trắng và viết hoa ký tự đầu.

### `src/utils/helpers.js`

- `getProductIdFromPathname(pathname)`:
  - Tách URL path thành segment.
  - Chỉ chấp nhận path bắt đầu bằng `products` và segment thứ hai tồn tại/khác `add`.
  - Decode ID; trả `null` nếu decode lỗi.
  - Hàm không bắt buộc path phải có đúng số segment, nên cả detail và compare đều lấy ID từ segment thứ hai.
- `setTextContent(selector, value, root)` đặt text cho tất cả phần tử khớp selector; mặc định root là `document`.
- `formatCurrency(amount, currency, locale)` dùng `Intl.NumberFormat`; mặc định USD/en-US.
- `formatCurrency` hiện chưa được sử dụng và có cách hiển thị tiền khác `formatMoney`.

## Các trang HTML

### `index.html` — Landing page

- Metadata tiếng Anh, responsive viewport và description phục vụ SEO.
- Nạp đủ bốn stylesheet theo thứ tự tokens → base → components → pages.
- Hero giới thiệu PriceLens là công cụ hỗ trợ quyết định, có CTA Track a product, View watchlist và Sign in.
- Card “Price insight” mô tả bốn loại thông tin: exact variant, current price, 30-day history, matching offers.
- Section nền tối trình bày bốn câu hỏi cốt lõi: đang theo dõi gì, độ tin cậy giá, thời điểm mua, nơi bán rẻ hơn.
- CTA cuối dẫn tới trang thêm sản phẩm.
- Header/footer để rỗng và được JS render.
- Có `<dialog>` đăng nhập với email/password, feedback regions và live status.
- Nạp `src/pages/landing.js`.

### `watchlist/index.html` — Danh sách theo dõi

- Header đánh dấu active route là watchlist.
- Phần đầu trang có mô tả và nút Add product.
- Chuẩn bị đầy đủ state containers:
  - Placeholder mặc định đang hiện.
  - Loading, empty, error và data ban đầu đều hidden.
  - Error có message riêng và nút retry.
- Có template card sản phẩm với freshness, retailer, brand, name, variant, price, update time và detail link.
- Vùng data dùng `<div id="watchlist-items">` chứ không phải list.
- Nạp `src/pages/watchlist.js`, nhưng script hiện chưa sử dụng template hoặc đổi state.

### `products/add/index.html` — Thêm sản phẩm

- Form nhập product URL với `type="url"`, autocomplete, placeholder, help text và live feedback.
- Khu vực kết quả resolve ban đầu hidden, có tên/mô tả sản phẩm, fieldset chọn biến thể, nút Add to watchlist và submission feedback.
- Có template radio cho từng biến thể.
- HTML dùng `novalidate`, nên JavaScript dự kiến phải tự quản lý validation UX.
- Nạp `src/pages/add-product.js`, nhưng hiện chỉ chặn submit.

### `products/product.html` — Chi tiết sản phẩm

- Hiển thị placeholder cho brand, name, variant, product reference và badges.
- Khối current price có giá, thời gian quan sát và link retailer ban đầu hidden.
- Khối 30-day history có chart region rỗng và ba thống kê low/high/current.
- CTA so sánh retailer offers.
- Sidebar có form target-price alert và danh sách active alerts.
- Vùng status toàn trang dùng để báo lỗi route/API.
- Nạp `src/pages/product-detail.js`; hiện chỉ xử lý product ID/link và chặn alert form.

### `products/compare.html` — So sánh nhà bán lẻ

- Summary sản phẩm có brand/name/variant và product reference.
- Chuẩn bị các state placeholder/loading/empty/error/data.
- Trong data state có danh sách offer và card tóm tắt best offer.
- Template offer gồm ký tự đại diện retailer, tên/nhãn, giá, availability, thời gian quan sát và link ngoài.
- Link ngoài dùng `target="_blank"` cùng `noopener noreferrer`.
- Nạp `src/pages/product-compare.js`; hiện chưa gọi API hoặc render offer.

## Hệ thống CSS

### `src/styles/tokens.css`

- Khai báo palette xanh đậm/xanh lá/vàng, màu chữ, muted, border, surface, background, success/error/warning và focus rings.
- Typography dùng Inter cho body và Space Grotesk cho display, đều có system fallbacks.
- Có ba mức bo góc, hai shadow, ba chiều rộng layout và năm spacing tokens.

### `src/styles/base.css`

- Import Inter và Space Grotesk từ Google Fonts.
- Reset `box-sizing`, margin body và đồng bộ font cho control.
- Định nghĩa typography responsive bằng `clamp`.
- Thiết lập focus-visible rõ ràng, utility `[hidden]`, `.visually-hidden`, `.muted`, `.small`.
- Tôn trọng `prefers-reduced-motion` bằng cách gần như tắt animation/transition.

### `src/styles/components.css`

- Layout containers cho full, narrow và compare widths.
- Card variants: solid, glass, dark glass.
- Button system: primary, light, gold, ghost, full-width; có hover/active/focus/disabled.
- Sticky header, brand, navigation và footer thường/home.
- Form controls, validation state, hint/status, variant radio cards.
- Semantic feedback classes cho error/success/warning.
- Badges, back/text links, state panels, price typography và section title.
- Product art là gradient placeholder với biểu tượng `⌕`, có compact/summary variants.
- Dialog styling và backdrop.
- Responsive breakpoint 40rem: thu hẹp container, ẩn nav-link, giảm brand/art và xếp footer theo cột.

### `src/styles/pages.css`

- Style shell trang và nền dot pattern.
- Landing page: hero hai cột, gradient/pattern, pill, CTA, preview grid, transition band, dark promise section và CTA panel.
- Watchlist: grid ba cột và product cards.
- Add product: intro/form/result.
- Product detail: overview, hai cột nội dung/sidebar, price card, chart placeholder, stat grid, compare callout, alerts.
- Compare: offer rows dạng grid và best-offer summary.
- Breakpoint 59rem chuyển hero/detail về một cột, products về hai cột, đơn giản hóa offer grid.
- Breakpoint 40rem chuyển nhiều khu vực thành một cột, giảm kích thước/spacing và sắp xếp offer cho mobile.

## Luồng chạy hiện tại

1. Vite phục vụ một trong năm HTML entry.
2. Mỗi HTML nạp chung bốn file CSS và một page module.
3. Page module gọi `initializePageShell()` để dựng header/footer.
4. Với route sản phẩm, middleware rewrite URL đẹp về HTML vật lý; JavaScript đọc ID trực tiếp từ URL gốc trên browser.
5. Hiện chưa có page module nào gọi `apiClient` hoặc session module, nên dữ liệu nghiệp vụ vẫn là placeholder.

## Các điểm đáng chú ý

- `src/config.js` và `src/api/client.js` định nghĩa API base URL trùng nhau.
- `watchlist-item.js` chưa được dùng và không khớp cấu trúc/class của template watchlist hiện tại.
- `session.js` chưa được nối với dialog đăng nhập.
- Các form đều có cấu trúc accessibility tốt nhưng logic submit mới chỉ dừng hành vi mặc định.
- Các state loading/empty/error/data đã có trong HTML nhưng chưa có state controller.
- Hai hàm format tiền (`formatMoney` và `formatCurrency`) dùng hai chiến lược khác nhau; một hàm chưa dùng.
- Không thấy test, lint config, formatter config hay framework UI trong phạm vi đã đọc.
- UI text hiện hoàn toàn bằng tiếng Anh.
