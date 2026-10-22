import React, { useState } from 'react';
import {
  Store,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Package,
  Plus,
  Power,
  ChevronLeft,
  Edit3,
  Check,
  X,
  User,
  ShieldCheck,
  Filter,
  Info
} from 'lucide-react';
import { useMarketplace, ProductItem, DEMO_PERSONAS } from '../../store/marketplaceStore';

interface MerchantMobileExperienceProps {
  onOpenAuthModal?: () => void;
}

export const MerchantMobileExperience: React.FC<MerchantMobileExperienceProps> = ({
  onOpenAuthModal,
}) => {
  const {
    currentUser,
    switchDemoUser,
    stores,
    toggleStoreStatus,
    products,
    toggleProductAvailability,
    updateProductPrice,
    orders,
    merchantAcceptOrder,
    merchantMarkReady,
    merchantRejectOrder,
    setIsAuthModalOpen,
  } = useMarketplace();

  // Determine active merchant store
  const targetStoreId = currentUser.merchantId || 'merchant_basha';
  const currentStore = stores.find((s) => s.id === targetStoreId) || stores[0];

  // Tabs: Orders, Products, Sales, Profile
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'sales' | 'profile'>('orders');

  // Edit Product Price Modal State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<string>('');

  // Reject Order Modal State
  const [rejectModalOrder, setRejectModalOrder] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Strict Data Isolation:
  // ONLY orders for this specific store
  const storeOrders = orders.filter((o) => o.storeId === currentStore.id);
  // ONLY products for this specific store
  const storeProducts = products.filter((p) => p.storeId === currentStore.id);

  // Filter orders by status
  const incomingOrders = storeOrders.filter((o) => o.status === 'created');
  const preparingOrders = storeOrders.filter((o) => o.status === 'merchant_accepted');
  const readyOrders = storeOrders.filter((o) =>
    ['ready_for_pickup', 'captain_assigned', 'at_pickup', 'in_transit'].includes(o.status)
  );
  const completedOrders = storeOrders.filter((o) => o.status === 'delivered');

  // Sales KPIs strictly for this merchant
  const totalSalesRevenueEgp = completedOrders.reduce((sum, o) => sum + o.subtotalEgp, 0);

  const handleSavePrice = () => {
    if (!editingProduct) return;
    const price = parseFloat(newPriceInput);
    if (!isNaN(price) && price > 0) {
      updateProductPrice(editingProduct.id, price);
      setEditingProduct(null);
    }
  };

  const handleConfirmReject = () => {
    if (!rejectModalOrder) return;
    merchantRejectOrder(rejectModalOrder, rejectReason || 'المتجر مشغول حالياً');
    setRejectModalOrder(null);
    setRejectReason('');
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#FAFAF9] text-slate-800 font-['Cairo',sans-serif] overflow-hidden select-none" dir="rtl">
      {/* Top Mobile Merchant App Bar */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shadow-amber-600/20">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 truncate max-w-[150px]">
                {currentStore.nameAr}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                تاجر
              </span>
            </div>
            <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
              {currentStore.address}
            </div>
          </div>
        </div>

        {/* Store Open/Close & Auth Switcher Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleStoreStatus(currentStore.id)}
            className={`px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-1 transition-all shadow-2xs ${
              currentStore.isOpen
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-200 text-slate-600'
            }`}
            title="حالة استقبال الطلبات"
          >
            <Power className="w-3.5 h-3.5" />
            <span className="text-[11px]">{currentStore.isOpen ? 'مفتوح' : 'مغلق'}</span>
          </button>

          <button
            onClick={() => {
              if (onOpenAuthModal) onOpenAuthModal();
              else setIsAuthModalOpen(true);
            }}
            className="text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            title="تبديل المتجر أو الحساب"
          >
            <span>🔄</span>
            <span>تبديل</span>
          </button>
        </div>
      </div>

      {/* Differentiated Merchant Switcher Pill Strip (For Prototype Review) */}
      <div className="bg-amber-500/10 px-4 py-1.5 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-900">
        <span className="font-bold text-[11px]">متاجر العرض التجريبي:</span>
        <div className="flex items-center gap-1.5">
          {DEMO_PERSONAS.filter((p) => p.role === 'merchant').map((merchPersona) => {
            const isCurrent = currentUser.merchantId === merchPersona.merchantId;
            return (
              <button
                key={merchPersona.id}
                onClick={() => switchDemoUser(merchPersona)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                  isCurrent
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white/80 text-amber-900 border border-amber-200/80 hover:bg-white'
                }`}
              >
                {merchPersona.name.split(' ')[0]} ({merchPersona.avatar})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Viewport */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col p-4 overflow-y-auto">
        {/* ========================================================
            TAB 1: INCOMING & ACTIVE ORDERS
           ======================================================== */}
        {activeTab === 'orders' && (
          <div className="flex flex-col gap-3.5">
            {/* Quick KPI Banner */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">طلبات واردة</div>
                <div className="text-base font-black text-amber-600 mt-0.5">
                  {incomingOrders.length} طلب
                </div>
              </div>
              <div className="border-r border-slate-100">
                <div className="text-[10px] text-slate-400 font-semibold">قيد التجهيز</div>
                <div className="text-base font-black text-emerald-700 mt-0.5">
                  {preparingOrders.length} طلب
                </div>
              </div>
              <div className="border-r border-slate-100">
                <div className="text-[10px] text-slate-400 font-semibold">جاهز للكابتن</div>
                <div className="text-base font-black text-slate-900 mt-0.5">
                  {readyOrders.length} طلب
                </div>
              </div>
            </div>

            {/* Notification / Simulated Sync Tip */}
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2.5 text-[11px] text-emerald-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong>عزل بيانات المتجر وسير العمليات:</strong>
                <p className="mt-0.5">
                  أنت الآن في حساب <strong>{currentStore.nameAr}</strong>. ترى فقط الطلبات والمنتجات الخاصة بهذا المتجر. عندما تضغط على "تم التجهيز وجاهز للاستلام"، يتم إرسال إشعار فوري لكابتن مشوار!
                </p>
              </div>
            </div>

            {/* Section: Incoming Orders (created) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>طلبات جديدة واردة ({incomingOrders.length})</span>
                </h3>
              </div>

              {incomingOrders.length === 0 ? (
                <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center text-xs text-slate-400">
                  لا توجد طلبات جديدة معلقة حالياً.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {incomingOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-white p-3.5 rounded-2xl border-2 border-amber-400 shadow-md flex flex-col gap-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {ord.orderNumber} • {ord.customerName}
                        </span>
                        <span className="font-black text-amber-900 text-sm">
                          {ord.totalEgp}.00 ج.م
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-slate-700">
                        {ord.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between font-medium">
                            <span>{i.quantity}× {i.productName}</span>
                            <span className="font-bold">{i.unitPriceEgp * i.quantity} ج.م</span>
                          </div>
                        ))}
                      </div>

                      {ord.notes && (
                        <div className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200">
                          ملاحظة العميل: {ord.notes}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>وقت الطلب: {ord.createdAt}</span>
                        <span>الدفع: {ord.paymentMethod === 'cash' ? 'كاش عند التسليم' : 'إلكتروني'}</span>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={() => setRejectModalOrder(ord.id)}
                          className="py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs"
                        >
                          رفض
                        </button>
                        <button
                          onClick={() => merchantAcceptOrder(ord.id)}
                          className="col-span-2 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20"
                        >
                          قبول الطلب وبدء التحضير
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section: Preparing Orders (merchant_accepted) */}
            {preparingOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-extrabold text-xs text-slate-900">
                    قيد التجهيز بالمتجر ({preparingOrders.length})
                  </h3>
                </div>

                <div className="flex flex-col gap-2.5">
                  {preparingOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">
                          {ord.orderNumber} • {ord.customerName}
                        </span>
                        <span className="font-black text-slate-900">{ord.totalEgp}.00 ج.م</span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded-xl space-y-0.5 text-[11px] text-slate-600">
                        {ord.items.map((i, idx) => (
                          <div key={idx}>
                            {i.quantity}× {i.productName}
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => merchantMarkReady(ord.id)}
                        className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التجهيز • جاهز للاستلام (طلب كابتن)</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section: Ready & In-Transit Orders */}
            {readyOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-extrabold text-xs text-slate-900">
                    بانتظار وتوصيل الكابتن ({readyOrders.length})
                  </h3>
                </div>

                <div className="flex flex-col gap-2.5">
                  {readyOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-1.5 text-xs text-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">{ord.orderNumber}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                          {ord.status === 'ready_for_pickup'
                            ? 'بانتظار قبول الكابتن'
                            : ord.status === 'captain_assigned'
                            ? `الكابتن (${ord.assignedCaptainName}) في الطريق`
                            : 'تم استلام الطلب وبطريق العميل'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        العميل: {ord.customerName} ({ord.customerPhone})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: PRODUCT & MENU MANAGEMENT
           ======================================================== */}
        {activeTab === 'products' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-base text-slate-900">إدارة قائمة الأصناف</h2>
                <p className="text-xs text-slate-500">تعديل الأسعار وتوفر المنتجات بالمتجر</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">
                {storeProducts.length} أصناف
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {storeProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 truncate">{prod.nameAr}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                        {prod.categoryName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{prod.descriptionAr}</p>
                    <div className="text-xs font-black text-emerald-800 mt-1">
                      {prod.priceEgp}.00 ج.م <span className="text-[10px] text-slate-400 font-normal">/ {prod.unit}</span>
                    </div>
                  </div>

                  {/* Controls: Price Edit & Availability Toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingProduct(prod);
                        setNewPriceInput(prod.priceEgp.toString());
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      title="تعديل السعر"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => toggleProductAvailability(prod.id)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-all ${
                        prod.isAvailable
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {prod.isAvailable ? 'متوفر' : 'غير متوفر'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: SALES OVERVIEW & SUBSCRIPTION
           ======================================================== */}
        {activeTab === 'sales' && (
          <div className="flex flex-col gap-3.5">
            <h2 className="font-extrabold text-base text-slate-900">ملخص المبيعات والاشتراك</h2>

            {/* Zero Commission Subscription Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-700 to-amber-900 text-white shadow-lg flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  باقة التاجر الذهبية
                </span>
                <span className="text-xs font-bold text-amber-200">عمولة ٠٪ على المبيعات</span>
              </div>
              <div>
                <h3 className="font-black text-lg">كل أرباح مبيعات متجرك ملك لك ١٠٠٪</h3>
                <p className="text-xs text-amber-100/80">
                  منظومة مشوار لا تخصم نسب مئوية من فواتير المتجر؛ بل تعتمد اشتراكاً شهرياً ثابتاً عادلاً.
                </p>
              </div>
              <div className="text-[11px] pt-2 border-t border-amber-600/60 flex items-center justify-between text-amber-200">
                <span>تاريخ التجديد: ١ نوفمبر ٢٠٢٥</span>
                <span className="font-bold text-white">ساري ونشط</span>
              </div>
            </div>

            {/* Sales Metrics */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">إجمالي المبيعات المكتملة عبر مشوار:</span>
                <span className="text-base font-black text-slate-900">{totalSalesRevenueEgp}.00 ج.م</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">عدد الطلبات المكتملة بنجاح:</span>
                <span className="font-bold text-emerald-800">{completedOrders.length} طلب</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">متوسط قيمة الطلب:</span>
                <span className="font-bold text-slate-900">
                  {completedOrders.length > 0
                    ? Math.round(totalSalesRevenueEgp / completedOrders.length)
                    : 0}{' '}
                  ج.م
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: STORE PROFILE
           ======================================================== */}
        {activeTab === 'profile' && (
          <div className="flex flex-col gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                <img
                  src={currentStore.image}
                  alt={currentStore.nameAr}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">{currentStore.nameAr}</h3>
                <p className="text-xs text-slate-500">{currentStore.ownerName} • {currentStore.phone}</p>
                <div className="text-[11px] text-slate-600 mt-0.5">{currentStore.address}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
              <div className="p-3.5 flex items-center justify-between">
                <span>تصنيف النشاط</span>
                <span className="text-slate-900">{currentStore.categoryAr}</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>وقت التجهيز والتوصيل المتوقع</span>
                <span className="text-slate-900">{currentStore.deliveryTimeEst}</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>تقييم العملاء في الباجور</span>
                <span className="text-amber-600 font-bold">★ {currentStore.rating} ({currentStore.reviewsCount} تقييم)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Price Modal */}
      {editingProduct && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 shadow-2xl max-w-xs w-full flex flex-col gap-3">
            <h3 className="font-extrabold text-sm text-slate-900">تعديل سعر الصنف</h3>
            <div className="text-xs text-slate-600">{editingProduct.nameAr}</div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">السعر الجديد بالجنيه:</label>
              <input
                type="number"
                value={newPriceInput}
                onChange={(e) => setNewPriceInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-base focus:outline-hidden focus:border-amber-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setEditingProduct(null)}
                className="py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSavePrice}
                className="py-2 rounded-xl bg-amber-600 text-white text-xs font-extrabold shadow-sm"
              >
                حفظ السعر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Order Modal */}
      {rejectModalOrder && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 shadow-2xl max-w-xs w-full flex flex-col gap-3">
            <h3 className="font-extrabold text-sm text-rose-700">تأكيد رفض الطلب</h3>
            <p className="text-xs text-slate-600">يرجى كتابة سبب الاعتذار عن الطلب لإبلاغ العميل:</p>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="مثال: نفاد الصنف، ضغط بالفرن..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setRejectModalOrder(null)}
                className="py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmReject}
                className="py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold shadow-sm"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merchant Mobile Bottom Navigation Bar */}
      <div className="relative z-20 bg-white border-t border-slate-100 py-1.5 px-3 flex items-center justify-around shadow-sm shrink-0">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'orders'
              ? 'text-amber-700 font-extrabold'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">الطلبات</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'products'
              ? 'text-amber-700 font-extrabold'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">المنتجات</span>
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'sales'
              ? 'text-amber-700 font-extrabold'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">المبيعات</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'profile'
              ? 'text-amber-700 font-extrabold'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Store className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">المتجر</span>
        </button>
      </div>
    </div>
  );
};
