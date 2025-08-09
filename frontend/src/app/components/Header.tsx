// app/components/Header.tsx

"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import ColorButton from "./ColorButton";
import Link from "next/link";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-10 mb-5 flex items-center justify-between p-4 border-b border-solid border-gray-300 bg-gray-800 text-white shadow-md">
      <div className="text-2xl font-semibold">
        <Link href={"/"}>
          World Job Search
        </Link>
      </div>

      <div className="flex items-center space-x-6">
        {session ? (
          <>
            <ColorButton
              text="My Page"
              onClick={() => window.location.href = "/mypage"}
              className="bg-[#A7C7E7] hover:bg-[#80C6E3] text-black"
            />
            <ColorButton
              text="Sign out"
              onClick={() => signOut()}
              className="bg-red-500 hover:bg-red-400 text-white"
            />
          </>
        ) : (
          <ColorButton
            text="Sign in"
            onClick={() => signIn()}
            className="bg-[#A7C7E7] hover:bg-[#80C6E3] text-black"
          />
        )}
      </div>
    </header>
  );
}
