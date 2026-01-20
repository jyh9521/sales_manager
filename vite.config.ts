import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // `build.lib.entry` 的快捷方式。
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['node-adodb'],
            },
          },
        },
      },
      preload: {
        // `build.rollupOptions.input` 的快捷方式。
        // 预加载脚本可能包含 Web 资源，所以使用 `build.rollupOptions.input` 而不是 `build.lib.entry`。
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // 为渲染进程 Polyfill Electron 和 Node.js API。
      // 如果你想在渲染进程中使用 Node.js，需要在主进程中启用 `nodeIntegration`。
      // 参见 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ],
})
