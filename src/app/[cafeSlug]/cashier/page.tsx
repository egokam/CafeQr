"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../../lib/supabase";
import { Check, X, Clock, ChefHat, AlertOctagon, Printer, Lock, AlertTriangle } from "lucide-react";
import { verifyPin, cashierUpdateOrderStatus, cashierMarkOutOfStock } from "../../../actions/auth";

const formatMAD = (price: number) => {
  return `${Number(price).toFixed(2)} د.م`;
};

export default function CashierDashboard({ params }: { params: Promise<{ cafeSlug: string }> }) {
  const { cafeSlug } = use(params);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // 🌟 حالة جديدة مخصصة فقط للمتطفلين (الكرسي ممتلئ)
  const [isSessionFull, setIsSessionFull] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [cafeId, setCafeId] = useState<string | null>(null);
  const [cafeDataObj, setCafeDataObj] = useState<any>(null); 
  
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);

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
    const sessionKey = `cashier_auth_${cafeSlug}`;
    if (sessionStorage.getItem(sessionKey) === 'true') setIsAuthenticated(true);

    const initCafe = async () => {
      setIsLoading(true);
      const { data: cafeData } = await supabase.from('cafes').select('id, max_cashiers').eq('slug', cafeSlug).single();
      if (!cafeData) { setIsNotFound(true); setIsLoading(false); return; }
      
      setCafeId(cafeData.id);
      setCafeDataObj(cafeData);
      await fetchOrders(cafeData.id);
      setIsLoading(false);
    };
    initCafe();
  }, [cafeSlug]);

  // 📡 محرك الحماية الذكي (ينشط فقط بعد كتابة البين كود بنجاح)
  // 📡 محرك الحماية الذكي المطور (ينشط فقط بعد تسجيل الدخول)
  // 2️⃣ الاستشعار الثاني: البث الحي للطلبات + حارس مراقبة عدد شاشات الكاشير
  useEffect(() => {
    if (!isAuthenticated || !cafeDataObj) return;

    fetchOrders(cafeDataObj.id);

    const ordersChannel = supabase.channel(`live-orders-${cafeDataObj.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `cafe_id=eq.${cafeDataObj.id}` }, (payload) => {
        fetchOrders(cafeDataObj.id);
        if (payload.eventType === 'INSERT') new Audio('/bell.mp3').play().catch(() => {});
      }).subscribe();

    let myTabId = sessionStorage.getItem('cashier_tab_id');
    if (!myTabId) {
      myTabId = Math.random().toString(36).substring(2, 12);
      sessionStorage.setItem('cashier_tab_id', myTabId);
    }

    const slotChannel = supabase.channel(`cashier_slots_${cafeDataObj.id}`, {
      config: { presence: { key: myTabId } }
    });

    slotChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = slotChannel.presenceState();
      const maxAllowed = cafeDataObj.max_cashiers || 1;

      // 🛡️ التريك الأسطوري هنا (صمام الصبر):
      // إذا لم يظهر (آيدي جهازي) داخل الغرفة بعد، فهذا يعني أن رسالة دخولي في الطريق للسيرفر.
      // تجاهل هذه الموجة ولا تحكم عليّ بالطرد الآن!
      if (!presenceState[myTabId]) return;

      const activeSessions: { key: string, onlineAt: number }[] = [];

      Object.entries(presenceState).forEach(([key, presences]: [string, any]) => {
        if (presences.length > 0) {
          activeSessions.push({
            key: key,
            onlineAt: new Date(presences[0].online_at || Date.now()).getTime()
          });
        }
      });

      // الترتيب: الأقدم دخولاً هو صاحب الحق الشرعي في الكرسي
      activeSessions.sort((a, b) => a.onlineAt - b.onlineAt);

      const allowedKeys = activeSessions.slice(0, maxAllowed).map(s => s.key);

      // الآن فقط، وبعد أن تأكدنا أن اسمنا مُسجل في الدفتر، نسأل: هل نحن خارج الحد المسموح؟
      if (!allowedKeys.includes(myTabId)) {
        setIsSessionFull(true);
        slotChannel.untrack();
        sessionStorage.removeItem(`cashier_auth_${cafeSlug}`);
        setIsAuthenticated(false);
      }
    });

    slotChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await slotChannel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => { 
      supabase.removeChannel(ordersChannel); 
      supabase.removeChannel(slotChannel);
    };
  }, [isAuthenticated, cafeDataObj]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !cafeId) return;

    setIsChecking(true);
    const isValid = await verifyPin(cafeId, "cashier", pinInput);
    setIsChecking(false);

    if (isValid) {
      setIsAuthenticated(true);
      sessionStorage.setItem(`cashier_auth_${cafeSlug}`, 'true');
      setAttempts(0);
      const unlockAudio = new Audio('/bell.mp3');
      unlockAudio.play().then(() => unlockAudio.pause()).catch(()=> {});
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPinInput("");
      if (newAttempts >= 5) {
        setIsLocked(true);
        alert("تم حظرك مؤقتاً. يرجى الانتظار دقيقة.");
        setTimeout(() => { setIsLocked(false); setAttempts(0); }, 60000);
      } else {
        alert(`الرمز غير صحيح ❌ (متبقي ${5 - newAttempts} محاولات)`);
      }
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { success } = await cashierUpdateOrderStatus(orderId, newStatus);
    if (!success) alert("حدث خطأ أثناء التحديث.");
  };

  const markOutOfStock = async (productId: string, productName: string) => {
    if(!confirm(`تأكيد إيقاف "${productName}"؟`)) return;
    const { success } = await cashierMarkOutOfStock(productId);
    if (success) alert(`تم إيقاف "${productName}".`);
  };

  const handlePrintReceipt = (order: any) => {
    setPrintOrder(order);
    setTimeout(() => { window.print(); }, 150);
  };

  if (isLoading) return <div className="min-h-screen bg-muted/20 flex items-center justify-center"><div className="w-12 h-12 border-4 border-foreground border-t-transparent rounded-full animate-spin"></div></div>;

  if (isNotFound) return <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6 text-center" dir="rtl"><AlertTriangle className="w-16 h-16 text-red-500 mb-4" /><h1 className="text-3xl font-bold">404 - المقهى غير موجود</h1></div>;

  // ⛔ صفحة المنع الأنيقة (تظهر فقط للجهاز المتطفل الزائد)
  if (isSessionFull) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 text-center selection:bg-red-500" dir="rtl">
        <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-pulse">
          <Lock className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-3xl font-black mb-3 tracking-tight">الجلسة ممتلئة (Access Denied)</h1>
        <p className="text-stone-400 max-w-md leading-relaxed mb-8 text-base">
          عذراً، هذا المقهى يعمل بالحد الأقصى المسموح به من شاشات الكاشير ({cafeDataObj?.max_cashiers || 1} شاشات في نفس الوقت). 
          لا يمكنك الدخول حتى يقوم الكاشير الحالي بإغلاق شاشته.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-white text-stone-950 px-8 py-4 rounded-2xl font-black text-sm hover:bg-stone-200 active:scale-95 transition-all shadow-lg"
        >
          إعادة المحاولة 🔄
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-border w-full max-w-sm text-center">
          <div className="bg-foreground w-20 h-20 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-md"><Lock size={36} /></div>
          <h2 className="text-2xl font-extrabold mb-2">منطقة الكاشير</h2>
          <p className="text-muted-foreground mb-8 text-sm font-bold">أدخل الرمز السري لاستقبال الطلبات</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input type="password" inputMode="numeric" pattern="[0-9]*" value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="border-2 border-border rounded-2xl p-4 text-center text-3xl tracking-[0.5em] focus:outline-none font-mono" placeholder="••••" autoFocus disabled={isLocked || isChecking} />
            <button disabled={isChecking || isLocked} type="submit" className="py-4 rounded-2xl font-bold text-lg text-white bg-foreground hover:scale-[1.02] active:scale-[0.98]">{isChecking ? "تحقق..." : "دخول"}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { .no-print { display: none !important; } .print-only { display: block !important; } @page { margin: 0; size: 80mm auto; } body { background-color: white; margin: 0; } }`}} />
      <div className="min-h-screen bg-muted/20 p-6 md:p-12 no-print" dir="rtl">
        <header className="mb-10 flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-border">
          <div><h1 className="text-3xl font-extrabold uppercase">شاشة الكاشير</h1><p className="text-primary font-bold mt-1">إدارة الطلبات الحية</p></div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-bold"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span></span> يستقبل الطلبات</div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.length === 0 ? <div className="col-span-full text-center py-20 text-muted-foreground text-xl font-bold bg-white rounded-2xl border">لا توجد طلبات نشطة حالياً.</div> : orders.map((order) => (
            <div key={order.id} className={`bg-white rounded-[2rem] p-6 shadow-sm border-2 ${order.status === 'pending' ? 'border-yellow-400' : order.status === 'accepted' ? 'border-blue-400' : 'border-green-400'}`}>
              <div className="flex justify-between items-start mb-6 border-b pb-4"><div><h2 className="text-2xl font-extrabold">طاولة {order.tables?.table_number?.replace('table_', '')}</h2><p className="text-xs font-bold text-muted-foreground mt-1">#{order.id.split('-')[0]}</p></div><div className="flex flex-col items-end gap-2"><span className="text-xl font-black text-primary">{formatMAD(order.total_amount)}</span><button onClick={() => handlePrintReceipt(order)} className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-xl text-sm font-bold"><Printer size={16} /> طباعة</button></div></div>
              <div className="space-y-2 mb-8 min-h-[120px]">{order.items.map((item: any, idx: number) => (<div key={idx} className="flex justify-between items-center bg-muted/30 p-2.5 rounded-xl border"><div className="flex items-center gap-3"><span className="bg-primary text-white w-7 h-7 flex items-center justify-center rounded-lg font-bold text-sm">x{item.quantity}</span><span className="font-bold">{item.name_ar}</span></div><button onClick={() => markOutOfStock(item.id, item.name_ar)} className="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-500 hover:text-white"><AlertOctagon size={18} /></button></div>))}</div>
              <div className="grid grid-cols-2 gap-3 mt-auto">
                {order.status === 'pending' && <><button onClick={() => updateOrderStatus(order.id, 'accepted')} className="bg-foreground text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2"><Check size={18} /> قبول</button><button onClick={() => updateOrderStatus(order.id, 'rejected')} className="bg-red-50 text-red-600 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2"><X size={18} /> رفض</button></>}
                {order.status === 'accepted' && <button onClick={() => updateOrderStatus(order.id, 'ready')} className="col-span-2 bg-primary text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2"><ChefHat size={20} /> جاهز للتقديم</button>}
                {order.status === 'ready' && <button onClick={() => updateOrderStatus(order.id, 'completed')} className="col-span-2 bg-green-500 text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2"><Check size={20} /> إنهاء الطلب</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {printOrder && (<div className="print-only hidden font-mono text-black bg-white w-full max-w-[300px] mx-auto p-4 text-sm" dir="rtl"><div className="text-center pb-4 border-b-2 border-dashed border-gray-400 mb-4"><h2 className="text-2xl font-extrabold mb-1">EgoCafe</h2><p className="text-xs">Smart QR System</p></div><div className="mb-4 text-xs space-y-1 font-bold"><p>رقم الطاولة: {printOrder.tables?.table_number?.replace('table_', '')}</p><p>رقم الطلب: #{printOrder.id.split('-')[0]}</p></div><div className="border-b-2 border-dashed border-gray-400 pb-4 mb-4"><table className="w-full text-sm"><tbody>{printOrder.items.map((item: any, i: number) => (<tr key={i}><td className="py-1 font-bold">{item.name_ar}</td><td className="text-center font-extrabold">x{item.quantity}</td></tr>))}</tbody></table></div><div className="text-center"><p className="text-xl font-extrabold">{formatMAD(printOrder.total_amount)}</p></div></div>)}
    </>
  );
}