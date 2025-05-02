const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // Add 'composio-core' to external packages to prevent bundling issues on the server
    serverComponentsExternalPackages: ['composio-core'],
  },
  webpack: (config, options) => {
    // Only apply fallbacks for the client-side bundle
    if (!options.isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Keep existing fallbacks for browser compatibility
        path: false,
        process: false,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        perf_hooks: false,
        dns: false,
        // Ensure async_hooks is explicitly false for client bundle
        async_hooks: false,
      };
    }
    // DefinePlugin remains useful for setting environment variables if needed
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV || 'development'
        ),
      })
    );

    return config;
  },
};

module.exports = nextConfig;
