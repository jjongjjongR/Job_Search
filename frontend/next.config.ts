// next.config.js
module.exports = {
  images: {
    domains: ["k.kakaocdn.net", "static.nid.naver.com"],
  },
  async rewrites() {
    return [
      // /api/auth/* 요청은 제외하고 나머지만 프록시
      {
        source: "/api/:path((?!auth).*)",
        destination: "http://localhost:3001/:path",
      },
    ];
  },
};