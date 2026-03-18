import NextAuth from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';
import NaverProvider from 'next-auth/providers/naver';

const handler = NextAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      const socialProfile = profile as
        | {
            email?: string | null;
            name?: string | null;
            nickname?: string | null;
            properties?: {
              nickname?: string | null;
            };
            kakao_account?: {
              profile?: {
                nickname?: string | null;
              };
            };
            response?: {
              email?: string | null;
              nickname?: string | null;
              name?: string | null;
            };
          }
        | undefined;

      if (account) {
        token.provider = account.provider;
      }

      if (socialProfile) {
        token.email =
          token.email ?? socialProfile.email ?? socialProfile.response?.email ?? null;
        token.name =
          token.name ??
          socialProfile.name ??
          socialProfile.nickname ??
          socialProfile.properties?.nickname ??
          socialProfile.kakao_account?.profile?.nickname ??
          socialProfile.response?.nickname ??
          socialProfile.response?.name ??
          null;
      }

      return token;
    },
    async session({ session, token }) {
      const socialSession = session as typeof session & {
        provider?: string;
      };

      socialSession.user = {
        ...socialSession.user,
        email: token.email as string | null | undefined,
        name: token.name as string | null | undefined,
      };
      socialSession.provider = token.provider as string | undefined;
      return socialSession;
    },
  },
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID ?? '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
      // 2026-03-18 수정: 카카오에서 필요한 정보만 받도록 인가 파라미터를 명시
      authorization: {
        url: 'https://kauth.kakao.com/oauth/authorize',
        params: {
          response_type: 'code',
          scope: 'account_email profile_nickname',
        },
      },
    }),
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID ?? '',
      // 2026-03-18 수정: 현재 로컬 env의 NAVER_SECRET도 읽어 Naver 설정 누락을 막기 위함
      clientSecret:
        process.env.NAVER_CLIENT_SECRET ?? process.env.NAVER_SECRET ?? '',
      // 2026-03-18 수정: Naver 로그인에 불필요한 openid scope가 섞이지 않도록 인가 파라미터를 명시
      authorization: {
        url: 'https://nid.naver.com/oauth2.0/authorize',
        params: {
          response_type: 'code',
          scope: '',
        },
      },
    }),
  ],
});

export { handler as GET, handler as POST };
