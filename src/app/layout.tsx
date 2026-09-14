import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/ui/Nav";

export const metadata: Metadata = {
  title: { default: "메이플 파티 보드", template: "%s · 메이플 파티 보드" },
  description: "메이플스토리 주간 보스 결정 플래너와 파티 관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Nav />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="text-xs text-zinc-500 text-center py-6">
          데이터 출처: NEXON Open API · 결정 가격/티어는 참고용
        </footer>
      </body>
    </html>
  );
}
