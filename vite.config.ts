import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  // GitHub Pages는 저장소 경로 아래에 배포하고, 로컬 개발은 기존 루트를 유지합니다.
  base: command === 'build' ? '/happy-riina-day/' : '/',
  plugins: [react(), tailwindcss()],
  // Worker 정적 번들에서는 Supabase SDK가 불필요하므로 비활성 대체 모듈로 연결합니다.
  resolve: {
    alias:
      mode === 'worker'
        ? [
            {
              find: '../../lib/supabase/client',
              replacement: fileURLToPath(
                new URL(
                  './src/lib/supabase/worker-disabled.ts',
                  import.meta.url,
                ),
              ),
            },
          ]
        : [],
  },
}));
