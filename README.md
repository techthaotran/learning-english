# Học Tiếng Anh — Ứng dụng tự học

Ứng dụng SPA học từ vựng tiếng Anh với flashcard và spaced repetition (SRS).

## Công nghệ

| Phần | Stack |
|------|--------|
| API | Express + TypeScript, [Turso](https://docs.turso.tech/introduction) (`@libsql/client`), nodemon + tsx |
| GUI | React 19 + TypeScript, Vite, React Router, PWA |
| Package manager | [pnpm](https://pnpm.io) workspace |

## Cấu trúc

```
learning-english/
├── backend/           # Express API — `src/shared/` (types & constants)
└── frontend/          # React SPA — `src/shared/` (types & constants)
```

## Cài đặt

Yêu cầu: Node ≥ 22.5, pnpm ≥ 9.

```bash
pnpm install
```

## Chạy development

```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4001 |
| API | http://localhost:4002 |

## API

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/api/dictionary` | Danh sách phân trang (`?q=`, `?status=`, `?page=`, `?pageSize=`) |
| GET | `/api/dictionary/:id` | Chi tiết một từ |
| POST | `/api/dictionary` | Thêm từ mới |
| PUT | `/api/dictionary/:id` | Cập nhật từ |
| DELETE | `/api/dictionary/:id` | Xóa từ |
| GET | `/api/dictionary/search?q=` | Tìm theo `name` |
| GET | `/api/dictionary/dashboard?userName=` | Thống kê + so sánh người tham gia |
| POST | `/api/participants` | Đăng ký tên khi login (`{ userName }`) |
| GET | `/api/dictionary/flashcards?userName=` | Lấy tối đa 5 thẻ SRS |
| POST | `/api/dictionary/flashcards/review` | Ghi nhận ôn tập |

### Phân trang (quản lý từ)

`GET /api/dictionary?page=1&pageSize=10` trả về:

```json
{ "items": [], "total": 42, "page": 1, "pageSize": 10, "totalPages": 5 }
```

### So sánh Dashboard

Mỗi người đăng nhập bằng tên riêng. Dashboard hiển thị tiến độ cá nhân (lượt ôn, ôn hôm nay, hoàn thành) và bảng so sánh với các `participants` khác.

## PWA

```bash
pnpm build
pnpm preview
```

## Phát âm

Dùng **Web Speech API** (`speechSynthesis`) trên trình duyệt.

## Database — Turso

Backend dùng [Turso](https://docs.turso.tech/introduction) (SQLite-compatible, hosted) qua `@libsql/client`.

### Tạo database trên Turso

```bash
# Cài Turso CLI: https://docs.turso.tech/cli
turso auth signup
turso db create learning-english
turso db show learning-english --url
turso db tokens create learning-english
```

### Biến môi trường backend

| Biến | Mô tả |
|------|--------|
| `TURSO_DATABASE_URL` | URL database (`libsql://...`) — bắt buộc |
| `TURSO_AUTH_TOKEN` | Auth token từ `turso db tokens create` — bắt buộc |

### Env cho Development / Production

- Frontend:
  - `frontend/.env.development` -> `VITE_API_BASE=http://localhost:4002`
  - `frontend/.env.production` -> `VITE_API_BASE=https://api.your-domain.com`
- Backend (local & production đều dùng Turso):
  - `backend/.env.development` -> `PORT`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
  - `backend/.env.production` -> cùng các biến trên

Backend tự load `backend/.env.development` hoặc `backend/.env.production` theo `NODE_ENV`.

## Deploy

1. Deploy **Frontend** lên Vercel với `VITE_API_BASE`.
2. Deploy **Backend** (Vercel, Render, Fly.io, …) với `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
3. Dữ liệu lưu trên Turso Cloud — không cần persistent volume.

### Deploy API lên Vercel (Express zero-config)

Trong **Project Settings → Build and Deployment** (không dùng `builds` legacy trong `vercel.json`):

| Mục | Giá trị |
|-----|---------|
| Root Directory | `backend` |
| Framework Preset | Express |
| Build Command | `pnpm build` (chạy `tsc`) |
| Output Directory | *(để trống — Express preset tự xử lý)* |
| Install Command | `pnpm install` (hoặc để Vercel auto-detect) |

Entry: `src/index.ts` export `default app`. Runtime dùng `src/index.ts`; `pnpm start` (`node dist/index.js`) chỉ cho chạy local / host có Node thường.
