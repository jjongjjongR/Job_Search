// 2026-05-16 수정: production 런타임에서 TypeScript 설치가 발생하지 않도록 JS 설정 파일로 사용
// 2026-05-18 신규: AWS 배포 시 backend origin을 localhost가 아닌 환경변수로 주입할 수 있게 함
const backendRewriteBaseUrl =
  process.env.BACKEND_INTERNAL_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3001";

module.exports = {
  images: {
    domains: ["k.kakaocdn.net", "static.nid.naver.com"],
  },
  async rewrites() {
    return [
      // /api/auth/* 요청은 제외하고 나머지만 프록시
      {
        source: "/api/:path((?!auth).*)",
        // 2026-05-18 수정: AWS에서 localhost로 backend를 찾는 문제를 막기 위해 rewrite 목적지를 환경변수 기반으로 변경
        destination: `${backendRewriteBaseUrl}/:path`,
      },
    ];
  },
};
