import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// هذه الدالة هي التي ستتحدث مع قاعدة البيانات لجلب المنتجات وإرسال الطلبات
export const supabase = createClient(supabaseUrl, supabaseKey);