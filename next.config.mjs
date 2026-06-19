/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    serverComponentsExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium", "@react-pdf/renderer"],
    outputFileTracingExcludes: {
      "*": [
        "**/node_modules/.cache/puppeteer/**",
        "**/node_modules/puppeteer/.local-chromium/**",
        "**/node_modules/puppeteer/.cache/**"
      ]
    }
  }
};

export default nextConfig;
