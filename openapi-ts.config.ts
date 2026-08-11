import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Codegen cho SDK gọi backend `market` (Express + Zod → OpenAPI 3.0).
 *
 * Input mặc định là file tĩnh do BE xuất ra (`npm run openapi:export` bên repo market),
 * nên generate KHÔNG cần bật server. Repo market là checkout riêng cạnh repo này; máy nào
 * đặt khác chỗ thì set `OPENAPI_INPUT` (đường dẫn file hoặc URL `/openapi.json`).
 *
 * Không sinh hook TanStack: hook là việc của `src/queries/**` với key factory `qk`
 * (query.convention §2/§3). Sinh thêm sẽ có hai bộ hook cho cùng một endpoint.
 */
export default defineConfig({
  input: process.env.OPENAPI_INPUT ?? '../market/openapi.json',
  output: { path: 'src/api/generated', postProcess: ['prettier'] },
  plugins: [
    // Không để đuôi `.ts`: hey-api dùng nguyên chuỗi này làm import path trong client.gen.ts,
    // mà tsconfig không bật `allowImportingTsExtensions` -> TS5097.
    { name: '@hey-api/client-fetch', runtimeConfigPath: './src/api/http' },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
