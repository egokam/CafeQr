"use server";
import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function verifyPin(cafeId: string, role: "admin" | "cashier", pin: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (role === "admin") {
    const { data, error } = await supabaseAdmin.from('cafes').select('admin_pin').eq('id', cafeId).single();
    if (error || !data) return false;
    return pin === data.admin_pin;
  } else {
    const { data, error } = await supabaseAdmin.from('cafes').select('cashier_pin').eq('id', cafeId).single();
    if (error || !data) return false;
    return pin === data.cashier_pin;
  }
}

// دالة إرسال كود الاستعادة للإيميل
export async function sendRecoveryEmail(email: string) {
  const { error } = await supabaseAdmin.auth.signInWithOtp({ email });
  return { success: !error, error: error?.message };
}

// دالة التحقق من الكود وتحديث الرموز عند النسيان
export async function verifyOtpAndUpdatePins(email: string, otp: string, cafeId: string, newAdminPin: string, newCashierPin: string) {
  const { error: otpError } = await supabaseAdmin.auth.verifyOtp({ email, token: otp, type: 'email' });
  if (otpError) return { success: false, error: "رمز التحقق غير صحيح" };

  const { error: updateError } = await supabaseAdmin.from('cafes').update({ admin_pin: newAdminPin, cashier_pin: newCashierPin }).eq('id', cafeId);
  if (updateError) return { success: false, error: "حدث خطأ أثناء تحديث الرموز" };
  
  return { success: true };
}

// دالة تحديث إعدادات المقهى الشاملة (الاسم والرموز)
export async function updateCafeSettings(cafeId: string, newName?: string, newAdminPin?: string, newCashierPin?: string, maxCashiers?: number) {
  const updates: any = {};
  if (newName) updates.name = newName;
  if (newAdminPin) updates.admin_pin = newAdminPin;
  if (newCashierPin) updates.cashier_pin = newCashierPin;
  if (maxCashiers !== undefined && !isNaN(maxCashiers)) updates.max_cashiers = Number(maxCashiers);

  if (Object.keys(updates).length === 0) return { success: true };

  const { error } = await supabaseAdmin.from('cafes').update(updates).eq('id', cafeId);
  return { success: !error };
}

// --- عمليات المدير (المنتجات) ---

export async function adminAddProduct(productData: any) {
  const { error } = await supabaseAdmin.from('products').insert([productData]);
  return { success: !error, error: error?.message };
}

export async function adminUpdateProduct(id: string, productData: any) {
  const { error } = await supabaseAdmin.from('products').update(productData).eq('id', id);
  return { success: !error, error: error?.message };
}

export async function adminDeleteProduct(id: string) {
  const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
  return { success: !error, error: error?.message };
}

// --- عمليات الكاشير (الطلبات) ---

export async function cashierUpdateOrderStatus(orderId: string, status: string) {
  const { error } = await supabaseAdmin.from('orders').update({ status }).eq('id', orderId);
  return { success: !error, error: error?.message };
}

export async function cashierMarkOutOfStock(productId: string) {
  const { error } = await supabaseAdmin.from('products').update({ is_active: false }).eq('id', productId);
  return { success: !error, error: error?.message };
}