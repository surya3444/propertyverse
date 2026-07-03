import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const shim = (name: string) => path.resolve(__dirname, 'src/lib/rnw-shims', name);

// Runs the React Native app in the browser via react-native-web.
export default defineConfig(({ mode }) => {
  // Load .env / .env.local (no prefix filter) plus real shell vars, so values can
  // live in frontend/.env instead of being exported in the shell every time.
  const env = loadEnv(mode, process.cwd(), '');
  return {
  plugins: [react()],
  define: {
    // Globals that React Native code expects to exist.
    __DEV__: JSON.stringify(true),
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // Lets the web build point at a different backend without editing source.
    'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL || ''),
    // Base URL of the public Next.js forms app (for shareable form links).
    'process.env.FORMS_WEB_URL': JSON.stringify(env.FORMS_WEB_URL || ''),
    // Public Cloudinary values for direct browser uploads (unsigned preset).
    // These are safe to expose — the cloud name and preset are not secrets.
    'process.env.CLOUDINARY_CLOUD_NAME': JSON.stringify(env.CLOUDINARY_CLOUD_NAME || ''),
    'process.env.CLOUDINARY_UPLOAD_PRESET': JSON.stringify(env.CLOUDINARY_UPLOAD_PRESET || ''),
  },
  resolve: {
    // Order matters: the specific native-only Fabric codegen helpers must be
    // shimmed BEFORE the blanket react-native -> react-native-web alias.
    alias: [
      {
        find: /^react-native\/Libraries\/Utilities\/codegenNativeComponent$/,
        replacement: shim('codegenNativeComponent.js'),
      },
      {
        find: /^react-native\/Libraries\/Utilities\/codegenNativeCommands$/,
        replacement: shim('codegenNativeCommands.js'),
      },
      { find: /^react-native$/, replacement: 'react-native-web' },
    ],
    // Prefer `.web.*` files so platform-specific modules resolve correctly.
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
  },
  optimizeDeps: {
    // Route react-native-screens through the normal dev pipeline (which applies
    // our alias + `.web.*` resolution) rather than the pre-bundler.
    exclude: ['react-native-screens'],
    // These have CommonJS internals and/or platform (.web) files. They must be
    // pre-bundled (so CJS→ESM named/default exports resolve) AND rely on the .web
    // resolution configured in `rolldownOptions.resolve.extensions` below.
    // `warn-once` is a CJS dep of the navigators that breaks without pre-bundling.
    include: [
      'react-native-svg',
      'lucide-react-native',
      '@react-navigation/native',
      '@react-navigation/native-stack',
      '@react-navigation/bottom-tabs',
      'warn-once',
    ],
    // The dep pre-bundler does NOT inherit the top-level `resolve.extensions`,
    // so without this it can't pick the `.web.js` platform variants that many
    // react-native packages ship (e.g. files imported as `./Foo` that only exist
    // as `Foo.web.js` / `Foo.ios.js` / `Foo.android.js`). In Vite 8 this is
    // configured via `rolldownOptions` (the old `esbuildOptions` is deprecated).
    rolldownOptions: {
      resolve: {
        extensions: [
          '.web.tsx',
          '.web.ts',
          '.web.jsx',
          '.web.js',
          '.tsx',
          '.ts',
          '.jsx',
          '.js',
          '.json',
        ],
      },
    },
  },
  server: {
    port: 8081,
  },
  };
});
