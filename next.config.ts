import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.TEACHER_WORKSPACE_TEST === "1" ? ["127.0.0.1"] : [],
  // Isolated browser tests do not share the developer server cache or lock.
  distDir: process.env.TEACHER_WORKSPACE_TEST === "1" ? ".next-teacher" : ".next",
};

export default nextConfig;
