/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-to-img", "pdfjs-dist"],
  },
};

export default nextConfig;
