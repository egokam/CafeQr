import type { Metadata } from "next";
import { Tajawal, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // توجيه الصفحة لتكون من اليمين لليسار (RTL) للغة العربية
    <html lang="ar" dir="rtl" className={cn("font-sans", geist.variable)}>
      <body className={`${tajawal.variable} font-sans antialiased bg-background min-h-screen`}>
        {children}
      </body>
    </html>
  );
}