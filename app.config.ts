// File này chạy bằng Node lúc build (không vào bundle app) — cần type của Node cho `node:fs`.
/// <reference types="node" />
import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Lớp động phủ lên `app.json` — Expo đọc `app.json` trước rồi đưa vào đây qua `config`.
 *
 * Chỉ tồn tại vì một thứ: `google-services.json` (credential FCM cho push Android) KHÔNG nằm trong
 * repo (HARD#19 + .gitignore). Máy dev đặt file ở gốc repo; EAS build lấy từ file secret
 * `GOOGLE_SERVICES_JSON` (`eas env:create --type file`). Không có cả hai thì build vẫn chạy, chỉ
 * là push Android không nhận được — đúng trạng thái trước khi tạo project Firebase.
 *
 * `export default` ở đây là hợp đồng của Expo cho file cấu hình gốc, không thuộc `src/**` (HARD#1).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (existsSync('./google-services.json') ? './google-services.json' : undefined);

  return {
    ...config,
    name: config.name ?? 'Ghim',
    slug: config.slug ?? 'ghim',
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
