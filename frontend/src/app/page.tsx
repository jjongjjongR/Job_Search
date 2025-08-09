// src/app/page.tsx

"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">LOGIN</h1>
      
      {session ? (
        <>
          <p>환영합니다, {session.user?.name}님!</p>
          <button className="mt-2 px-4 py-2 bg-red-500 text-white" onClick={() => signOut()}>
            로그아웃
          </button>
        </>
      ) : (
        <>
          <button className="px-4 py-2 bg-yellow-400 text-black" onClick={() => signIn("kakao")}>
            Kakao 로그인
          </button>
          <button className="mt-2 px-4 py-2 bg-green-500 text-white" onClick={() => signIn("naver")}>
            Naver 로그인
          </button>
        </>
      )}
    </main>
  );
}
