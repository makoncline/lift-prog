/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Assuming you want this
  // Removed the nested PWA config
};

export default nextConfig;
