import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Codegen cho SDK gọi backend (Express + Zod → OpenAPI 3.0), repo `docs/market`.
 *
 * Input mặc định là spec tĩnh commit sẵn bên đó, nên generate KHÔNG cần bật server.
 * Muốn đọc trực tiếp từ BE đang chạy thì set `OPENAPI_INPUT=http://localhost:5000/openapi.json`.
 * Spec cũ hơn code BE thì chạy `npm run openapi:export` bên `docs/market` trước.
 *
 * Trước đây đường dẫn này trỏ `../Vue/openapi.json` — chỗ đó không còn file spec nào, nên
 * `npm run api:sync` hỏng im lặng và SDK đứng lại ở bản sinh từ lâu.
 *
 * Không sinh hook TanStack: hook là việc của `src/queries/**` với key factory `qk`
 * (query.convention §2/§3). Sinh thêm sẽ có hai bộ hook cho cùng một endpoint.
 */
export default defineConfig({
  input: process.env.OPENAPI_INPUT ?? '../market/openapi.json',
  output: { path: 'src/api/generated' },
  plugins: [
    // Không để đuôi `.ts`: hey-api dùng nguyên chuỗi này làm import path trong client.gen.ts,
    // mà tsconfig không bật `allowImportingTsExtensions` -> TS5097.
    { name: '@hey-api/client-fetch', runtimeConfigPath: './src/api/http' },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
