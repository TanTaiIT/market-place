import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Codegen cho SDK gọi backend `API` (Express + Zod → OpenAPI 3.0).
 *
 * Input mặc định là file tĩnh do backend xuất ra (`API/swagger.json`), nên generate
 * KHÔNG cần bật server. Nếu muốn đọc trực tiếp từ BE đang chạy, có thể set
 * `OPENAPI_INPUT=http://localhost:5000/openapi.json`.
 *
 * Không sinh hook TanStack: hook là việc của `src/queries/**` với key factory `qk`
 * (query.convention §2/§3). Sinh thêm sẽ có hai bộ hook cho cùng một endpoint.
 */
export default defineConfig({
  input: process.env.OPENAPI_INPUT ?? '../API/swagger.json',
  output: { path: 'src/api/generated' },
  plugins: [
    // Không để đuôi `.ts`: hey-api dùng nguyên chuỗi này làm import path trong client.gen.ts,
    // mà tsconfig không bật `allowImportingTsExtensions` -> TS5097.
    { name: '@hey-api/client-fetch', runtimeConfigPath: './src/api/http' },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
