"use client";

import { useCart } from "../store/useCart";
import { Plus } from "lucide-react";

export default function MenuCard({ product, lang }: { product: any, lang: string }) {
  const addItem = useCart((state) => state.addItem);
  
  const name = lang === 'en' && product.name_en ? product.name_en : 
               lang === 'fr' && product.name_fr ? product.name_fr : 
               product.name_ar;

  return (
    <div className="flex justify-between items-center bg-white border border-border p-3 rounded-[1.5rem] shadow-sm gap-4">
      
      {/* قسم الصورة والزر */}
      <div className="relative shrink-0">
        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={name} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-bold">لا توجد صورة</div>
          )}
        </div>
        
        {/* زر الإضافة الداكن */}
        <button
          onClick={() => addItem(product)}
          className="absolute -bottom-2 -left-2 bg-foreground text-primary w-10 h-10 flex items-center justify-center rounded-xl shadow-md hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus size={22} strokeWidth={3} />
        </button>
      </div>

      {/* قسم النصوص والسعر */}
      <div className="flex-1 flex flex-col items-end text-right">
        <h3 className="font-extrabold text-foreground text-lg uppercase tracking-tight">{name}</h3>
        {product.description_ar && (
          <p className="text-xs text-muted-foreground mt-1 font-medium line-clamp-2">
            {product.description_ar}
          </p>
        )}
        <p className="font-extrabold text-primary mt-3 text-lg flex items-center gap-1">
          <span className="text-xs font-bold text-muted-foreground">MAD</span> {product.price}
        </p>
      </div>
      
    </div>
  );
}