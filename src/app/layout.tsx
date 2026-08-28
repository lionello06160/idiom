import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { GameProvider } from "@/context/GameContext";

const inter = Inter({ subsets: ["latin"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL("https://idiom.lionel0616.chatgpt.site"),
  title: "成語接龍 填填看 | Web Edition",
  description: "精緻、好玩的成語接龍網頁版。挑戰你的成語造詣，輕鬆學習漢字與成語知識。",
  openGraph: {
    title: "成語填填看",
    description: "共享棋盤，一起挑戰你的成語造詣。",
    type: "website",
    locale: "zh_TW",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "成語填填看共享棋盤",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "成語填填看",
    description: "共享棋盤，一起挑戰你的成語造詣。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${outfit.variable}`}>
      <body className={inter.className}>
        <GameProvider>
          {children}
        </GameProvider>
      </body>
    </html>
  );
}
