/**
 * Mashwar — Owner & Operations Admin Dashboard (غرفة تحكم وعمليات مشوار)
 * Target Launch Hub: El Bagour (الباجور), Menoufia Governorate, Egypt
 * Monetary Unit: Egyptian Piasters (قروش) — Integer Minor Units (1 EGP = 100 Piasters)
 * Zero Commission Invariant: Captains keep 100% of delivery fares and pay flat monthly subscriptions.
 * Passenger Transport Invariant: 100% locked under Egyptian Law No. 73 of 2018.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  Package,
  Layers,
  DollarSign,
  TrendingUp,
  Activity,
  RotateCcw,
  Sliders,
  Send,
  Search,
  Filter,
  Check,
  X,
  Radio,
  Lock,
  ArrowRight,
  RefreshCw,
  FileText,
  BadgeAlert,
  Truck,
  Bike
} from 'lucide-react';

export type AdminRole = 'owner' | 'operations_dispatcher' | 'support_agent';

export interface AdminUser {
  id: string;
  name: string;
  role: AdminRole;
  roleTitleAr: string;
  avatar: string;
}

const ADMIN_PERSONAS: AdminUser[] = [
  {
    id: 'usr_owner_01',
    name: 'د. علاء',
    role: 'owner',
    roleTitleAr: 'مالك المنصة (Full Access)',
    avatar: '👨‍💼',
  },
  {
    id: 'usr_dispatcher_01',
    name: 'أحمد المنوفي',
    role: 'operations_dispatcher',
    roleTitleAr: 'مسؤول العمليات والترحيل (Dispatcher)',
    avatar: '📡',
  },
  {
    id: 'usr_support_01',
    name: 'سارة ممدوح',
    role: 'support_agent',
    roleTitleAr: 'خدمة العملاء والدعم (Customer Support)',
    avatar: '🎧',
  },
];

interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  serviceType: 'package' | 'restaurant_store' | 'errand';
  serviceTypeAr: string;
  status: 'searching_captain' | 'captain_assigned' | 'in_transit' | 'delivered' | 'cancelled';
  pickup: string;
  dropoff: string;
  isRural: boolean;
  totalFarePiasters: number;
  codCollected: boolean;
  assignedCaptainId?: string;
  assignedCaptainName?: string;
  createdAt: string;
  specialInstructions?: string;
}

interface CaptainItem {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  plateNumber: string;
  status: 'active' | 'grace_period' | 'expired' | 'suspended';
  statusAr: string;
  daysRemaining: number;
  cashHoldingPiasters: number;
  cashCeilingPiasters: number;
  rating: number;
  isOnline: boolean;
  completedToday: number;
}

interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: AdminRole;
  actionType: string;
  target: string;
  descriptionAr: string;
}

export function OwnerAdminDashboard() {
  // Current active admin persona (RBAC demonstration)
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(ADMIN_PERSONAS[0]);

  // Navigation tab within the Admin Suite
  const [adminTab, setAdminTab] = useState<'overview' | 'orders' | 'captains' | 'settings' | 'audit'>(
    'overview'
  );

  // System Settings state
  const [settings, setSettings] = useState({
    hubName: 'مركز عمليات الباجور - المنوفية',
    baseFarePiasters: 1500, // 15.00 EGP
    ratePerKmPiasters: 400, // 4.00 EGP
    ruralSurchargePiasters: 500, // 5.00 EGP
    platformFeePiasters: 200, // 2.00 EGP
    cashCeilingPiasters: 100000, // 1,000.00 EGP
    gracePeriodHours: 72,
    monthlySubscriptionPiasters: 30000, // 300.00 EGP
    passengerMobilityLocked: true,
  });

  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

  // Orders State
  const [orders, setOrders] = useState<OrderItem[]>([
    {
      id: 'ord_bagour_8101',
      orderNumber: 'MSH-8101',
      customerName: 'الحاج عاطف رضوان',
      customerPhone: '01055566671',
      serviceType: 'package',
      serviceTypeAr: 'توصيل مستندات وطرود',
      status: 'delivered',
      pickup: 'ميدان المحطة - وسط الباجور',
      dropoff: 'قرية كفر الباجور',
      isRural: true,
      totalFarePiasters: 3000, // 30.00 EGP
      codCollected: true,
      assignedCaptainId: 'cpt_01',
      assignedCaptainName: 'أحمد فتحي الديب',
      createdAt: 'منذ ساعتين',
      specialInstructions: 'أوراق رسمية هامة ومختومة',
    },
    {
      id: 'ord_bagour_8102',
      orderNumber: 'MSH-8102',
      customerName: 'د. سحر عبد الحميد',
      customerPhone: '01244455582',
      serviceType: 'package',
      serviceTypeAr: 'مستلزمات صيدلية',
      status: 'in_transit',
      pickup: 'مستشفى الباجور العام',
      dropoff: 'قرية شنتنا الحجر',
      isRural: true,
      totalFarePiasters: 3500, // 35.00 EGP
      codCollected: false,
      assignedCaptainId: 'cpt_01',
      assignedCaptainName: 'أحمد فتحي الديب',
      createdAt: 'منذ 35 دقيقة',
      specialInstructions: 'أدوية عاجلة تحفظ مبردة',
    },
    {
      id: 'ord_bagour_8103',
      orderNumber: 'MSH-8103',
      customerName: 'م. إسلام عاشور',
      customerPhone: '01133344493',
      serviceType: 'restaurant_store',
      serviceTypeAr: 'طلب مطاعم ومتاجر',
      status: 'searching_captain',
      pickup: 'شارع الجيش - برج الشروق',
      dropoff: 'شارع الجمهورية - أمام بنك مصر',
      isRural: false,
      totalFarePiasters: 1700, // 17.00 EGP
      codCollected: false,
      createdAt: 'منذ 10 دقائق',
      specialInstructions: 'وجبة عائلية ساخنة',
    },
    {
      id: 'ord_bagour_8104',
      orderNumber: 'MSH-8104',
      customerName: 'كريم ممدوح',
      customerPhone: '01566677704',
      serviceType: 'errand',
      serviceTypeAr: 'شراء مشاوير وقضاء حاجة',
      status: 'cancelled',
      pickup: 'مجلس مدينة الباجور',
      dropoff: 'ميدان المحطة - وسط الباجور',
      isRural: false,
      totalFarePiasters: 1700,
      codCollected: false,
      createdAt: 'منذ 4 ساعات',
      specialInstructions: 'تصوير خرائط هندسية (ألغاه العميل قبل التعيين)',
    },
  ]);

  // Captains State
  const [captains, setCaptains] = useState<CaptainItem[]>([
    {
      id: 'cpt_01',
      name: 'أحمد فتحي الديب',
      phone: '01012345671',
      vehicleType: 'موتوسيكل دايون ٤',
      plateNumber: 'م ن ف ٤٨١٢',
      status: 'active',
      statusAr: 'اشتراك نشط',
      daysRemaining: 18,
      cashHoldingPiasters: 25000, // 250.00 EGP
      cashCeilingPiasters: 100000, // 1,000.00 EGP
      rating: 4.9,
      isOnline: true,
      completedToday: 6,
    },
    {
      id: 'cpt_02',
      name: 'محمود إبراهيم خطاب',
      phone: '01123456782',
      vehicleType: 'سكوتر حوا مارينو',
      plateNumber: 'م ن ف ٩١٥٣',
      status: 'grace_period',
      statusAr: 'فترة سماح (مهلة ٧٢ ساعة)',
      daysRemaining: 2,
      cashHoldingPiasters: 45000, // 450.00 EGP
      cashCeilingPiasters: 100000,
      rating: 4.75,
      isOnline: true,
      completedToday: 4,
    },
    {
      id: 'cpt_03',
      name: 'طارق عبد المنعم الشيخ',
      phone: '01234567893',
      vehicleType: 'سيارة سوزوكي فان بضائع',
      plateNumber: 'م ن ف ٧٢١٤',
      status: 'expired',
      statusAr: 'اشتراك منتهي (الرادار معلق)',
      daysRemaining: 0,
      cashHoldingPiasters: 12000, // 120.00 EGP
      cashCeilingPiasters: 100000,
      rating: 4.6,
      isOnline: false,
      completedToday: 0,
    },
    {
      id: 'cpt_04',
      name: 'مصطفى كمال النجار',
      phone: '01098765434',
      vehicleType: 'موتوسيكل بوكسر',
      plateNumber: 'م ن ف ٦٣٢٨',
      status: 'suspended',
      statusAr: 'موقوف لتجاوز سقف النقدية',
      daysRemaining: 20,
      cashHoldingPiasters: 102000, // 1,020.00 EGP > 1,000.00 EGP ceiling
      cashCeilingPiasters: 100000,
      rating: 4.8,
      isOnline: false,
      completedToday: 8,
    },
  ]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'aud_01',
      timestamp: 'اليوم ١٠:٠٠ ص',
      actorName: 'د. علاء',
      actorRole: 'owner',
      actionType: 'SYSTEM_SETTINGS_UPDATED',
      target: 'إعدادات المنظومة',
      descriptionAr: 'اعتماد تسعيرة الانطلاق لمركز الباجور وقفل نقل الركاب طبقاً للقانون رقم ٧٣ لسنة ٢٠١٨.',
    },
    {
      id: 'aud_02',
      timestamp: 'اليوم ١١:١٥ ص',
      actorName: 'أحمد المنوفي',
      actorRole: 'operations_dispatcher',
      actionType: 'MANUAL_DISPATCH_ASSIGNMENT',
      target: 'طلب MSH-8102',
      descriptionAr: 'تعيين الكابتن أحمد فتحي الديب لنقل شحنة مستلزمات طبية عاجلة إلى شنتنا الحجر.',
    },
  ]);

  // Modals state
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<OrderItem | null>(null);
  const [selectedCaptainForSettle, setSelectedCaptainForSettle] = useState<CaptainItem | null>(null);
  const [remitAmountInput, setRemitAmountInput] = useState<string>('');
  const [cancelOrderModal, setCancelOrderModal] = useState<OrderItem | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // KPI Calculations
  const activeOrdersCount = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;
  const onlineCaptainsCount = captains.filter((c) => c.isOnline).length;
  const totalPlatformFeesEgp = ((orders.filter((o) => o.status === 'delivered').length * settings.platformFeePiasters) / 100).toFixed(2);
  const totalUnremittedCashEgp = (captains.reduce((sum, c) => sum + c.cashHoldingPiasters, 0) / 100).toFixed(2);

  // Handle Manual Dispatch
  const handleAssignCaptain = (captainId: string) => {
    if (!selectedOrderForDispatch) return;
    const captain = captains.find((c) => c.id === captainId);
    if (!captain) return;

    if (captain.status === 'expired' || captain.status === 'suspended') {
      alert(`عذراً: الكابتن غير مؤهل لاستلام الطلبات حالياً (${captain.statusAr}).`);
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrderForDispatch.id
          ? {
              ...o,
              status: 'captain_assigned',
              assignedCaptainId: captain.id,
              assignedCaptainName: captain.name,
            }
          : o
      )
    );

    // Record audit log
    const newLog: AuditLog = {
      id: `aud_${Date.now()}`,
      timestamp: 'الآن',
      actorName: currentAdmin.name,
      actorRole: currentAdmin.role,
      actionType: 'MANUAL_DISPATCH_ASSIGNMENT',
      target: `طلب ${selectedOrderForDispatch.orderNumber}`,
      descriptionAr: `تدخل يدوي من العمليات: تعيين الكابتن ${captain.name} للطلب ${selectedOrderForDispatch.orderNumber}.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setSelectedOrderForDispatch(null);
  };

  // Handle Emergency Cancellation
  const handleEmergencyCancel = () => {
    if (!cancelOrderModal || !cancellationReason.trim()) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === cancelOrderModal.id
          ? { ...o, status: 'cancelled', specialInstructions: `[إلغاء إداري: ${cancellationReason}]` }
          : o
      )
    );

    const newLog: AuditLog = {
      id: `aud_${Date.now()}`,
      timestamp: 'الآن',
      actorName: currentAdmin.name,
      actorRole: currentAdmin.role,
      actionType: 'ORDER_EMERGENCY_CANCELLED',
      target: `طلب ${cancelOrderModal.orderNumber}`,
      descriptionAr: `إلغاء إداري للطلب ${cancelOrderModal.orderNumber}. السبب: ${cancellationReason}.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setCancelOrderModal(null);
    setCancellationReason('');
  };

  // Handle Cash Remittance Settlement
  const handleSettleCash = () => {
    if (!selectedCaptainForSettle) return;
    const amountEgp = parseFloat(remitAmountInput) || selectedCaptainForSettle.cashHoldingPiasters / 100;
    const amountPiasters = Math.round(amountEgp * 100);

    if (amountPiasters <= 0) {
      alert('يرجى إدخال مبلغ صحيح للتوريد.');
      return;
    }

    setCaptains((prev) =>
      prev.map((c) => {
        if (c.id === selectedCaptainForSettle.id) {
          const newHolding = Math.max(0, c.cashHoldingPiasters - amountPiasters);
          // Auto recover suspension if under ceiling
          const newStatus =
            c.status === 'suspended' && newHolding < c.cashCeilingPiasters
              ? 'active'
              : c.status;
          return {
            ...c,
            cashHoldingPiasters: newHolding,
            status: newStatus,
            statusAr: newStatus === 'active' ? 'اشتراك نشط' : c.statusAr,
          };
        }
        return c;
      })
    );

    const newLog: AuditLog = {
      id: `aud_${Date.now()}`,
      timestamp: 'الآن',
      actorName: currentAdmin.name,
      actorRole: currentAdmin.role,
      actionType: 'CAPTAIN_CASH_SETTLED',
      target: `كابتن ${selectedCaptainForSettle.name}`,
      descriptionAr: `توريد وتسوية نقدية بمبلغ ${amountEgp.toFixed(2)} ج.م للكابتن ${selectedCaptainForSettle.name}. تم إيداع المبلغ بخزينة مركز الباجور.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    setSelectedCaptainForSettle(null);
    setRemitAmountInput('');
  };

  // Handle Captain Subscription Renewal
  const handleRenewSubscription = (captainId: string) => {
    if (currentAdmin.role === 'support_agent') {
      alert('عذراً: خدمة العملاء لا تملك صلاحية تجديد الاشتراكات (مطلوب مالك أو مسؤول عمليات).');
      return;
    }

    const captain = captains.find((c) => c.id === captainId);
    if (!captain) return;

    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              status: 'active',
              statusAr: 'اشتراك نشط',
              daysRemaining: 30,
            }
          : c
      )
    );

    const newLog: AuditLog = {
      id: `aud_${Date.now()}`,
      timestamp: 'الآن',
      actorName: currentAdmin.name,
      actorRole: currentAdmin.role,
      actionType: 'CAPTAIN_SUBSCRIPTION_RENEWED',
      target: `كابتن ${captain.name}`,
      descriptionAr: `تجديد الاشتراك الشهري للكابتن ${captain.name} لمدة ٣٠ يوماً (بنسبة ٠٪ عمولة على الرحلات).`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Handle Settings Update (Owner Only)
  const handleSaveSettings = () => {
    if (currentAdmin.role !== 'owner') {
      alert('خطأ في الصلاحيات: فقط مالك المنصة يملك الحق في تعديل تعريفة التسعيرة والسياسات المالية.');
      return;
    }

    setSettingsFeedback('تم حفظ وتحديث إعدادات التسعيرة لمركز الباجور بنجاح.');
    setTimeout(() => setSettingsFeedback(null), 4000);

    const newLog: AuditLog = {
      id: `aud_${Date.now()}`,
      timestamp: 'الآن',
      actorName: currentAdmin.name,
      actorRole: currentAdmin.role,
      actionType: 'PRICING_CONFIG_UPDATED',
      target: 'تعريفة مركز الباجور',
      descriptionAr: `تعديل معايير التسعيرة: الأجرة الأساسية ${(settings.baseFarePiasters / 100).toFixed(2)} ج.م، الكيلومتر ${(settings.ratePerKmPiasters / 100).toFixed(2)} ج.م، بدل القرى ${(settings.ruralSurchargePiasters / 100).toFixed(2)} ج.م.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Top Operations Header Bar & Persona Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl border border-amber-500/30">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">غرفة تحكم وعمليات مشوار — مركز الباجور</h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  متصل وموثق
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                نظام إدارة الأسطول والطلبات والتسعيرة الموثوقة • نطاق مدينة الباجور وقرى مركز المنوفية
              </p>
            </div>
          </div>

          {/* Active Admin Persona Switcher (RBAC) */}
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-bold ml-1">الدور الفعلي (RBAC):</span>
            {ADMIN_PERSONAS.map((persona) => {
              const isSelected = currentAdmin.id === persona.id;
              return (
                <button
                  key={persona.id}
                  onClick={() => setCurrentAdmin(persona)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{persona.avatar}</span>
                  <span>{persona.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Role Privileges Indicator */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">الحساب المفعل:</span>
            <span className="font-bold text-amber-400">{currentAdmin.name}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">{currentAdmin.roleTitleAr}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">نموذج العمولات:</span>
            <span className="font-bold text-emerald-400">اشتراك شهري مقطوع (عمولة ٠٪ على المشاوير)</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">وحدة الحساب:</span>
            <span className="font-mono font-bold text-amber-300">القرش المصري (Integer Piasters)</span>
          </div>
        </div>
      </div>

      {/* Admin Suite Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setAdminTab('overview')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            adminTab === 'overview'
              ? 'bg-amber-500 text-slate-950 shadow-lg'
              : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>مركز العمليات والرادار الحي</span>
        </button>

        <button
          onClick={() => setAdminTab('orders')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            adminTab === 'orders'
              ? 'bg-amber-500 text-slate-950 shadow-lg'
              : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>إدارة الطلبات والترحيل ({orders.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('captains')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            adminTab === 'captains'
              ? 'bg-amber-500 text-slate-950 shadow-lg'
              : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Bike className="w-4 h-4" />
          <span>أسطول الكباتن والاشتراكات ({captains.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('settings')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            adminTab === 'settings'
              ? 'bg-amber-500 text-slate-950 shadow-lg'
              : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>تعريفة التسعيرة وسياسات المركز</span>
          {currentAdmin.role !== 'owner' && (
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          )}
        </button>

        <button
          onClick={() => setAdminTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            adminTab === 'audit'
              ? 'bg-amber-500 text-slate-950 shadow-lg'
              : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>سجل الأمان والعمليات الموثق ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: HUB OVERVIEW & DISPATCH RADAR */}
      {adminTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* 5 Real-Time KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>الطلبات الجارية</span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{activeOrdersCount}</span>
                <span className="text-[11px] text-amber-400 font-bold mr-2">طلب نشط</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">تشمل بانتظار الكابتن وقيد التوصيل</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>الكباتن على الرادار</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Bike className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{onlineCaptainsCount}</span>
                <span className="text-[11px] text-emerald-400 font-bold mr-2">من أصل {captains.length}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">متاحون لاستقبال الطلبات الفورية</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>إيرادات رسوم المنصة</span>
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{totalPlatformFeesEgp}</span>
                <span className="text-[11px] text-blue-400 font-bold mr-1">ج.م</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">٢.٠٠ ج.م رسوم دعم لكل طلب ناجح</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>نقدية معلقة في العهدة</span>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{totalUnremittedCashEgp}</span>
                <span className="text-[11px] text-purple-400 font-bold mr-1">ج.م</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">سقف التحصيل الأقصى ١,٠٠٠ ج.م/كابتن</p>
            </div>

            <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>نقل الركاب المحظور</span>
                <span className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-red-400">٠</span>
                <span className="text-[11px] text-red-300 font-bold mr-2">محظور ١٠٠٪</span>
              </div>
              <p className="text-[10px] text-red-300/80 mt-2">امتثالاً للقانون رقم ٧٣ لسنة ٢٠١٨</p>
            </div>
          </div>

          {/* Interactive El Bagour Dispatch Radar Map */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>رادار العمليات الحي — نطاق مركز الباجور والمناطق المحيطة</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  خريطة توضح توزيع الكباتن والطلبات الجارية والتفرقة بين النطاق الحضري وبدل القرى (٥٠٠ قرش)
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  🟢 كابتن نشط على الرادار
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  🟡 طلب بانتظار استلام
                </span>
              </div>
            </div>

            {/* Radar Grid Representation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Central Urban Zone */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>النطاق الحضري (وسط الباجور)</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
                    تسعيرة أساسية ١٥ ج.م
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">ميدان المحطة - وسط الباجور</span>
                      <span className="text-[10px] text-slate-400">نقطة الانطلاق الرئيسية</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                      ٢ كابتن متواجدين
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">شارع الجيش - برج الشروق</span>
                      <span className="text-[10px] text-slate-400">منطقة تجارية ومطاعم</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      طلب MSH-8103
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">مستشفى الباجور العام</span>
                      <span className="text-[10px] text-slate-400">القطاع الطبي والطوارئ</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                      طلب MSH-8102 قيد التوصيل
                    </span>
                  </div>
                </div>
              </div>

              {/* Rural Outer Zone (Kafr El Bagour & Grawan) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>القرى الجنوبية (بدل طرق ٥ ج.م)</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold">
                    +٥٠٠ قرش
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">قرية كفر الباجور</span>
                      <span className="text-[10px] text-slate-400">مسافة ٢.٨ كم عن المركز</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                      طلب MSH-8101 تم تسليمه
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">قرية جروان</span>
                      <span className="text-[10px] text-slate-400">مسافة ٤.٥ كم عن المركز</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      جاهز للتغطية
                    </span>
                  </div>
                </div>
              </div>

              {/* Rural Outer Zone (Shantana El Hagar & Meet Afif) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>القرى الشمالية (بدل طرق ٥ ج.م)</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-bold">
                    +٥٠٠ قرش
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">قرية شنتنا الحجر</span>
                      <span className="text-[10px] text-slate-400">مسافة ٥.٢ كم عن المركز</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                      الكابتن أحمد بالطريق
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">قرية ميت عفيف</span>
                      <span className="text-[10px] text-slate-400">مسافة ٦.٠ كم عن المركز</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      جاهز للتغطية
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE ORDERS MANAGEMENT & DISPATCH */}
      {adminTab === 'orders' && (
        <div className="flex flex-col gap-4">
          {/* Status Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">تصفية الحالات:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                الكل ({orders.length})
              </button>
              <button
                onClick={() => setStatusFilter('searching_captain')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'searching_captain' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                بانتظار كابتن ({orders.filter((o) => o.status === 'searching_captain').length})
              </button>
              <button
                onClick={() => setStatusFilter('in_transit')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'in_transit' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                قيد التوصيل ({orders.filter((o) => o.status === 'in_transit').length})
              </button>
              <button
                onClick={() => setStatusFilter('delivered')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'delivered' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                تم التسليم ({orders.filter((o) => o.status === 'delivered').length})
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'cancelled' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ملغي ({orders.filter((o) => o.status === 'cancelled').length})
              </button>
            </div>
          </div>

          {/* Orders Cards List */}
          <div className="grid grid-cols-1 gap-3">
            {filteredOrders.map((order) => {
              const fareEgp = (order.totalFarePiasters / 100).toFixed(2);
              return (
                <div
                  key={order.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                        {order.orderNumber}
                      </span>
                      <span className="text-xs font-bold text-white">{order.customerName}</span>
                      <span className="text-xs text-slate-400 font-mono">({order.customerPhone})</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {order.serviceTypeAr}
                      </span>
                      {order.isRural && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          بدل قرى +٥٠٠ قرش
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-300 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>من: {order.pickup}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 rotate-180" />
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>إلى: {order.dropoff}</span>
                      </div>
                    </div>

                    {order.specialInstructions && (
                      <p className="text-[11px] text-amber-300/80 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        ملاحظات: {order.specialInstructions}
                      </p>
                    )}
                  </div>

                  {/* Pricing & State & Actions */}
                  <div className="flex flex-wrap items-center gap-4 lg:border-r lg:border-slate-800 lg:pr-4">
                    <div className="text-left">
                      <span className="text-xs text-slate-400 block">التسعيرة المعتمدة</span>
                      <span className="text-base font-black text-white">{fareEgp} ج.م</span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        ({order.totalFarePiasters.toLocaleString()} قرش)
                      </span>
                    </div>

                    <div>
                      {order.status === 'searching_captain' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse block text-center">
                          بانتظار كابتن
                        </span>
                      )}
                      {order.status === 'captain_assigned' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 block text-center">
                          كابتن: {order.assignedCaptainName}
                        </span>
                      )}
                      {order.status === 'in_transit' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 block text-center">
                          قيد التوصيل ({order.assignedCaptainName})
                        </span>
                      )}
                      {order.status === 'delivered' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          تم التسليم والنقدية
                        </span>
                      )}
                      {order.status === 'cancelled' && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 block text-center">
                          ملغي
                        </span>
                      )}
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {order.status === 'searching_captain' && (
                        <button
                          onClick={() => setSelectedOrderForDispatch(order)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
                        >
                          تعيين يدوي (Dispatch)
                        </button>
                      )}

                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => setCancelOrderModal(order)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-medium transition"
                        >
                          إلغاء طارئ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CAPTAIN FLEET & SUBSCRIPTION ENGINE */}
      {adminTab === 'captains' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {captains.map((captain) => {
              const cashEgp = (captain.cashHoldingPiasters / 100).toFixed(2);
              const ceilingEgp = (captain.cashCeilingPiasters / 100).toFixed(2);
              const cashProgress = Math.min(100, Math.round((captain.cashHoldingPiasters / captain.cashCeilingPiasters) * 100));

              return (
                <div
                  key={captain.id}
                  className={`bg-slate-900 border rounded-2xl p-5 shadow-lg flex flex-col justify-between gap-4 ${
                    captain.status === 'suspended'
                      ? 'border-red-500/40'
                      : captain.status === 'grace_period'
                      ? 'border-amber-500/40'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-lg border border-slate-700">
                        {captain.vehicleType.includes('موتوسيكل') ? '🏍️' : captain.vehicleType.includes('فان') ? '🚐' : '🛵'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{captain.name}</h4>
                          {captain.isOnline ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                              متصل
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              غير متصل
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {captain.phone} • {captain.vehicleType} ({captain.plateNumber})
                        </p>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs font-bold text-amber-400">★ {captain.rating}</span>
                      <span className="text-[10px] text-slate-500 block">{captain.completedToday} طلبات اليوم</span>
                    </div>
                  </div>

                  {/* Subscription & 0% Commission Badge */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">حالة الاشتراك الشهري:</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          captain.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : captain.status === 'grace_period'
                            ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                            : captain.status === 'suspended'
                            ? 'bg-red-500/20 text-red-400 font-black'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {captain.statusAr}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>نموذج العمل:</span>
                      <span className="text-emerald-400 font-bold">عمولة ٠٪ (يحصل الكابتن على ١٠٠٪ من الأجرة)</span>
                    </div>

                    {captain.status === 'grace_period' && (
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                        ⚠️ الكابتن في مهلة السماح ({captain.daysRemaining} يوم متبقي). يستقبل الطلبات مع تنبيه فوري للتجديد.
                      </div>
                    )}

                    {captain.status === 'suspended' && (
                      <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
                        ⛔ تم حظر الكابتن مؤقتاً لتجاوز سقف النقدية المسموح ({ceilingEgp} ج.م). يجب التوريد لإعادة التفعيل.
                      </div>
                    )}
                  </div>

                  {/* Cash Holding Meter */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">العهدة النقدية المحصلة:</span>
                      <span className="font-bold text-white">
                        {cashEgp} ج.م <span className="text-slate-500 font-normal">/ {ceilingEgp} ج.م سقف</span>
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          cashProgress >= 100
                            ? 'bg-red-500'
                            : cashProgress > 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${cashProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Captain Operations Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setSelectedCaptainForSettle(captain);
                        setRemitAmountInput((captain.cashHoldingPiasters / 100).toString());
                      }}
                      className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow"
                    >
                      توريد النقدية (خزينة المركز)
                    </button>

                    <button
                      onClick={() => handleRenewSubscription(captain.id)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow"
                    >
                      تجديد الاشتراك (٣٠ يوم)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: TARIFF & HUB SETTINGS (OWNER GUARDED) */}
      {adminTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {currentAdmin.role !== 'owner' ? (
            <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">صلاحية تعديل التسعيرة مقيدة</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                أنت مسجل حالياً بدور <span className="font-bold text-amber-400">"{currentAdmin.roleTitleAr}"</span>. تعديل معايير التسعيرة الأساسية وسياسات العمولات وسقف النقدية محصورة حصراً بـ <span className="font-bold text-emerald-400">مالك المنصة (Owner)</span> لحماية النزاهة المالية للمنظومة.
              </p>
              <button
                onClick={() => setCurrentAdmin(ADMIN_PERSONAS[0])}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow hover:bg-amber-400 transition"
              >
                التبديل لحساب مالك المنصة (د. علاء)
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  <span>معايير التسعيرة المعتمدة لمركز الباجور (Authoritative Tariff)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  الحسابات تعتمد حصرياً على القرش المصري (Integer Piasters) لمنع أخطاء التقريب المالي.
                </p>
              </div>

              {settingsFeedback && (
                <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{settingsFeedback}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Base Fare */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    الأجرة الأساسية لأول ١.٥ كم (بالقرش):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.baseFarePiasters}
                      onChange={(e) => setSettings({ ...settings, baseFarePiasters: Number(e.target.value) })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                    <span className="text-xs text-amber-400 font-bold">
                      = {(settings.baseFarePiasters / 100).toFixed(2)} ج.م
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">تغطي المشاوير الحضرية داخل مدينة الباجور</p>
                </div>

                {/* Per Km Rate */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    سعر الكيلومتر الإضافي (بالقرش):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.ratePerKmPiasters}
                      onChange={(e) => setSettings({ ...settings, ratePerKmPiasters: Number(e.target.value) })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                    <span className="text-xs text-amber-400 font-bold">
                      = {(settings.ratePerKmPiasters / 100).toFixed(2)} ج.م/كم
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">يُحسب بعد تجاوز مسافة ١.٥ كم الأولى</p>
                </div>

                {/* Rural Surcharge */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    بدل الطرق غير الممهدة والقرى (بالقرش):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.ruralSurchargePiasters}
                      onChange={(e) => setSettings({ ...settings, ruralSurchargePiasters: Number(e.target.value) })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                    <span className="text-xs text-amber-400 font-bold">
                      = {(settings.ruralSurchargePiasters / 100).toFixed(2)} ج.م
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">يطبق تلقائياً عند التوصيل لقرى مركز الباجور</p>
                </div>

                {/* Platform Fee */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    رسوم تشغيل ودعم المنصة (بالقرش):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.platformFeePiasters}
                      onChange={(e) => setSettings({ ...settings, platformFeePiasters: Number(e.target.value) })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                    <span className="text-xs text-amber-400 font-bold">
                      = {(settings.platformFeePiasters / 100).toFixed(2)} ج.م
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">رسم ثابت عن كل رحلة منفذة</p>
                </div>

                {/* Cash Ceiling */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    سقف تحصيل النقدية للكابتن (بالقرش):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.cashCeilingPiasters}
                      onChange={(e) => setSettings({ ...settings, cashCeilingPiasters: Number(e.target.value) })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                    <span className="text-xs text-amber-400 font-bold">
                      = {(settings.cashCeilingPiasters / 100).toFixed(2)} ج.م
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">يتوقف إرسال العروض عند بلوغ هذا الحد</p>
                </div>

                {/* Grace Period */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    مهلة السماح بعد انتهاء الاشتراك (بالساعات):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={settings.gracePeriodHours}
                      onChange={(e) => setSettings({ ...settings, gracePeriodHours: Number(e.target.value) })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                    <span className="text-xs text-amber-400 font-bold">ساعة</span>
                  </div>
                  <p className="text-[10px] text-slate-500">٧٢ ساعة لضمان استمرارية الخدمة</p>
                </div>
              </div>

              {/* Regulatory Law Lock Notice */}
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-200 leading-relaxed">
                  <strong className="text-red-300 font-bold block mb-1">
                    القفل التنظيمي لخدمة نقل الركاب (محظور التعديل برمجياً):
                  </strong>
                  خدمة نقل الأفراد والركاب معطلة نظامياً ومغلقة برمجياً بموجب القانون رقم ٧٣ لسنة ٢٠١٨ المنظم للنقل البري للركاب. لا يمكن رفع هذا الحظر إلا بقرار تنفيذي بعد استيفاء التراخيص المرورية من إدارة مرور المنوفية واعتماد وثائق التأمين التجاري.
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ وتطبيق التسعيرة فورياً في الخادم</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: IMMUTABLE AUDIT LEDGER */}
      {adminTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>سجل الأمان والعمليات الموثق (Immutable Operations Ledger)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                سجل إلكتروني لا يقبل الحذف، يوثق كافة التدخلات الإدارية وتوريدات الخزينة والتسعيرة.
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
              {auditLogs.length} سجلات موثقة
            </span>
          </div>

          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{log.actorName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                      {log.actorRole}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{log.descriptionAr}</p>
                </div>

                <div className="shrink-0">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 font-mono text-[11px] border border-amber-500/20">
                    {log.actionType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: MANUAL DISPATCH OVERRIDE */}
      {selectedOrderForDispatch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                تعيين كابتن يدوي للطلب {selectedOrderForDispatch.orderNumber}
              </h3>
              <button
                onClick={() => setSelectedOrderForDispatch(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              اختر أحد الكباتن المؤهلين لإرسال أمر التكليف المباشر. سيتم توثيق هذا الإجراء في سجل العمليات.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {captains.map((c) => {
                const isEligible = c.status === 'active' || c.status === 'grace_period';
                return (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      isEligible
                        ? 'bg-slate-950 border-slate-800 hover:border-amber-500/50'
                        : 'bg-slate-950/50 border-slate-800/40 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{c.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({c.vehicleType})</span>
                      </div>
                      <span className="text-[10px] text-amber-400">{c.statusAr}</span>
                    </div>

                    <button
                      onClick={() => handleAssignCaptain(c.id)}
                      disabled={!isEligible}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs transition"
                    >
                      تعيين الكابتن
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CASH REMITTANCE SETTLEMENT */}
      {selectedCaptainForSettle && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                توريد وتسوية نقدية — {selectedCaptainForSettle.name}
              </h3>
              <button
                onClick={() => setSelectedCaptainForSettle(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">إجمالي العهدة النقدية في يد الكابتن:</span>
                <span className="font-bold text-amber-400">
                  {(selectedCaptainForSettle.cashHoldingPiasters / 100).toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">سقف التحصيل الأقصى:</span>
                <span className="font-mono text-slate-300">
                  {(selectedCaptainForSettle.cashCeilingPiasters / 100).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                المبلغ المراد توريده لخزينة المركز (ج.م):
              </label>
              <input
                type="number"
                value={remitAmountInput}
                onChange={(e) => setRemitAmountInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                placeholder="أدخل المبلغ بالجنيه"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSettleCash}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow"
              >
                تأكيد الإيداع بخزينة المركز
              </button>
              <button
                onClick={() => setSelectedCaptainForSettle(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EMERGENCY ORDER CANCELLATION */}
      {cancelOrderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-red-400">
                إلغاء إداري طارئ للطلب {cancelOrderModal.orderNumber}
              </h3>
              <button
                onClick={() => setCancelOrderModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                سبب الإلغاء (إلزامي للتوثيق في السجل الرقابي):
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="مثال: تعذر التواصل مع المرسل، عنوان غير متوفر، إلغاء بناء على طلب العميل..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white h-24 resize-none"
              ></textarea>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleEmergencyCancel}
                disabled={!cancellationReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs transition shadow"
              >
                تأكيد الإلغاء وتدوينه في السجل
              </button>
              <button
                onClick={() => setCancelOrderModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
