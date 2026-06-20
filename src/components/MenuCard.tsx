"use client";

import { useCart, CartItem } from "@/store/useCart";
import { Plus, Minus } from "lucide-react";

const formatMAD = (price: number) => {
  return `${Number(price).toFixed(2)} MAD`; // جعلنا العملة موحدة لتناسب كل اللغات
};

export default function MenuCard({ product, lang = "ar" }: { product: any, lang?: string }) {
  const { items, addItem, removeItem } = useCart();
  
  const cartItem = items.find(item => item.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  // تحديد الاسم والوصف بناءً على اللغة المختارة
  const productName = 
    lang === "en" && product.name_en ? product.name_en : 
    lang === "fr" && product.name_fr ? product.name_fr : 
    product.name_ar;

  const productDesc = 
    lang === "en" && product.description_en ? product.description_en : 
    lang === "fr" && product.description_fr ? product.description_fr : 
    product.description_ar;

  return (
    <div className="flex items-center gap-4 py-4 border-b border-border/50 bg-background" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-28 h-28 shrink-0 rounded-3xl overflow-hidden bg-muted">
        <img 
          src={product.image_url || "/placeholder-coffee.jpg"} 
          alt={productName}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 flex flex-col justify-between h-28 pr-1">
        <div>
          <h3 className="font-bold text-foreground text-lg mb-1">{productName}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{productDesc}</p>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <span className="font-bold text-foreground text-md">{formatMAD(product.price)}</span>
          
          {quantity > 0 ? (
            <div className="flex items-center gap-3 bg-muted rounded-full p-1 border border-border/50" dir="ltr">
              <button onClick={() => removeItem(product.id)} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary active:scale-90 transition-transform">
                <Minus size={16} />
              </button>
              <span className="font-bold text-sm w-4 text-center text-foreground">{quantity}</span>
              <button onClick={() => addItem(product)} className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm active:scale-90 transition-transform">
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => addItem(product)}
              className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}