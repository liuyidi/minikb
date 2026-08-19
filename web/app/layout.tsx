import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "minikb",
  description: "Knowledge base platform for agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
