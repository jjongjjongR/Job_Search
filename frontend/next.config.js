// 2026-05-16 수정: production 런타임에서 TypeScript 설치가 발생하지 않도록 JS 설정 파일로 사용
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
