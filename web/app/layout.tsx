import type { Metadata } from "next";
import ClientLayout from "./client-layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "minikb",
  description: "Knowledge base platform for agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
