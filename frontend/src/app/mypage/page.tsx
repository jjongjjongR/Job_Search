"use client";

import { useSession } from "next-auth/react";
import Image from "next/image";

export default function MyPage() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold mb-4">마이페이지</h1>
        <p>먼저 로그인 해주세요.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">마이페이지</h1>
      <div className="flex items-center gap-4">
        <Image
          src={session.user?.image || "/default-profile.png"}
          alt="프로필 이미지"
          width={80}
          height={80} 
          className="rounded-full"
          />
        <div>
          <p className="text-lg font-semibold">{session.user?.name}</p>
          <p className="text-gray-500">{session.user?.email}</p>
        </div>
      </div>
    </main>
  );
}
