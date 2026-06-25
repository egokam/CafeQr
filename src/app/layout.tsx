import type { Metadata, Viewport } from "next";
import { Tajawal, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "../lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

// استدعاء الخط العربي
const tajawal = Tajawal({ 
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "مقهى النخبة | قائمة الطلبات",
  description: "نظام الطلبات الذكي عبر QR",
};

// 🌟 تلوين شريط المهام في الهواتف الذكية ليتناسب مع الخلفية البيضاء
export const viewport: Viewport = {
  themeColor: "hsl(0, 0%, 100%)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 🛡️ suppressHydrationWarning: ضروري جداً لمنع إضافات المتصفح من كسر التطبيق (الشاشة البيضاء)
    <html lang="ar" dir="rtl" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body 
        suppressHydrationWarning 
        className={`${tajawal.variable} font-sans antialiased bg-background text-foreground min-h-screen flex flex-col relative selection:bg-primary/20`}
      >
        {children}
      </body>
    </html>
  );
}