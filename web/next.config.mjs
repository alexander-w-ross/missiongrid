import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This project lives in a subdirectory of a larger repo; pin the tracing root
  // so Next doesn't pick up a parent lockfile.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
