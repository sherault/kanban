import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Removed transpilePackages for @kanban/shared to rely on pre-built dist
  // which is much more stable in Docker environments.
  turbopack: {
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../'),
  },
}

export default nextConfig
