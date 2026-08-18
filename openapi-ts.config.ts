import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Codegen cho SDK gọi backend (Express + Zod → OpenAPI 3.0), repo `docs/Vue`.
 *
 * Input mặc định là spec tĩnh commit sẵn bên đó, nên generate KHÔNG cần bật server.
 * Muốn đọc trực tiếp từ BE đang chạy thì set `OPENAPI_INPUT=http://localhost:5000/openapi.json`.
 * Spec cũ hơn code BE thì chạy `npm run openapi:export` bên `docs/Vue` trước.
 *
 * ĐƯỜNG DẪN THEO THƯ MỤC CHECKOUT, KHÔNG THEO TÊN REPO: git remote bên đó là `market.git`
 * nên đã có lần đường dẫn này bị sửa thành `../market` cho "khớp tên repo" — nhưng thư mục
 * trên đĩa tên `Vue`, nên `api:sync` fail ở bước đọc input. SDK trong `src/api/generated/**`
 * KHÔNG vì thế mà cũ đi: nó vẫn khớp spec, chỉ là không cập nhật được cho tới khi sửa lại
 * dòng dưới. `query.convention.md` §Regenerate ghi đúng `../Vue` từ đầu — config mới là chỗ
 * trôi. Đổi tên thư mục thì sửa dòng dưới, đừng sửa theo tên remote.
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
