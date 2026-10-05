/** @type {import('next').NextConfig} */
const backendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/timetables/generate', destination: '/admin/generate', permanent: true },
      { source: '/timetables', destination: '/admin/timetables', permanent: true },
      { source: '/timetables/:id', destination: '/admin/timetables/:id', permanent: true },
      { source: '/courses', destination: '/admin/courses', permanent: true },
      { source: '/faculty', destination: '/admin/faculty', permanent: true },
      { source: '/rooms', destination: '/admin/rooms', permanent: true },
      { source: '/time-slots', destination: '/admin/time-slots', permanent: true },
      { source: '/sections', destination: '/admin/sections', permanent: true },
      { source: '/constraints', destination: '/admin/constraints', permanent: true },
      { source: '/conflicts', destination: '/admin/conflicts', permanent: true },
      { source: '/generate', destination: '/admin/generate', permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl.replace(/\/+$/, "")}/api/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;

