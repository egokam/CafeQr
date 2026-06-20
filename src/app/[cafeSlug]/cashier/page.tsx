"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { Check, X, Clock, ChefHat, AlertOctagon, Printer, Lock } from "lucide-react";
import { verifyPin, cashierUpdateOrderStatus, cashierMarkOutOfStock } from "@/actions/auth";

const formatMAD = (price: number) => {
  return `${Number(price).toFixed(2)} د.م`;
};

export default function CashierDashboard({ params }: { params: Promise<{ cafeSlug: string }> }) {
  const { cafeSlug } = use(params);
  
  // 🛡️ حالات الحماية
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [cafeId, setCafeId] = useState<string | null>(null);
  
  const [printOrder, setPrintOrder] = useState<any>(null);

  const fetchOrders = async (cId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*, tables(table_number)')
      .eq('cafe_id', cId)
      .neq('status', 'completed')
      .neq('status', 'rejected')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  useEffect(() => {
    const isLogged = sessionStorage.getItem('cashier_authenticated');
    if (isLogged === 'true') {
      setIsAuthenticated(true);
    }

    const setupCashier = async () => {
      const { data: cafeData } = await supabase.from('cafes').select('id').eq('slug', cafeSlug).single();
      if (!cafeData) return;
      setCafeId(cafeData.id);
      await fetchOrders(cafeData.id);

      const channel = supabase.channel('realtime-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `cafe_id=eq.${cafeData.id}` }, (payload) => {
          fetchOrders(cafeData.id);
          if (payload.eventType === 'INSERT') {
             new Audio('/bell.mp3').play().catch(() => {});
          }
        }).subscribe();

      return () => { supabase.removeChannel(channel); };
    };
    setupCashier();
  }, [cafeSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !cafeId) return;

    setIsChecking(true);
    const isValid = await verifyPin(cafeId, "cashier", pinInput);
    setIsChecking(false);

    if (isValid) {
      setIsAuthenticated(true);
      sessionStorage.setItem('cashier_authenticated', 'true');
      setAttempts(0);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPinInput("");
      
      if (newAttempts >= 5) {
        setIsLocked(true);
        alert("تم حظرك مؤقتاً بسبب كثرة المحاولات الخاطئة. يرجى الانتظار دقيقة.");
        setTimeout(() => {
          setIsLocked(false);
          setAttempts(0);
        }, 60000);
      } else {
        alert(`الرمز غير صحيح ❌ (متبقي ${5 - newAttempts} محاولات)`);
      }
    }
  };

const updateOrderStatus = async (orderId: string, newStatus: string) => {
    // تحديث الحالة عبر السيرفر بأمان
    const { success } = await cashierUpdateOrderStatus(orderId, newStatus);
    if (!success) alert("حدث خطأ أثناء تحديث الطلب.");
  };

  const markOutOfStock = async (productId: string, productName: string) => {
    if(!confirm(`هل أنت متأكد أن "${productName}" قد نفد؟ سيتم إخفاؤه فوراً.`)) return;
    // الإيقاف عبر السيرفر بأمان
    const { success } = await cashierMarkOutOfStock(productId);
    if (success) alert(`تم إيقاف "${productName}".`);
    else alert("حدث خطأ أثناء إيقاف المنتج.");
  };

  const handlePrintReceipt = (order: any) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // 🛡️ شاشة القفل للكاشير
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-border w-full max-w-sm text-center">
          <div className="bg-foreground w-16 h-16 rounded-full flex items-center justify-center text-white mx-auto mb-6">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-extrabold mb-2">منطقة الكاشير</h2>
          <p className="text-muted-foreground mb-8 text-sm">يرجى إدخال الرمز السري لاستقبال الطلبات</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="password" 
              value={pinInput} 
              onChange={(e) => setPinInput(e.target.value)}
              className="border-2 border-border rounded-xl p-4 text-center text-2xl tracking-[0.5em] focus:outline-foreground focus:border-foreground transition-colors"
              placeholder="••••"
              autoFocus
              disabled={isLocked || isChecking}
            />
            <button disabled={isChecking || isLocked} type="submit" className={`py-4 rounded-xl font-bold transition-colors text-white ${isLocked ? 'bg-red-500 cursor-not-allowed' : isChecking ? 'bg-primary/70' : 'bg-foreground hover:bg-foreground/90'}`}>
              {isLocked ? "محظور مؤقتاً 🚫" : isChecking ? "جاري التحقق..." : "دخول"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { margin: 0; size: 80mm auto; }
          body { background-color: white; margin: 0; padding: 0; }
        }
      `}} />

      <div className="min-h-screen bg-muted/20 p-6 md:p-12 no-print" dir="rtl">
        <header className="mb-10 flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-border">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground">شاشة الكاشير ☕</h1>
            <p className="text-muted-foreground mt-1">إدارة الطلبات الحية</p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-bold">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            يستقبل الطلبات
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.length === 0 ? (
            <div className="col-span-full text-center py-20 text-muted-foreground text-xl font-bold">
              لا توجد طلبات نشطة حالياً.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className={`bg-white rounded-3xl p-6 shadow-md border-2 transition-all ${order.status === 'pending' ? 'border-yellow-400' : order.status === 'accepted' ? 'border-blue-400' : 'border-green-400'}`}>
                
                <div className="flex justify-between items-start mb-6 border-b border-border/50 pb-4">
                  <div>
                    <h2 className="text-2xl font-extrabold text-foreground">طاولة {order.tables?.table_number?.replace('table_', '')}</h2>
                    <p className="text-xs text-muted-foreground mt-1">رقم: #{order.id.split('-')[0]}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="block text-xl font-extrabold text-primary">{formatMAD(order.total_amount)}</span>
                    <button 
                      onClick={() => handlePrintReceipt(order)}
                      className="flex items-center gap-1 bg-muted text-foreground px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                      title="طباعة تذكرة الطلب"
                    >
                      <Printer size={16} /> طباعة
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-8 min-h-[120px]">
                  {order.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center bg-muted/30 p-2 rounded-lg border border-border/50">
                      <div className="flex items-center gap-3">
                        <span className="bg-primary text-white w-6 h-6 flex items-center justify-center rounded-md font-bold text-sm">x{item.quantity}</span>
                        <span className="font-bold text-foreground">{item.name_ar}</span>
                      </div>
                      <button onClick={() => markOutOfStock(item.id, item.name_ar)} className="text-red-500 bg-red-50 p-1.5 rounded-md hover:bg-red-500 hover:text-white transition-colors">
                        <AlertOctagon size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto">
                  {order.status === 'pending' && (
                    <>
                      <button onClick={() => updateOrderStatus(order.id, 'accepted')} className="flex items-center justify-center gap-2 bg-foreground text-white py-3 rounded-xl font-bold hover:bg-foreground/80">
                        <Check size={18} /> قبول
                      </button>
                      <button onClick={() => updateOrderStatus(order.id, 'rejected')} className="flex items-center justify-center gap-2 bg-red-100 text-red-600 py-3 rounded-xl font-bold hover:bg-red-200">
                        <X size={18} /> رفض
                      </button>
                    </>
                  )}
                  {order.status === 'accepted' && (
                    <button onClick={() => updateOrderStatus(order.id, 'ready')} className="col-span-2 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/30">
                      <ChefHat size={20} /> جاهز للتقديم
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button onClick={() => updateOrderStatus(order.id, 'completed')} className="col-span-2 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-500/30">
                      <Check size={20} /> إنهاء الطلب
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {printOrder && (
        <div className="print-only hidden font-mono text-black bg-white w-full max-w-[300px] mx-auto p-4 text-sm" dir="rtl">
          
          <div className="text-center pb-4 border-b-2 border-dashed border-gray-400 mb-4">
            <h2 className="text-2xl font-extrabold mb-1">مقهى النخبة</h2>
            <p className="text-xs">Elite Cafe</p>
          </div>
          
          <div className="mb-4 text-xs space-y-1">
            <p>رقم الطاولة: <span className="font-bold text-sm">{printOrder.tables?.table_number?.replace('table_', '')}</span></p>
            <p>رقم الطلب: #{printOrder.id.split('-')[0]}</p>
            <p>التاريخ: {new Date(printOrder.created_at).toLocaleString('ar-MA')}</p>
          </div>
          
          <div className="border-b-2 border-dashed border-gray-400 pb-4 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-right pb-2">المنتج</th>
                  <th className="text-center pb-2">الكمية</th>
                </tr>
              </thead>
              <tbody>
                {printOrder.items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 pr-1">{item.name_ar}</td>
                    <td className="text-center py-2 font-bold">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="text-center mb-6">
            <p className="text-sm">الإجمالي</p>
            <p className="text-2xl font-extrabold">{formatMAD(printOrder.total_amount)}</p>
          </div>
          
          <div className="text-center text-xs text-gray-600">
            <p>شكراً لزيارتكم!</p>
            <p>نتمنى لكم وقتاً ممتعاً ☕</p>
          </div>

        </div>
      )}
    </>
  );
}