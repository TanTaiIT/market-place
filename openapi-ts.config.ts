import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Codegen cho SDK gọi backend (Express + Zod → OpenAPI 3.0), repo `docs/Vue`.
 *
 * Input mặc định là spec tĩnh commit sẵn bên đó, nên generate KHÔNG cần bật server.
 * Muốn đọc trực tiếp từ BE đang chạy thì set `OPENAPI_INPUT=http://localhost:5000/openapi.json`.
 * Spec cũ hơn code BE thì chạy `npm run openapi:export` bên `docs/Vue` trước.
 *
 * Đường dẫn trước đây là `../market/openapi.json` — repo BE từng tên `market` rồi đổi thành
 * `Vue`, và không ai sửa dòng này. Hệ quả KHÔNG phải một lỗi ồn ào: `api:sync` chỉ đơn giản
 * không chạy được, nên SDK đứng im ở một bản spec cũ trong khi BE đi tiếp — tới lúc BE gỡ
 * `slug` khỏi tổ chức thì app vẫn đọc `org.slug` và nhận `undefined`. Một đường dẫn chết ở
 * file config là cách rẻ nhất để hai bên trôi khỏi nhau mà không ai hay.
 *
 * Không sinh hook TanStack: hook là việc của `src/queries/**` với key factory `qk`
 * (query.convention §2/§3). Sinh thêm sẽ có hai bộ hook cho cùng một endpoint.
 */
export default defineConfig({
  input: process.env.OPENAPI_INPUT ?? '../Vue/openapi.json',
  output: { path: 'src/api/generated' },
  plugins: [
    // Không để đuôi `.ts`: hey-api dùng nguyên chuỗi này làm import path trong client.gen.ts,
    // mà tsconfig không bật `allowImportingTsExtensions` -> TS5097.
    { name: '@hey-api/client-fetch', runtimeConfigPath: './src/api/http' },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
