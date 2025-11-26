import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process';
import packageJson from './package.json';

// 1. Get the version from package.json
const version = packageJson.version;

// 2. Get the latest git commit hash (short version)
// We use try/catch in case git isn't installed or initialized
let gitCommit = '';
try {
  gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  gitCommit = 'dev';
}

// 3. Generate a build timestamp
const buildDate = new Date().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Define global constants that are replaced at build time
    '__APP_VERSION__': JSON.stringify(version),
    '__GIT_COMMIT__': JSON.stringify(gitCommit),
    '__BUILD_DATE__': JSON.stringify(buildDate),
  },
})