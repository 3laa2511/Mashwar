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
  ChevronLeft
} from 'lucide-react';

export const MerchantMobileExperience: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'sales' | 'profile'>('orders');

  const [orders, setOrders] = useState([
    {
      id: 'ORD-9842',
      customer: 'سامح فوزي',
      items: '٢ وجبة برجر دجاج عائلي + بطاطس حجم كبير + بيبسي',
      total: '210.00 ج.م',
      status: 'new', // new, preparing, ready, picked_up
      time: 'منذ دقيقتين',
      captain: 'جاري التخصيص...',
    },
    {
      id: 'ORD-9839',
      customer: 'مروة عبد الرحمن',
      items: '١ بيتزا مشكل جبن وسط + سلطة كول سلو',
      total: '125.00 ج.م',
      status: 'preparing',
      time: 'منذ ١٢ دقيقة',
      captain: 'كابتن محمود الصياد (في الطريق للمتجر)',
    },
    {
      id: 'ORD-9831',
      customer: 'أحمد سعيد',
      items: '٣ ساندوتش كفتة مخصوص + طحينة',
      total: '95.00 ج.م',
      status: 'ready',
      time: 'منذ ٢٤ دقيقة',
      captain: 'كابتن طارق الغريب (وصل للمتجر)',
    },
  ]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#FAFAF9] text-slate-800 font-['Cairo',sans-serif] overflow-hidden select-none" dir="rtl">
      {/* Header */}
      <div className="bg-white px-4 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900">مطعم البرنس الباجوري</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                تاجر
              </span>
            </div>
            <div className="text-[11px] text-slate-500">شارع الجمهورية • الباجور</div>
          </div>
        </div>

        {/* Store Open/Closed Switch */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
            isOpen
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{isOpen ? 'المتجر مفتوح' : 'مغلق'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        {/* Quick Sales Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-slate-400 font-semibold">مبيعات اليوم</div>
            <div className="text-sm font-black text-slate-900 mt-0.5">1,430 ج.م</div>
          </div>
          <div className="border-r border-slate-100">
            <div className="text-[10px] text-slate-400 font-semibold">الطلبات</div>
            <div className="text-sm font-black text-emerald-700 mt-0.5">11 طلب</div>
          </div>
          <div className="border-r border-slate-100">
            <div className="text-[10px] text-slate-400 font-semibold">الاشتراك</div>
            <div className="text-sm font-black text-amber-600 mt-0.5">ساري (شهري)</div>
          </div>
        </div>

        {/* Orders List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-extrabold text-xs text-slate-800">طلبات التوصيل الواردة</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              تحديث فوري
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {orders.map((ord) => (
              <div key={ord.id} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">{ord.id}</span>
                    <span className="text-slate-500 font-medium">• {ord.customer}</span>
                  </div>
                  <span className="font-black text-slate-900">{ord.total}</span>
                </div>

                <div className="p-2 bg-slate-50 rounded-xl text-[11px] text-slate-700 font-medium">
                  {ord.items}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {ord.time}
                  </span>
                  <span className="font-bold text-slate-700">{ord.captain}</span>
                </div>

                {/* State toggle button */}
                <div className="pt-1 flex items-center gap-2">
                  {ord.status === 'new' && (
                    <button
                      onClick={() => {
                        setOrders((prev) =>
                          prev.map((o) => (o.id === ord.id ? { ...o, status: 'preparing' } : o))
                        );
                      }}
                      className="flex-1 py-2 bg-emerald-700 text-white font-bold rounded-xl text-xs"
                    >
                      قبول الطلب وبدء التحضير
                    </button>
                  )}
                  {ord.status === 'preparing' && (
                    <button
                      onClick={() => {
                        setOrders((prev) =>
                          prev.map((o) => (o.id === ord.id ? { ...o, status: 'ready' } : o))
                        );
                      }}
                      className="flex-1 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
                    >
                      تم تحضير الطلب وجاهز للتسليم للكابتن
                    </button>
                  )}
                  {ord.status === 'ready' && (
                    <div className="w-full py-2 bg-slate-100 text-slate-600 text-center font-bold rounded-xl text-xs">
                      بانتظار استلام الكابتن للطلب والتوصيل
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="bg-white border-t border-slate-100 py-2 px-4 flex items-center justify-around shadow-sm text-xs">
        <button className="flex flex-col items-center text-emerald-700 font-bold">
          <ShoppingBag className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">الطلبات</span>
        </button>
        <button className="flex flex-col items-center text-slate-400 font-medium">
          <Package className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">قائمة المنتجات</span>
        </button>
        <button className="flex flex-col items-center text-slate-400 font-medium">
          <TrendingUp className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">التقارير</span>
        </button>
      </div>
    </div>
  );
};
