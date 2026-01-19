/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  webpack: (config) => {
    // Ensure single React instance
    config.resolve.alias = {
      ...config.resolve.alias,
      'react': require.resolve('react'),
      'react-dom': require.resolve('react-dom'),
    };
    return config;
  },
};

export default nextConfig;
