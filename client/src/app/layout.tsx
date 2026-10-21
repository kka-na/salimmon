import type { Metadata, Viewport } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import { Suspense } from "react";

import { BottomNav, BottomNavFrame } from "@/components/BottomNav";
import { Providers } from "@/components/Providers";
import { Toaster } from "@/components/toast";
import "./globals.css";

const cute = Jua({ weight: "400", variable: "--font-cute", display: "swap", preload: false });
const body = Noto_Sans_KR({ weight: ["400", "500", "700", "800"], variable: "--font-body", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "살림몬 · 우리 집 혼수 도장깨기", template: "%s · 살림몬" },
  description: "혼수 가전·가구를 조사 근거와 함께 탐색하고, 체험·구매 도장을 모으는 모바일 도감",
  applicationName: "살림몬",
  appleWebApp: { capable: true, title: "살림몬", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff8ef",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${cute.variable} ${body.variable}`}>
      <body className="antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-card focus:px-3 focus:py-2">
          본문 바로가기
        </a>
        <Providers>
          <main id="main" className="mx-auto min-h-dvh w-full max-w-[480px] px-4 pb-32">
            {children}
          </main>
          <Suspense fallback={<BottomNavFrame pathname="" />}>
            <BottomNav />
          </Suspense>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
