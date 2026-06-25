"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../../lib/supabase";
import { Plus, Trash2, Image as ImageIcon, Loader2, QrCode, PackageSearch, Printer, Lock, Settings, Edit, X } from "lucide-react";
import QRCode from "react-qr-code";
import { verifyPin, sendRecoveryEmail, verifyOtpAndUpdatePins, updateCafeSettings, adminAddProduct, adminUpdateProduct, adminDeleteProduct } from "../../../actions/auth";

const CATEGORIES = ["القهوة", "الحلوى", "عصائر", "مخبوزات"];

export default function AdminDashboard({ params }: { params: Promise<{ cafeSlug: string }> }) {
  const { cafeSlug } = use(params);
  
  // 🛡️ حالات الحماية
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  // حالات الاستعادة والإعدادات
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryOtp, setRecoveryOtp] = useState("");
  
  const [cafeName, setCafeName] = useState("");
  const [newAdminPin, setNewAdminPin] = useState("");
  const [newCashierPin, setNewCashierPin] = useState("");

  const [activeTab, setActiveTab] = useState("products"); 
  const [products, setProducts] = useState<any[]>([]);
  const [cafeId, setCafeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // States لنموذج المنتجات (إضافة وتعديل)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("القهوة");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State لمولد الـ QR
  const [tableNum, setTableNum] = useState("1");
  const [qrUrl, setQrUrl] = useState("");

  const fetchProducts = async (cId: string) => {
    const { data, error } = await supabase.from('products').select('*').eq('cafe_id', cId);
    if (!error && data) {
      setProducts(data.reverse()); // عكس الترتيب ليكون الأحدث أولاً
    }
  };

  useEffect(() => {
    const isLogged = sessionStorage.getItem('admin_authenticated');
    if (isLogged === 'true') setIsAuthenticated(true);

    const initAdmin = async () => {
      const { data: cafeData } = await supabase.from('cafes').select('id, name').eq('slug', cafeSlug).single();
      if (cafeData) {
        setCafeId(cafeData.id);
        if (cafeData.name) setCafeName(cafeData.name);
        await fetchProducts(cafeData.id);
      }
      setIsLoading(false);
    };
    initAdmin();
  }, [cafeSlug]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const baseUrl = window.location.origin;
      setQrUrl(`${baseUrl}/${cafeSlug}/table_${tableNum}`);
    }
  }, [tableNum, cafeSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !cafeId) return;

    setIsChecking(true);
    const isValid = await verifyPin(cafeId, "admin", pinInput);
    setIsChecking(false);

    if (isValid) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
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

  // دوال الاستعادة والإعدادات
  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    const { success } = await sendRecoveryEmail(recoveryEmail);
    setIsChecking(false);
    if (success) {
      setRecoveryStep(2);
      alert("تم إرسال رمز التحقق إلى بريدك الإلكتروني.");
    } else {
      alert("حدث خطأ في إرسال البريد. تأكد من الإيميل.");
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeId) return;
    setIsChecking(true);
    const { success, error } = await verifyOtpAndUpdatePins(recoveryEmail, recoveryOtp, cafeId, newAdminPin, newCashierPin);
    setIsChecking(false);
    if (success) {
      alert("تم إعادة تعيين الرموز بنجاح! يمكنك الآن تسجيل الدخول.");
      setIsRecovering(false);
      setRecoveryStep(1);
    } else {
      alert(error || "رمز التحقق غير صحيح");
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeId) return;
    setIsChecking(true);
    const { success } = await updateCafeSettings(cafeId, cafeName, newAdminPin, newCashierPin);
    setIsChecking(false);
    if (success) {
      alert("تم حفظ الإعدادات بنجاح!");
      setNewAdminPin("");
      setNewCashierPin("");
    } else {
      alert("حدث خطأ أثناء الحفظ.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setNameEn("");
    setNameFr("");
    setDescription("");
    setPrice("");
    setImageFile(null);
  };

  // دالة الإضافة والتعديل المشتركة
  const handleAddOrUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeId || !name || !price || (!imageFile && !editingId)) return alert("يرجى تعبئة الحقول الأساسية!");
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

      const productData: any = {
        name_ar: name, name_en: nameEn, name_fr: nameFr,
        description_ar: description, price: parseFloat(price), category: category,
      };

      if (finalImageUrl) productData.image_url = finalImageUrl;

      if (editingId) {
        // استخدام السيرفر للتعديل
        const { success } = await adminUpdateProduct(editingId, productData);
        if (success) alert("تم تحديث المنتج بنجاح!");
        else throw new Error("فشل التحديث");
      } else {
        productData.cafe_id = cafeId;
        productData.is_active = true;
        // استخدام السيرفر للإضافة
        const { success } = await adminAddProduct(productData);
        if (success) alert("تمت إضافة المنتج بنجاح!");
        else throw new Error("فشل الإضافة");
      }

      resetForm();
      fetchProducts(cafeId);
    } catch (error: any) { 
      console.error("Supabase Error:", error);
      alert("الخطأ هو: " + (error.message || "حدث خطأ غير معروف"));
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    try {
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) await supabase.storage.from('products').remove([fileName]);
      }
      // استخدام السيرفر للحذف
      const { success } = await adminDeleteProduct(id);
      if (success) fetchProducts(cafeId!);
      else throw new Error("فشل الحذف من قاعدة البيانات");
    } catch (error: any) {
      console.error("Supabase Delete Error:", error);
      alert("الخطأ هو: " + (error.message || "حدث خطأ غير معروف أثناء الحذف"));
    }
  };

  // تعبئة النموذج ببيانات المنتج المراد تعديله
  const handleEditClick = (product: any) => {
    setEditingId(product.id);
    setName(product.name_ar || "");
    setNameEn(product.name_en || "");
    setNameFr(product.name_fr || "");
    setDescription(product.description_ar || "");
    setPrice(product.price.toString());
    setCategory(product.category);
    setImageFile(null); // لا نطلب صورة جديدة إلا إذا أراد تغييرها
    window.scrollTo({ top: 0, behavior: 'smooth' }); // تمرير الشاشة للأعلى
  };

  const handlePrint = () => { window.print(); };

  if (isLoading) return <div className="p-10 text-center font-bold">جاري التحميل...</div>;

  // 🛡️ شاشات القفل والاستعادة
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-border w-full max-w-sm text-center">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-extrabold mb-2">{isRecovering ? "استعادة الرمز" : "منطقة الإدارة"}</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            {isRecovering ? (recoveryStep === 1 ? "أدخل بريدك لتلقي كود التحقق" : "أدخل كود التحقق والرموز الجديدة") : "يرجى إدخال الرمز السري للوصول"}
          </p>
          
          {!isRecovering ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input 
                type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                className="border-2 border-border rounded-xl p-4 text-center text-2xl tracking-[0.5em] focus:outline-primary focus:border-primary transition-colors"
                placeholder="••••" autoFocus disabled={isLocked || isChecking}
              />
              <button disabled={isChecking || isLocked} type="submit" className={`py-4 rounded-xl font-bold transition-colors text-white ${isLocked ? 'bg-red-500 cursor-not-allowed' : isChecking ? 'bg-primary/70' : 'bg-primary hover:bg-primary/90'}`}>
                {isLocked ? "محظور مؤقتاً 🚫" : isChecking ? "جاري التحقق..." : "دخول"}
              </button>
              <button type="button" onClick={() => setIsRecovering(true)} className="text-sm text-primary font-bold mt-2 hover:underline">
                هل نسيت الرمز؟
              </button>
            </form>
          ) : recoveryStep === 1 ? (
            <form onSubmit={handleSendRecovery} className="flex flex-col gap-4">
              <input 
                type="email" required value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)}
                className="border-2 border-border rounded-xl p-4 text-center focus:outline-primary focus:border-primary transition-colors"
                placeholder="admin@example.com" disabled={isChecking}
              />
              <button disabled={isChecking} type="submit" className="py-4 rounded-xl font-bold transition-colors text-white bg-primary hover:bg-primary/90">
                {isChecking ? "جاري الإرسال..." : "إرسال كود التحقق"}
              </button>
              <button type="button" onClick={() => setIsRecovering(false)} className="text-sm text-muted-foreground font-bold mt-2 hover:underline">إلغاء</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndReset} className="flex flex-col gap-3">
              <input required type="text" value={recoveryOtp} onChange={(e) => setRecoveryOtp(e.target.value)} className="border-2 border-border rounded-xl p-3 text-center focus:outline-primary" placeholder="كود التحقق من الإيميل" />
              <input required type="text" value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} className="border-2 border-border rounded-xl p-3 text-center focus:outline-primary" placeholder="رمز المدير الجديد" />
              <input required type="text" value={newCashierPin} onChange={(e) => setNewCashierPin(e.target.value)} className="border-2 border-border rounded-xl p-3 text-center focus:outline-primary" placeholder="رمز الكاشير الجديد" />
              <button disabled={isChecking} type="submit" className="py-4 mt-2 rounded-xl font-bold transition-colors text-white bg-green-500 hover:bg-green-600">
                {isChecking ? "جاري التحديث..." : "تحديث الرموز"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-6 md:p-12 font-sans" dir="rtl">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%; text-align: center; }
        }
      `}} />

      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-border">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground">لوحة تحكم المدير ⚙️</h1>
          <p className="text-muted-foreground mt-1">التحكم الشامل في المقهى</p>
        </div>
        <div className="flex flex-wrap bg-muted p-1 rounded-xl mt-4 md:mt-0 gap-1">
          <button onClick={() => setActiveTab('products')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'products' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <PackageSearch size={20} /> إدارة المنيو
          </button>
          <button onClick={() => setActiveTab('qr')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'qr' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <QrCode size={20} /> أكواد الطاولات
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'settings' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Settings size={20} /> الإعدادات
          </button>
        </div>
      </header>

      {/* تبويب الإعدادات */}
      {activeTab === 'settings' && (
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-border max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 border-b pb-4">إعدادات المقهى</h2>
          <form onSubmit={handleUpdateSettings} className="space-y-5">
            <div>
              <label className="block text-sm font-bold mb-2">اسم المقهى</label>
              <input type="text" required value={cafeName} onChange={(e) => setCafeName(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30" placeholder="مثال: مقهى النخبة" />
            </div>
            <div className="pt-4 border-t border-border/50">
              <label className="block text-sm font-bold mb-2">رمز المدير الجديد <span className="text-muted-foreground font-normal text-xs">(اختياري)</span></label>
              <input type="text" value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30" placeholder="اتركه فارغاً إذا لا تريد تغييره" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">رمز الكاشير الجديد <span className="text-muted-foreground font-normal text-xs">(اختياري)</span></label>
              <input type="text" value={newCashierPin} onChange={(e) => setNewCashierPin(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30" placeholder="اتركه فارغاً إذا لا تريد تغييره" />
            </div>
            <button disabled={isChecking} type="submit" className="w-full bg-primary text-white py-4 rounded-xl font-bold mt-6 shadow-lg">
              {isChecking ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </form>
        </div>
      )}

      {/* تبويب المنتجات */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-border h-fit relative">
            
            {/* زر الإلغاء يظهر فقط في حالة التعديل */}
            {editingId && (
              <button onClick={resetForm} className="absolute top-6 left-6 text-muted-foreground hover:text-red-500 transition-colors" title="إلغاء التعديل">
                <X size={24} />
              </button>
            )}
            
            <h2 className="text-xl font-bold mb-6 border-b pb-4">{editingId ? "تعديل بيانات المنتج" : "إضافة منتج جديد"}</h2>
            
            <form onSubmit={handleAddOrUpdateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">اسم المنتج (عربي)</label>
                <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">الاسم (EN)</label>
                  <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30" placeholder="اختياري" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">الاسم (FR)</label>
                  <input type="text" value={nameFr} onChange={(e) => setNameFr(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30" placeholder="اختياري" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">الوصف</label>
                <textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">السعر (MAD)</label>
                  <input required type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">القسم</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-border rounded-xl p-3 focus:outline-primary bg-muted/30">
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">صورة المنتج {editingId && <span className="text-xs text-muted-foreground font-normal">(اختياري في حالة التعديل)</span>}</label>
                <div className="border-2 border-dashed border-primary/50 rounded-xl p-4 text-center cursor-pointer relative">
                  <input required={!editingId} type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="flex flex-col items-center justify-center text-primary">
                    {imageFile ? <span className="font-bold text-green-600 truncate w-full">{imageFile.name}</span> : <><ImageIcon size={24} className="mb-1 opacity-70" /><span className="font-bold text-xs">{editingId ? "اضغط لاختيار صورة جديدة" : "اختر صورة"}</span></>}
                  </div>
                </div>
              </div>
              <button disabled={isUploading} type="submit" className={`w-full text-white py-4 rounded-xl font-bold mt-4 shadow-lg flex justify-center items-center gap-2 ${editingId ? 'bg-blue-500 hover:bg-blue-600' : 'bg-primary'}`}>
                {isUploading ? <><Loader2 className="animate-spin" /> جاري الحفظ...</> : editingId ? "حفظ التعديلات" : <><Plus /> حفظ ونشر المنتج</>}
              </button>
            </form>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-border">
              <h2 className="text-xl font-bold mb-6 border-b pb-4">المنتجات المعروضة حالياً</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map(product => (
                  <div key={product.id} className="flex gap-4 border border-border/50 p-3 rounded-2xl items-center hover:shadow-md transition-shadow bg-muted/10">
                    <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-muted">
                      <img src={product.image_url} alt={product.name_ar} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm">{product.name_ar}</h3>
                      <p className="text-sm text-primary font-bold">{product.price} MAD</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClick(product)} className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors" title="تعديل">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(product.id, product.image_url)} className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors" title="حذف">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* تبويب الـ QR */}
      {activeTab === 'qr' && (
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-border flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-10">
          <div className="bg-primary/10 p-4 rounded-full text-primary mb-4">
            <QrCode size={48} />
          </div>
          <h2 className="text-2xl font-bold mb-2">توليد أكواد الطاولات</h2>
          <p className="text-muted-foreground mb-8">قم بإدخال رقم الطاولة لإنشاء الكود</p>
          <div className="flex items-center gap-4 mb-10 bg-muted/30 p-4 rounded-2xl border border-border/50 w-full max-w-sm">
            <label className="font-bold text-lg whitespace-nowrap">رقم الطاولة :</label>
            <input type="number" value={tableNum} onChange={(e) => setTableNum(e.target.value)} className="border border-border rounded-xl p-3 w-full text-center font-bold text-xl focus:outline-primary bg-white" min="1"/>
          </div>
          <div id="qr-print-area" className="bg-white p-10 rounded-3xl border-4 border-foreground shadow-sm">
            <h3 className="text-3xl font-extrabold mb-2 text-foreground tracking-tight">{cafeName || "المقهى"}</h3>
            <p className="text-lg font-bold text-primary mb-8 border-b-2 border-primary/20 pb-4">طاولة رقم {tableNum}</p>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-border/50 inline-block">
              {qrUrl && <QRCode value={qrUrl} size={220} level="H" />}
            </div>
            <p className="mt-8 text-lg font-bold text-foreground">امسح الكود لطلب مشروبك ☕</p>
          </div>
          <button onClick={handlePrint} className="mt-10 bg-foreground text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 text-lg shadow-xl">
            <Printer size={24} /> طباعة الكود
          </button>
        </div>
      )}
    </div>
  );
}