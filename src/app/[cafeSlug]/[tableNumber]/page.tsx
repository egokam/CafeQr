"use client";

import { useState, useEffect, use } from "react";
import { useCart } from "../../../store/useCart";
import MenuCard from "../../../components/MenuCard";
import { Receipt, X as XIcon, Clock, CheckCircle, Coffee, CakeSlice, CupSoda, Croissant } from "lucide-react";
import { supabase } from "../../../lib/supabase";

const TRANSLATIONS: Record<string, any> = {
  ar: {
    subtitle: "اكتشف المذاق الأصيل ☕", empty: "لا توجد منتجات في هذا القسم حالياً.",
    confirmOrder: "تأكيد الطلب", sending: "جاري الإرسال...", itemsCount: "منتج", total: "الإجمالي",
    reviewing: "قيد المراجعة ⏳", preparing: "جاري التحضير 👨‍🍳", ready: "جاهز للتقديم 🚶‍♂️",
    orderNum: "رقم الطلب", addMore: "+ طلب شيء آخر", cancel: "إلغاء الطلب",
    myOrders: "طلباتي الحالية", emptyOrders: "لا توجد طلبات نشطة حالياً.", close: "إغلاق",
    categories: [
      { id: "coffee", name: "القهوة", icon: Coffee }, { id: "sweets", name: "الحلوى", icon: CakeSlice },
      { id: "juice", name: "عصائر", icon: CupSoda }, { id: "bakery", name: "مخبوزات", icon: Croissant }
    ]
  },
  en: {
    subtitle: "Discover Authentic Taste ☕", empty: "No products in this category.",
    confirmOrder: "Confirm Order", sending: "Sending...", itemsCount: "items", total: "Total",
    reviewing: "Reviewing ⏳", preparing: "Preparing 👨‍🍳", ready: "Ready! 🚶‍♂️",
    orderNum: "Order #", addMore: "+ Add more", cancel: "Cancel",
    myOrders: "My Orders", emptyOrders: "No active orders.", close: "Close",
    categories: [
      { id: "coffee", name: "Coffee", icon: Coffee }, { id: "sweets", name: "Sweets", icon: CakeSlice },
      { id: "juice", name: "Juices", icon: CupSoda }, { id: "bakery", name: "Bakery", icon: Croissant }
    ]
  },
  fr: {
    subtitle: "Découvrez le goût authentique ☕", empty: "Aucun produit dans cette catégorie.",
    confirmOrder: "Confirmer la cmd", sending: "Envoi...", itemsCount: "articles", total: "Total",
    reviewing: "En révision ⏳", preparing: "Préparation 👨‍🍳", ready: "Prêt! 🚶‍♂️",
    orderNum: "N° Cmd", addMore: "+ Ajouter", cancel: "Annuler",
    myOrders: "Mes Commandes", emptyOrders: "Aucune commande active.", close: "Fermer",
    categories: [
      { id: "coffee", name: "Café", icon: Coffee }, { id: "sweets", name: "Desserts", icon: CakeSlice },
      { id: "juice", name: "Jus", icon: CupSoda }, { id: "bakery", name: "Boulangerie", icon: Croissant }
    ]
  }
};

const LANGUAGES = ["ar", "fr", "en"];
const formatMAD = (price: number) => `${Number(price).toFixed(2)}`;

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

export default function ClientMenuPage({ params }: { params: Promise<{ cafeSlug: string, tableNumber: string }> }) {
  const { cafeSlug, tableNumber } = use(params);
  const { items, totalItems, totalPrice, clearCart } = useCart();
  
  const [activeLang, setActiveLang] = useState("ar");
  const t = TRANSLATIONS[activeLang]; 
  const [activeCategoryId, setActiveCategoryId] = useState("coffee");
  
  const [products, setProducts] = useState<any[]>([]);
  const [cafeData, setCafeData] = useState<any>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // جلب اسم المقهى الديناميكي
  const displayTitle = cafeData?.name ? cafeData.name : (activeLang === 'ar' ? "مقهى النخبة" : activeLang === 'fr' ? "Café Élite" : "Elite Cafe");

  const fetchUserOrders = async (sessionId: string) => {
    const { data } = await supabase.from('orders').select('*').eq('session_id', sessionId)
      .neq('status', 'completed').neq('status', 'rejected').neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    if (data) setActiveOrders(data);
  };

  useEffect(() => {
    const fetchRealData = async () => {
      setIsLoading(true);
      const { data: cData } = await supabase.from('cafes').select('id, name, latitude, longitude').eq('slug', cafeSlug).single();
      if (!cData) { setIsLoading(false); return; }
      setCafeData(cData);

      const { data: tData } = await supabase.from('tables').select('id').eq('cafe_id', cData.id).eq('table_number', tableNumber).single();
      if (tData) setTableId(tData.id);

      const { data: pData } = await supabase.from('products').select('*').eq('cafe_id', cData.id).eq('is_active', true);
      if (pData) setProducts(pData);

      let sessionId = localStorage.getItem('cafe_lux_client_session');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('cafe_lux_client_session', sessionId);
      }

      await fetchUserOrders(sessionId);
      setIsLoading(false);
    };
    fetchRealData();
  }, [cafeSlug, tableNumber]);

  // 📡 إعداد المراقبة الحية (Realtime Listener)
  useEffect(() => {
    const sessionId = localStorage.getItem('cafe_lux_client_session');
    if (!sessionId) return;
    
    const channel = supabase.channel(`client-orders-${sessionId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'orders', 
          filter: `session_id=eq.${sessionId}` 
        }, 
      (payload) => { 
        fetchUserOrders(sessionId);
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCheckout = () => {
    if (totalItems() === 0 || !cafeData || !tableId) return;
    setIsSubmitting(true);

    if (!navigator.geolocation) {
      alert(activeLang === 'ar' ? "متصفحك لا يدعم تحديد الموقع." : "Geolocation is not supported by your browser.");
      setIsSubmitting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        if (cafeData.latitude && cafeData.longitude) {
          const distance = getDistance(userLat, userLng, cafeData.latitude, cafeData.longitude);
          if (distance > 100) {
            alert(activeLang === 'ar' ? `عذراً! أنت بعيد عن المقهى بمسافة ${Math.round(distance)} متر.` : `Sorry! You are ${Math.round(distance)}m away.`);
            setIsSubmitting(false);
            return;
          }
        }

        try {
          const sessionId = localStorage.getItem('cafe_lux_client_session');
          const { data, error } = await supabase.from('orders').insert([{ cafe_id: cafeData.id, table_id: tableId, session_id: sessionId, items: items, total_amount: totalPrice(), status: 'pending' }]).select().single();
          if (error) throw error;
          
          setActiveOrders(prev => [data, ...prev]);
          setShowOrdersModal(true);
          clearCart();
        } catch (error) {
          alert("حدث خطأ في إرسال الطلب.");
        } finally {
          setIsSubmitting(false);
        }
      },
      (error) => {
        alert(activeLang === 'ar' ? "يرجى السماح بالوصول إلى موقعك لتأكيد الطلب." : "Please allow location access.");
        setIsSubmitting(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm(activeLang === 'ar' ? "هل أنت متأكد من الإلغاء؟" : "Are you sure?")) return;
    try {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
      setActiveOrders(prev => prev.filter(o => o.id !== orderId));
      if (activeOrders.length <= 1) setShowOrdersModal(false);
    } catch (error) {
      alert("خطأ في الإلغاء.");
    }
  };

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center font-bold text-foreground">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-background pb-32" dir={activeLang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* 🌟 نافذة الطلبات الحالية */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto p-6 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-extrabold text-foreground">{t.myOrders}</h2>
            <button onClick={() => setShowOrdersModal(false)} className="bg-muted p-2 rounded-full text-muted-foreground hover:bg-gray-200 transition-colors">
              <XIcon size={24} />
            </button>
          </div>

          <div className="space-y-4 flex-1">
            {activeOrders.length === 0 ? (
              <p className="text-center text-muted-foreground mt-10 font-bold">{t.emptyOrders}</p>
            ) : (
              activeOrders.map(order => (
                <div key={order.id} className="bg-white p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-muted-foreground">{t.orderNum}: #{order.id.split('-')[0]}</span>
                      <h3 className="font-extrabold text-xl mt-1 text-foreground">{formatMAD(order.total_amount)} <span className="text-sm font-bold text-muted-foreground">MAD</span></h3>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {order.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock size={12}/> {t.reviewing}</span>}
                      {order.status === 'accepted' && <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{t.preparing}</span>}
                      {order.status === 'ready' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle size={12}/> {t.ready}</span>}
                    </div>
                  </div>
                  
                  <div className="bg-muted/30 p-3 rounded-lg text-sm text-foreground font-bold">
                    {order.items.map((item:any, i:number) => (
                      <div key={i} className="flex justify-between">
                        <span>{item.quantity}x {activeLang === 'en' && item.name_en ? item.name_en : activeLang === 'fr' && item.name_fr ? item.name_fr : item.name_ar}</span>
                      </div>
                    ))}
                  </div>

                  {order.status === 'pending' && (
                    <button onClick={() => handleCancelOrder(order.id)} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors mt-2">
                      {t.cancel}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <button onClick={() => setShowOrdersModal(false)} className="mt-8 bg-foreground text-white py-4 rounded-xl font-bold w-full shadow-lg transition-transform active:scale-95">
            {t.addMore}
          </button>
        </div>
      )}

      {/* 🌟 الهيدر الكلاسيكي النظيف */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-border/50">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">{displayTitle}</h1>
          <p className="text-xs text-primary font-bold mt-1 uppercase">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3" dir="ltr">
          <div className="flex gap-1 bg-muted p-1 rounded-full border border-border/50">
            {LANGUAGES.map(lang => (
              <button key={lang} onClick={() => setActiveLang(lang)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-colors ${activeLang === lang ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>{lang}</button>
            ))}
          </div>
          
          {activeOrders.length > 0 && (
            <button onClick={() => setShowOrdersModal(true)} className="relative p-2 text-foreground bg-muted rounded-full hover:bg-gray-200 transition-colors">
              <Receipt size={20} />
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                {activeOrders.length}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* 🌟 أقسام المنيو */}
      <div className="px-5 py-6 overflow-x-auto scrollbar-none flex gap-3 bg-muted/20">
        {t.categories.map((cat: any) => (
          <button key={cat.id} onClick={() => setActiveCategoryId(cat.id)} className={`px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2.5 shadow-sm active:scale-95 ${activeCategoryId === cat.id ? "bg-foreground text-white" : "bg-white text-foreground border border-border"}`}>
            <cat.icon size={18} className={`${activeCategoryId === cat.id ? 'text-primary' : 'text-muted-foreground'}`} /> {cat.name}
          </button>
        ))}
      </div>

      <main className="px-6 mt-6 space-y-3">
        {/* 🌟 المكون السري الذي أصلح مشكلة اختفاء المنتجات مع اللغات */}
        <div className="flex flex-col gap-3">
          {(() => {
            const filteredProducts = products.filter(p => {
              const dbCat = p.category;
              if (activeCategoryId === 'coffee') return dbCat === 'القهوة';
              if (activeCategoryId === 'sweets') return dbCat === 'الحلوى';
              if (activeCategoryId === 'juice') return dbCat === 'عصائر';
              if (activeCategoryId === 'bakery') return dbCat === 'مخبوزات';
              return false;
            });

            if (filteredProducts.length === 0) {
              return (
                <div className="bg-white border border-border rounded-2xl p-10 flex flex-col items-center justify-center mt-4">
                  <Coffee size={40} className="text-muted-foreground/30 mb-3" />
                  <p className="text-center text-muted-foreground font-bold">{t.empty}</p>
                </div>
              );
            }

            return filteredProducts.map((product) => (
              <MenuCard key={product.id} product={product} lang={activeLang} />
            ));
          })()}
        </div>
      </main>

      {/* 🌟 شريط السلة السفلي النظيف */}
      {totalItems() > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-border/50 p-6 shadow-[0_-15px_60px_rgba(0,0,0,0.06)] z-50 rounded-t-[2rem]">
          <div className="max-w-md mx-auto flex items-center justify-between gap-6" dir={activeLang === 'ar' ? 'rtl' : 'ltr'}>
            <button onClick={handleCheckout} disabled={isSubmitting} className={`flex-1 bg-foreground text-white h-16 rounded-[1.5rem] font-bold text-xl transition-transform ${isSubmitting ? 'opacity-70' : 'active:scale-[0.97]'}`}>
              {isSubmitting ? t.sending : t.confirmOrder}
            </button>
            <div className={`flex flex-col ${activeLang === 'ar' ? 'items-end pr-3' : 'items-start pl-3'}`}>
              <span className="text-xs font-bold text-muted-foreground">{totalItems()} {t.itemsCount}</span>
              <span className="text-2xl font-black text-primary">{formatMAD(totalPrice())}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}