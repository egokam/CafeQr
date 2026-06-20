import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // السماح بصور موقع Unsplash
      },
      {
        protocol: 'https',
        hostname: 'hzrteijomqftshzwqrdr.supabase.co', // السماح بصور Supabase الخاصة بك
      },
    ],
  },
};

export default nextConfig;