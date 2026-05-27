/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // 図表抽出用（scripts のみ）。Vercel の Next ビルドに巻き込まない
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist"],
};

export default nextConfig;
