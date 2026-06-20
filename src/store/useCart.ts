import { create } from 'zustand';

// 1. تحديد شكل المنتج داخل السلة
export interface CartItem {
  id: string;
  name_ar: string;
  price: number;
  quantity: number;
  image_url: string; // سنحتاجها لعرض صورة المنتج المصغرة في السلة
}

// 2. تحديد ما يمكن للسلة فعله (الأفعال)
interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  totalPrice: () => number;
  totalItems: () => number;
}

// 3. بناء ذاكرة السلة
export const useCart = create<CartStore>((set, get) => ({
  items: [], // السلة فارغة في البداية

  // إضافة منتج (إذا كان موجوداً نزيد الكمية، وإذا كان جديداً نضيفه)
  addItem: (newItem) => set((state) => {
    const existingItem = state.items.find((item) => item.id === newItem.id);
    if (existingItem) {
      return {
        items: state.items.map((item) =>
          item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
        ),
      };
    }
    return { items: [...state.items, { ...newItem, quantity: 1 }] };
  }),

  // إزالة منتج (ننقص الكمية، وإذا أصبحت 0 نحذفه تماماً)
  removeItem: (id) => set((state) => {
    const existingItem = state.items.find((item) => item.id === id);
    if (existingItem?.quantity === 1) {
      return { items: state.items.filter((item) => item.id !== id) };
    }
    return {
      items: state.items.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity - 1 } : item
      ),
    };
  }),

  // تفريغ السلة بالكامل بعد تأكيد الطلب
  clearCart: () => set({ items: [] }),

  // حساب السعر الإجمالي بالدرهم تلقائياً
  totalPrice: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  
  // حساب عدد المنتجات (الرقم الذي سيظهر فوق أيقونة السلة)
  totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}));