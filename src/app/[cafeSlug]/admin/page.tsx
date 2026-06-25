"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../../lib/supabase";
import { Plus, Trash2, Image as ImageIcon, Loader2, QrCode, PackageSearch, Printer, Lock, Settings, Edit, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import QRCode from "react-qr-code";
import { verifyPin, sendRecoveryEmail, verifyOtpAndUpdatePins, updateCafeSettings, adminAddProduct, adminUpdateProduct, adminDeleteProduct } from "../../../actions/auth";

const CATEGORIES = ["القهوة", "الحلوى", "عصائر", "مخبوزات"];

export default function AdminDashboard({ params }: { params: Promise<{ cafeSlug: string }> }) {
  const { cafeSlug } = use(params);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryOtp, setRecoveryOtp] = useState("");
  
  const [cafeName, setCafeName] = useState("");
  const [newAdminPin, setNewAdminPin] = useState("");
  const [newCashierPin, setNewCashierPin] = useState("");
  const [maxCashiers, setMaxCashiers] = useState("2"); 

  const [activeTab, setActiveTab] = useState("products"); 
  const [products, setProducts] = useState<any[]>([]);
  const [cafeId, setCafeId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("القهوة");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 🌟 حالات نظام الطاولات الذكي
  const [tableNum, setTableNum] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrReady, setQrReady] = useState(false);

  const fetchProducts = async (cId: string) => {
    const { data, error } = await supabase.from('products').select('*').eq('cafe_id', cId);
    if (!error && data) setProducts(data.reverse());
  };

  useEffect(() => {
    const sessionKey = `admin_auth_${cafeSlug}`;
    if (sessionStorage.getItem(sessionKey) === 'true') setIsAuthenticated(true);

    const initAdmin = async () => {
      setIsLoading(true);
      const { data: cafeData } = await supabase.from('cafes').select('id, name, max_cashiers').eq('slug', cafeSlug).single();
      
      if (!cafeData) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      setCafeId(cafeData.id);
      if (cafeData.name) setCafeName(cafeData.name);
      if (cafeData.max_cashiers) setMaxCashiers(cafeData.max_cashiers.toString());
      
      await fetchProducts(cafeData.id);
      setIsLoading(false);
    };
    initAdmin();
  }, [cafeSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !cafeId) return;

    setIsChecking(true);
    const isValid = await verifyPin(cafeId, "admin", pinInput);
    setIsChecking(false);

    if (isValid) {
      setIsAuthenticated(true);
      sessionStorage.setItem(`admin_auth_${cafeSlug}`, 'true');
      setAttempts(0);
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

  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    const { success } = await sendRecoveryEmail(recoveryEmail);
    setIsChecking(false);
    if (success) { setRecoveryStep(2); alert("تم إرسال الرمز للإيميل."); }
    else alert("خطأ في الإرسال.");
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeId) return;
    setIsChecking(true);
    const { success, error } = await verifyOtpAndUpdatePins(recoveryEmail, recoveryOtp, cafeId, newAdminPin, newCashierPin);
    setIsChecking(false);
    if (success) { alert("تم إعادة التعيين بنجاح!"); setIsRecovering(false); setRecoveryStep(1); }
    else alert(error || "رمز خاطئ");
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeId) return;
    setIsChecking(true);
    const { success } = await updateCafeSettings(cafeId, cafeName, newAdminPin, newCashierPin, Number(maxCashiers));
    setIsChecking(false);
    if (success) { alert("تم حفظ الإعدادات!"); setNewAdminPin(""); setNewCashierPin(""); }
    else alert("حدث خطأ أثناء الحفظ.");
  };

  const resetForm = () => {
    setEditingId(null); setName(""); setNameEn(""); setNameFr(""); setDescription(""); setPrice(""); setImageFile(null);
  };

  const handleAddOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeId || !name || !price || (!imageFile && !editingId)) return alert("يرجى تعبئة الحقول!");
    setIsUploading(true);
    try {
      let finalImageUrl = undefined;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;

        if (editingId) {
          const oldProduct = products.find(p => p.id === editingId);
          if (oldProduct && oldProduct.image_url) {
            const oldFileName = oldProduct.image_url.split('/').pop();
            if (oldFileName) await supabase.storage.from('products').remove([oldFileName]);
          }
        }
      }
      const productData: any = { name_ar: name, name_en: nameEn, name_fr: nameFr, description_ar: description, price: parseFloat(price), category: category };
      if (finalImageUrl) productData.image_url = finalImageUrl;

      if (editingId) {
        const { success } = await adminUpdateProduct(editingId, productData);
        if (success) alert("تم التحديث!"); else throw new Error();
      } else {
        productData.cafe_id = cafeId; productData.is_active = true;
        const { success } = await adminAddProduct(productData);
        if (success) alert("تمت الإضافة!"); else throw new Error();
      }
      resetForm(); fetchProducts(cafeId);
    } catch (err: any) { alert("خطأ: " + (err.message || "فشل التخزين")); } finally { setIsUploading(false); }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm("تأكيد الحذف؟")) return;
    try {
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) await supabase.storage.from('products').remove([fileName]);
      }
      const { success } = await adminDeleteProduct(id);
      if (success) fetchProducts(cafeId!);
    } catch (err) { alert("فشل الحذف"); }
  };

  const handleEditClick = (product: any) => {
    setEditingId(product.id); setName(product.name_ar || ""); setNameEn(product.name_en || ""); setNameFr(product.name_fr || "");
    setDescription(product.description_ar || ""); setPrice(product.price.toString()); setCategory(product.category); setImageFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🌟 دالة توليد الطاولات الذكية
  const handleGenerateSmartQR = async () => {
    if (!tableNum || !cafeId) return;
    
    setIsGeneratingQr(true);
    setQrReady(false);

    const formattedTableNumber = `table_${tableNum}`;

    try {
      // 1. فحص هل الطاولة موجودة أصلاً؟
      const { data: existingTable, error: fetchError } = await supabase
        .from('tables')
        .select('id')
        .eq('cafe_id', cafeId)
        .eq('table_number', formattedTableNumber)
        .single();

      // 2. إذا لم تكن موجودة، نقوم بإنشائها فوراً!
      if (!existingTable) {
        const { error: insertError } = await supabase
          .from('tables')
          .insert([{ cafe_id: cafeId, table_number: formattedTableNumber }]);
        
        if (insertError) throw insertError;
      }

      // 3. بناء الرابط الذكي (يعمل على localhost أو الدومين الحقيقي)
      const baseUrl = window.location.origin;
      setQrUrl(`${baseUrl}/${cafeSlug}/${formattedTableNumber}`);
      
      setQrReady(true);
    } catch (error) {
      console.error("Error setting up table:", error);
      alert("حدث خطأ أثناء فحص/إضافة الطاولة.");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handlePrint = () => { window.print(); };

  if (isLoading) return <div className="p-10 text-center font-bold">جاري التحميل...</div>;

  if (isNotFound) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-6 border border-red-200">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-4xl font-extrabold text-foreground mb-4">404 - المقهى غير موجود</h1>
        <p className="text-muted-foreground text-lg max-w-md font-medium">عذراً، الرابط الذي تحاول الوصول إليه غير صحيح.</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-border w-full max-w-sm text-center">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-6"><Lock size={32} /></div>
          <h2 className="text-2xl font-extrabold mb-2">{isRecovering ? "استعادة الرمز" : "منطقة الإدارة"}</h2>
          <p className="text-muted-foreground mb-8 text-sm">{isRecovering ? "أدخل بريدك" : "يرجى إدخال الرمز السري"}</p>
          {!isRecovering ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="border-2 border-border rounded-xl p-4 text-center text-2xl tracking-[0.5em] focus:outline-primary" placeholder="••••" autoFocus disabled={isLocked || isChecking} />
              <button disabled={isChecking || isLocked} type="submit" className="py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary/90">{isChecking ? "تحقق..." : "دخول"}</button>
              <button type="button" onClick={() => setIsRecovering(true)} className="text-sm text-primary font-bold mt-2 hover:underline">هل نسيت الرمز؟</button>
            </form>
          ) : recoveryStep === 1 ? (
            <form onSubmit={handleSendRecovery} className="flex flex-col gap-4">
              <input type="email" required value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} className="border-2 border-border rounded-xl p-4 text-center focus:outline-primary" placeholder="admin@example.com" />
              <button type="submit" className="py-4 rounded-xl font-bold text-white bg-primary">إرسال كود التحقق</button>
              <button type="button" onClick={() => setIsRecovering(false)} className="text-sm text-muted-foreground font-bold mt-2">إلغاء</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndReset} className="flex flex-col gap-3">
              <input required type="text" value={recoveryOtp} onChange={(e) => setRecoveryOtp(e.target.value)} className="border border-border rounded-xl p-3 text-center" placeholder="كود الإيميل" />
              <input required type="text" value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} className="border border-border rounded-xl p-3 text-center" placeholder="رمز المدير الجديد" />
              <input required type="text" value={newCashierPin} onChange={(e) => setNewCashierPin(e.target.value)} className="border border-border rounded-xl p-3 text-center" placeholder="رمز الكاشير الجديد" />
              <button type="submit" className="py-4 mt-2 rounded-xl font-bold text-white bg-green-500">تحديث الرموز</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-6 md:p-12 font-sans" dir="rtl">
      <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } #qr-print-area, #qr-print-area * { visibility: visible; } #qr-print-area { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%; text-align: center; } }`}} />

      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-border">
        <div><h1 className="text-3xl font-extrabold text-foreground">لوحة تحكم المدير ⚙️</h1><p className="text-muted-foreground mt-1">التحكم الشامل في المقهى</p></div>
        <div className="flex flex-wrap bg-muted p-1 rounded-xl mt-4 md:mt-0 gap-1">
          <button onClick={() => setActiveTab('products')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold ${activeTab === 'products' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}><PackageSearch size={20} /> المنيو</button>
          <button onClick={() => setActiveTab('qr')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold ${activeTab === 'qr' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}><QrCode size={20} /> الطاولات</button>
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold ${activeTab === 'settings' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}><Settings size={20} /> الإعدادات</button>
        </div>
      </header>

      {activeTab === 'settings' && (
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-border max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 border-b pb-4">إعدادات المقهى</h2>
          <form onSubmit={handleUpdateSettings} className="space-y-5">
            <div><label className="block text-sm font-bold mb-2">اسم المقهى</label><input type="text" required value={cafeName} onChange={(e) => setCafeName(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30" /></div>
            <div>
              <label className="block text-sm font-bold mb-1 text-primary">العدد الأقصى لجلسات الكاشير المسموحة</label>
              <input type="number" min="1" max="10" required value={maxCashiers} onChange={(e) => setMaxCashiers(e.target.value)} className="w-full border-2 border-primary/30 rounded-xl p-3 bg-primary/5 font-bold text-lg" />
              <span className="text-xs text-muted-foreground">تمنع هذه الميزة دخول أي كاشير إضافي إذا كان العدد ممتلئاً.</span>
            </div>
            <div className="pt-4 border-t border-border/50"><label className="block text-sm font-bold mb-2">رمز المدير الجديد (اختياري)</label><input type="text" value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30" placeholder="اتركه فارغاً" /></div>
            <div><label className="block text-sm font-bold mb-2">رمز الكاشير الجديد (اختياري)</label><input type="text" value={newCashierPin} onChange={(e) => setNewCashierPin(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30" placeholder="اتركه فارغاً" /></div>
            <button disabled={isChecking} type="submit" className="w-full bg-primary text-white py-4 rounded-xl font-bold mt-6 shadow-lg">{isChecking ? "حفظ..." : "حفظ التغييرات"}</button>
          </form>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-border h-fit relative">
            {editingId && <button onClick={resetForm} className="absolute top-6 left-6 text-muted-foreground hover:text-red-500"><X size={24} /></button>}
            <h2 className="text-xl font-bold mb-6 border-b pb-4">{editingId ? "تعديل المنتج" : "إضافة منتج"}</h2>
            <form onSubmit={handleAddOrUpdateProduct} className="space-y-4">
              <div><label className="block text-sm font-bold mb-2">اسم المنتج (عربي)</label><input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold mb-2">EN</label><input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30" /></div>
                <div><label className="block text-sm font-bold mb-2">FR</label><input type="text" value={nameFr} onChange={(e) => setNameFr(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30" /></div>
              </div>
              <div><label className="block text-sm font-bold mb-2">الوصف</label><textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold mb-2">السعر</label><input required type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30" /></div>
                <div><label className="block text-sm font-bold mb-2">القسم</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-border rounded-xl p-3 bg-muted/30">{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">الصورة</label>
                <div className="border-2 border-dashed border-primary/50 rounded-xl p-4 text-center cursor-pointer relative"><input required={!editingId} type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0" /><div className="text-primary font-bold">{imageFile ? imageFile.name : editingId ? "تغيير الصورة" : "اختر صورة"}</div></div>
              </div>
              <button disabled={isUploading} type="submit" className={`w-full text-white py-4 rounded-xl font-bold shadow-lg ${editingId ? 'bg-blue-500' : 'bg-primary'}`}>{isUploading ? "حفظ..." : editingId ? "حفظ التعديل" : "نشر المنتج"}</button>
            </form>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-border">
            <h2 className="text-xl font-bold mb-6 border-b pb-4">المنتجات المعروضة حالياً</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map(product => (
                <div key={product.id} className="flex gap-4 border border-border/50 p-3 rounded-2xl items-center bg-muted/10">
                  <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-muted"><img src={product.image_url} alt={product.name_ar} className="w-full h-full object-cover" /></div>
                  <div className="flex-1"><h3 className="font-bold text-sm">{product.name_ar}</h3><p className="text-sm text-primary font-bold">{product.price} MAD</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditClick(product)} className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center hover:bg-blue-500 hover:text-white"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(product.id, product.image_url)} className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 تبويب الـ QR الذكي الجديد */}
      {activeTab === 'qr' && (
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-border flex flex-col items-center max-w-2xl mx-auto mt-10 text-center">
          <div className="bg-primary/10 p-4 rounded-full text-primary mb-4">
            <QrCode size={48} />
          </div>
          <h2 className="text-2xl font-bold mb-2">تسجيل الطاولات وتوليد الـ QR</h2>
          <p className="text-muted-foreground mb-6 text-sm">أدخل رقم الطاولة لتسجيلها في النظام وتوليد الكود الخاص بها.</p>
          
          <div className="flex flex-col w-full max-w-sm gap-4 mb-8">
            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl w-full border">
              <label className="font-bold text-lg whitespace-nowrap">رقم الطاولة :</label>
              <input 
                type="number" 
                value={tableNum} 
                onChange={(e) => {
                  setTableNum(e.target.value);
                  setQrReady(false); // إخفاء الـ QR القديم فور كتابة رقم جديد
                }} 
                className="border rounded-xl p-3 w-full text-center font-bold text-xl bg-white focus:outline-primary" 
                min="1"
              />
            </div>
            
            {/* الزر السحري الجديد */}
            <button 
              onClick={handleGenerateSmartQR}
              disabled={isGeneratingQr || !tableNum}
              className="bg-primary text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isGeneratingQr ? <><Loader2 className="animate-spin" size={20} /> جاري المعالجة...</> : <><CheckCircle2 size={20} /> إنشاء الكود وحفظ الطاولة</>}
            </button>
          </div>

          {/* مساحة الطباعة لا تظهر إلا بعد نجاح إنشاء الطاولة */}
          {qrReady && (
            <>
              <div id="qr-print-area" className="bg-white p-10 rounded-3xl border-4 border-foreground w-full max-w-md animate-in zoom-in duration-300">
                <h3 className="text-3xl font-extrabold mb-2">{cafeName || "المقهى"}</h3>
                <p className="text-lg font-bold text-primary mb-8 border-b-2 pb-4">طاولة رقم {tableNum}</p>
                <div className="p-4 inline-block">
                  <QRCode value={qrUrl} size={220} level="H" />
                </div>
                <p className="mt-8 text-lg font-bold">امسح الكود لطلب مشروبك ☕</p>
              </div>
              <button onClick={handlePrint} className="mt-8 bg-foreground text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 text-lg hover:scale-105 transition-transform">
                <Printer size={24} /> طباعة الكود
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}