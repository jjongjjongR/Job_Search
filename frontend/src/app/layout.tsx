// app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthContext from "./context/AuthContext";
import Header from "./components/Header";
import Navigation from "./components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "World Job Search Next App",
  description: "Looking for a job with Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#FAFAF9] text-[#1E2A47]`}>
        <AuthContext>
          <div className="mx-auto max-w-screen-xl">
            <Header />
            <Navigation />
            <main className="py-8 px-6 sm:px-12">{children}</main>
          </div>
        </AuthContext>
      </body>
    </html>
  );
}
