import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    sassOptions: {
        prependData: `@use "@/styles/_vars.scss" as *;`,
    },
}

export default nextConfig;