import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  // إنشاء استجابة مبدئية
  const response = NextResponse.next();
  
  // 1. نظام تتبع العميل الذكي (Client Fingerprinting)
  // التحقق مما إذا كان العميل يمتلك جلسة نشطة مسبقاً
  let sessionId = request.cookies.get('cafe_lux_session')?.value;

  // إذا كانت هذه أول مرة يمسح فيها الـ QR، نصنع له معرفاً فريداً
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    response.cookies.set('cafe_lux_session', sessionId, {
      httpOnly: true, // يمنع اختراق الـ Cookie عبر جافاسكريبت (مهم جداً للحماية)
      secure: process.env.NODE_ENV === 'production', // يعمل فقط على HTTPS في الإنتاج
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // الجلسة تستمر لـ 12 ساعة (كافية لوقت بقاء العميل في المقهى)
    });
  }

  // 2. إضافة ترويسات الأمان الصارمة (Security Headers)
  // منع عرض الموقع داخل Iframe في مواقع أخرى (حماية من Clickjacking)
  response.headers.set('X-Frame-Options', 'DENY');
  // منع المتصفح من تخمين نوع الملفات (حماية من MIME Sniffing)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // تقليل تسريب الرابط عند الانتقال لمواقع خارجية
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

// تحديد المسارات التي سيعمل عليها هذا الوسيط (يطبق على كل المنصة باستثناء ملفات النظام)
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};