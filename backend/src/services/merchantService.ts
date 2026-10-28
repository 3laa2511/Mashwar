/**
 * Mashwar — Merchant, Store & Catalog Management Service
 * Enforces strict store ownership (merchant can only mutate their own store/catalog)
 * and 100% integer Egyptian Piasters pricing.
 */

import { Store, MenuCategory, MenuItem } from '../types/index.js';
import { PersistentStore } from '../store/persistentStore.js';
import { AuditLogger } from '../security/auditLogger.js';
import { AccessControlGuard, UserRole } from '../security/rbac.js';

export class MerchantService {
  /**
   * Lists active stores with optional filtering by city, zone, category, or open state.
   */
  public static listStores(filters?: {
    cityId?: string;
    zoneId?: string;
    category?: string;
    onlyOpen?: boolean;
  }): Store[] {
    return PersistentStore.getAllStores(filters);
  }

  /**
   * Gets store details along with its menu categories and items.
   */
  public static getStoreCatalog(storeId: string, onlyAvailable: boolean = false): {
    store: Store;
    categories: MenuCategory[];
    items: MenuItem[];
  } {
    const store = PersistentStore.getStoreById(storeId);
    if (!store || !store.isActive) {
      const err = new Error('المتجر المطلوب غير موجود أو غير نشط بالنظام.');
      (err as any).code = 'STORE_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    const categories = PersistentStore.getMenuCategoriesByStore(storeId);
    const items = PersistentStore.getMenuItemsByStore(storeId, onlyAvailable);
    return { store, categories, items };
  }

  /**
   * Verifies that the authenticated actor is either:
   * 1) An authorized administrative role ('owner' or 'operations_dispatcher') holding 'manage_merchants'
   *    AND acting within the active company/tenant city & zone scope; OR
   * 2) The owning 'merchant' (`store.merchantUserId === actorId`).
   */
  public static assertStoreOwnership(
    store: Store,
    actorId: string,
    actorRole: UserRole,
    actorCityScopeId?: string
  ): void {
    if (!actorId || typeof actorId !== 'string' || actorId.trim() === '') {
      const err = new Error('هوية المستخدم غير موثقة لإدارة المتجر.');
      (err as any).code = 'UNAUTHENTICATED_STORE_ACTOR';
      (err as any).statusCode = 401;
      throw err;
    }

    if (actorRole === 'owner' || actorRole === 'operations_dispatcher') {
      // Enforce RBAC permission 'manage_merchants'
      AccessControlGuard.checkPermission(actorRole, 'manage_merchants');

      // Enforce company/tenant scope: store must belong to an active company city and active service zone
      const activeCompanyCities = PersistentStore.getAllCities();
      const storeCity = activeCompanyCities.find((c) => c.id === store.cityId && c.isActive);
      const storeZone = PersistentStore.getZoneById(store.zoneId);

      if (!storeCity || !storeZone || !storeZone.isActive) {
        const err = new Error('المتجر يقع خارج النطاق الجغرافي والتشغيلي المعتمد للشركة.');
        (err as any).code = 'FORBIDDEN_TENANT_SCOPE';
        (err as any).statusCode = 403;
        throw err;
      }

      if (actorCityScopeId && actorCityScopeId.trim() !== '' && actorCityScopeId !== store.cityId) {
        const err = new Error(
          `غير مصرح بإدارة متجر في مدينة (${store.cityId}) خارج نطاق صلاحيات المدينة المحدد (${actorCityScopeId}).`
        );
        (err as any).code = 'FORBIDDEN_TENANT_SCOPE';
        (err as any).statusCode = 403;
        throw err;
      }

      return;
    }

    if (actorRole !== 'merchant' || store.merchantUserId !== actorId) {
      const err = new Error('غير مصرح لك بتعديل بيانات أو قائمة منتجات متجر لا تملكه.');
      (err as any).code = 'FORBIDDEN_STORE_OWNERSHIP';
      (err as any).statusCode = 403;
      throw err;
    }
  }

  /**
   * Toggles store open/closed status or updates preparation time.
   */
  public static updateStoreStatus(params: {
    storeId: string;
    actorId: string;
    actorRole: UserRole;
    actorName: string;
    actorCityScopeId?: string;
    isOpen?: boolean;
    prepTimeMinutes?: number;
    minOrderPiasters?: number;
  }): Store {
    const store = PersistentStore.getStoreById(params.storeId);
    if (!store) {
      const err = new Error('المتجر غير موجود.');
      (err as any).code = 'STORE_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    this.assertStoreOwnership(store, params.actorId, params.actorRole, params.actorCityScopeId);

    if (
      params.minOrderPiasters !== undefined &&
      (!Number.isInteger(params.minOrderPiasters) || params.minOrderPiasters < 0)
    ) {
      const err = new Error('الحد الأدنى للطلب بالقرش يجب أن يكون عدداً صحيحاً غير سالب.');
      (err as any).code = 'INVALID_MIN_ORDER_PIASTERS';
      (err as any).statusCode = 400;
      throw err;
    }

    if (
      params.prepTimeMinutes !== undefined &&
      (!Number.isInteger(params.prepTimeMinutes) || params.prepTimeMinutes < 1 || params.prepTimeMinutes > 240)
    ) {
      const err = new Error('وقت التحضير بالدقائق يجب أن يكون عدداً صحيحاً بين 1 و 240 دقيقة.');
      (err as any).code = 'INVALID_PREP_TIME_MINUTES';
      (err as any).statusCode = 400;
      throw err;
    }

    const prevState = { ...store };
    const updatedStore: Store = {
      ...store,
      isOpen: params.isOpen !== undefined ? Boolean(params.isOpen) : store.isOpen,
      prepTimeMinutes:
        params.prepTimeMinutes !== undefined ? Number(params.prepTimeMinutes) : store.prepTimeMinutes,
      minOrderPiasters:
        params.minOrderPiasters !== undefined ? Number(params.minOrderPiasters) : store.minOrderPiasters,
      updatedAt: new Date().toISOString(),
    };

    PersistentStore.saveStore(updatedStore);

    AuditLogger.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorName: params.actorName,
      actionType: 'STORE_STATUS_UPDATED',
      targetEntity: 'store',
      targetId: store.id,
      descriptionAr: `تحديث حالة المتجر (${store.nameAr}): ${updatedStore.isOpen ? 'مفتوح للطلبات' : 'مغلق مؤقتاً'}.`,
      previousState: { isOpen: prevState.isOpen, prepTimeMinutes: prevState.prepTimeMinutes },
      newState: { isOpen: updatedStore.isOpen, prepTimeMinutes: updatedStore.prepTimeMinutes },
    });

    return updatedStore;
  }

  /**
   * Creates a new menu item in integer Egyptian Piasters.
   */
  public static createMenuItem(params: {
    storeId: string;
    actorId: string;
    actorRole: UserRole;
    actorName: string;
    actorCityScopeId?: string;
    categoryId?: string;
    categoryNameAr: string;
    nameAr: string;
    descriptionAr: string;
    pricePiasters: number;
    unitAr?: string;
    isAvailable?: boolean;
  }): MenuItem {
    const store = PersistentStore.getStoreById(params.storeId);
    if (!store) {
      const err = new Error('المتجر غير موجود.');
      (err as any).code = 'STORE_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    this.assertStoreOwnership(store, params.actorId, params.actorRole, params.actorCityScopeId);

    if (!params.nameAr || params.nameAr.trim().length < 2) {
      const err = new Error('اسم الصنف مطلوب ويجب ألا يقل عن حرفين.');
      (err as any).code = 'INVALID_ITEM_NAME';
      (err as any).statusCode = 400;
      throw err;
    }

    if (!Number.isInteger(params.pricePiasters) || params.pricePiasters <= 0) {
      const err = new Error('سعر المنتج بالقرش يجب أن يكون عدداً صحيحاً موجباً (مثال: 8500 قرش = 85 ج.م).');
      (err as any).code = 'INVALID_PRICE_PIASTERS';
      (err as any).statusCode = 400;
      throw err;
    }

    const nowIso = new Date().toISOString();
    const newItem: MenuItem = {
      id: `prod_${store.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: store.id,
      categoryId: params.categoryId || `cat_${store.id}_default`,
      categoryNameAr: params.categoryNameAr || 'أصناف المتجر',
      nameAr: params.nameAr.trim(),
      descriptionAr: params.descriptionAr || '',
      pricePiasters: params.pricePiasters,
      unitAr: params.unitAr || 'وحدة',
      isAvailable: params.isAvailable !== undefined ? Boolean(params.isAvailable) : true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    PersistentStore.saveMenuItem(newItem);

    AuditLogger.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorName: params.actorName,
      actionType: 'MENU_ITEM_UPDATED',
      targetEntity: 'store',
      targetId: newItem.id,
      descriptionAr: `إضافة صنف جديد (${newItem.nameAr}) في ${store.nameAr} بسعر ${(newItem.pricePiasters / 100).toFixed(2)} ج.م.`,
      newState: newItem,
    });

    return newItem;
  }

  /**
   * Updates an existing menu item (price in integer piasters, availability, or details) with store ownership check.
   */
  public static updateMenuItem(params: {
    storeId: string;
    itemId: string;
    actorId: string;
    actorRole: UserRole;
    actorName: string;
    actorCityScopeId?: string;
    nameAr?: string;
    descriptionAr?: string;
    pricePiasters?: number;
    isAvailable?: boolean;
  }): MenuItem {
    const store = PersistentStore.getStoreById(params.storeId);
    if (!store) {
      const err = new Error('المتجر غير موجود.');
      (err as any).code = 'STORE_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    this.assertStoreOwnership(store, params.actorId, params.actorRole, params.actorCityScopeId);

    const existingItem = PersistentStore.getMenuItemById(params.itemId);
    if (!existingItem || existingItem.storeId !== store.id) {
      const err = new Error('الصنف المطلوب غير موجود في قائمة هذا المتجر.');
      (err as any).code = 'MENU_ITEM_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    if (
      params.pricePiasters !== undefined &&
      (!Number.isInteger(params.pricePiasters) || params.pricePiasters <= 0)
    ) {
      const err = new Error('سعر المنتج بالقرش يجب أن يكون عدداً صحيحاً موجباً.');
      (err as any).code = 'INVALID_PRICE_PIASTERS';
      (err as any).statusCode = 400;
      throw err;
    }

    const updatedItem: MenuItem = {
      ...existingItem,
      nameAr: params.nameAr !== undefined ? params.nameAr.trim() : existingItem.nameAr,
      descriptionAr: params.descriptionAr !== undefined ? params.descriptionAr : existingItem.descriptionAr,
      pricePiasters: params.pricePiasters !== undefined ? params.pricePiasters : existingItem.pricePiasters,
      isAvailable: params.isAvailable !== undefined ? Boolean(params.isAvailable) : existingItem.isAvailable,
      updatedAt: new Date().toISOString(),
    };

    PersistentStore.saveMenuItem(updatedItem);

    AuditLogger.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorName: params.actorName,
      actionType: 'MENU_ITEM_UPDATED',
      targetEntity: 'store',
      targetId: updatedItem.id,
      descriptionAr: `تعديل بيانات الصنف (${updatedItem.nameAr}) في متجر ${store.nameAr}.`,
      previousState: existingItem,
      newState: updatedItem,
    });

    return updatedItem;
  }
}
