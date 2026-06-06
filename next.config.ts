import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    sassOptions: {
        additionalData: `@use "@/styles/_vars" as *;`,
    },
}

export default nextConfig;