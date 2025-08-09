// app/components/Navigation.tsx

import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="bg-gray-800 p-4 sticky top-18 shadow-md">
      <ul className="flex space-x-10 justify-center items-center">
        <li>
          <Link
            href="/"
            className="text-white font-semibold text-lg transition-all duration-300 ease-in-out hover:text-gray-300 hover:tracking-wider"
          >
            HOME
          </Link>
        </li>
        <li>
          <Link
            href="/ai_cover_letter"
            className="text-white font-semibold text-lg transition-all duration-300 ease-in-out hover:text-gray-300 hover:tracking-wider"
          >
            AI-자기소개서
          </Link>
        </li>
        <li>
          <Link
            href="/ai_interview"
            className="text-white font-semibold text-lg transition-all duration-300 ease-in-out hover:text-gray-300 hover:tracking-wider"
          >
            AI-면접준비
          </Link>
        </li>
        <li>
          <Link
            href="/board"
            className="text-white font-semibold text-lg transition-all duration-300 ease-in-out hover:text-gray-300 hover:tracking-wider"
          >
            게시판
          </Link>
        </li>
        <li>
          <Link
            href="/dataroom"
            className="text-white font-semibold text-lg transition-all duration-300 ease-in-out hover:text-gray-300 hover:tracking-wider"
          >
            자료실
          </Link>
        </li>
      </ul>
    </nav>
  );
}
