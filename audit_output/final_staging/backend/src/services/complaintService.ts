/**
 * Mashwar — Customer Support & Complaints Workflow Service
 * Handles complaint creation, support agent assignment, status transitions, and resolution history.
 */

import {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  ComplaintEvent,
} from '../types/index.js';
import { PersistentStore } from '../store/persistentStore.js';
import { AuditLogger } from '../security/auditLogger.js';
import { UserRole } from '../security/rbac.js';

export class ComplaintService {
  /**
   * Creates a new complaint/support ticket linked to the authenticated reporter.
   */
  public static createComplaint(params: {
    reporterUserId: string;
    reporterName: string;
    reporterPhone: string;
    reporterRole: 'customer' | 'captain' | 'merchant';
    orderId?: string;
    storeId?: string;
    category: ComplaintCategory;
    priority?: ComplaintPriority;
    subjectAr: string;
    descriptionAr: string;
  }): Complaint {
    if (!params.subjectAr || params.subjectAr.trim().length < 4) {
      const err = new Error('عنوان الشكوى مطلوب ويجب أن يوضح المشكلة.');
      (err as any).code = 'INVALID_COMPLAINT_SUBJECT';
      (err as any).statusCode = 400;
      throw err;
    }

    if (!params.descriptionAr || params.descriptionAr.trim().length < 5) {
      const err = new Error('تفاصيل الشكوى مطلوبة لمراجعة فريق الدعم.');
      (err as any).code = 'INVALID_COMPLAINT_DESCRIPTION';
      (err as any).statusCode = 400;
      throw err;
    }

    const nowIso = new Date().toISOString();
    const id = `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ticketNumber = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;

    const initialEvent: ComplaintEvent = {
      id: `cevt_${Date.now()}_1`,
      complaintId: id,
      actorId: params.reporterUserId,
      actorRole: params.reporterRole,
      actorName: params.reporterName,
      action: 'CREATED',
      toStatus: 'open',
      messageAr: `تم تسجيل الشكوى بواسطة ${params.reporterName}.`,
      createdAt: nowIso,
    };

    const complaint: Complaint = {
      id,
      ticketNumber,
      orderId: params.orderId,
      storeId: params.storeId,
      reporterUserId: params.reporterUserId,
      reporterName: params.reporterName,
      reporterPhone: params.reporterPhone,
      reporterRole: params.reporterRole,
      category: params.category,
      priority: params.priority || 'medium',
      status: 'open',
      subjectAr: params.subjectAr.trim(),
      descriptionAr: params.descriptionAr.trim(),
      events: [initialEvent],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    PersistentStore.saveComplaint(complaint);

    AuditLogger.record({
      actorId: params.reporterUserId,
      actorRole: params.reporterRole,
      actorName: params.reporterName,
      actionType: 'COMPLAINT_CREATED',
      targetEntity: 'complaint',
      targetId: complaint.id,
      descriptionAr: `تسجيل شكوى جديدة برقم ${complaint.ticketNumber}: ${complaint.subjectAr}`,
      newState: { status: complaint.status, priority: complaint.priority, orderId: complaint.orderId },
    });

    return complaint;
  }

  /**
   * Lists complaints visible to the authenticated user (own complaints for customer/captain/merchant,
   * or all complaints for support_agent/operations_dispatcher/owner).
   */
  public static listComplaints(params: {
    actorId: string;
    actorRole: UserRole;
    statusFilter?: ComplaintStatus;
  }): Complaint[] {
    let list = PersistentStore.getAllComplaints();

    const isStaff =
      params.actorRole === 'owner' ||
      params.actorRole === 'operations_dispatcher' ||
      params.actorRole === 'support_agent';

    if (!isStaff) {
      list = list.filter((c) => c.reporterUserId === params.actorId);
    }

    if (params.statusFilter) {
      list = list.filter((c) => c.status === params.statusFilter);
    }

    return list;
  }

  /**
   * Assigns a complaint to a support agent or operations dispatcher.
   */
  public static assignComplaint(params: {
    complaintId: string;
    actorId: string;
    actorRole: UserRole;
    actorName: string;
    assignedAgentId: string;
    assignedAgentName: string;
  }): Complaint {
    const complaint = PersistentStore.getComplaintById(params.complaintId);
    if (!complaint) {
      const err = new Error('تذكرة الشكوى غير موجودة.');
      (err as any).code = 'COMPLAINT_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    const nowIso = new Date().toISOString();
    const prevStatus = complaint.status;
    const nextStatus: ComplaintStatus = complaint.status === 'open' ? 'under_review' : complaint.status;

    const event: ComplaintEvent = {
      id: `cevt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      complaintId: complaint.id,
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorName: params.actorName,
      action: 'ASSIGNED',
      fromStatus: prevStatus,
      toStatus: nextStatus,
      messageAr: `تم إسناد التذكرة إلى موظف الدعم: ${params.assignedAgentName}`,
      createdAt: nowIso,
    };

    const updated: Complaint = {
      ...complaint,
      status: nextStatus,
      assignedAgentId: params.assignedAgentId,
      assignedAgentName: params.assignedAgentName,
      events: [...complaint.events, event],
      updatedAt: nowIso,
    };

    PersistentStore.saveComplaint(updated);

    AuditLogger.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorName: params.actorName,
      actionType: 'COMPLAINT_ASSIGNED',
      targetEntity: 'complaint',
      targetId: complaint.id,
      descriptionAr: `إسناد الشكوى ${complaint.ticketNumber} إلى ${params.assignedAgentName}.`,
      previousState: { status: prevStatus, assignedAgentId: complaint.assignedAgentId },
      newState: { status: nextStatus, assignedAgentId: params.assignedAgentId },
    });

    return updated;
  }

  /**
   * Resolves, rejects, or escalates a complaint with resolution notes and optional refund in integer piasters.
   */
  public static updateComplaintResolution(params: {
    complaintId: string;
    actorId: string;
    actorRole: UserRole;
    actorName: string;
    targetStatus: ComplaintStatus;
    resolutionNotesAr: string;
    refundAmountPiasters?: number;
  }): Complaint {
    const complaint = PersistentStore.getComplaintById(params.complaintId);
    if (!complaint) {
      const err = new Error('تذكرة الشكوى غير موجودة.');
      (err as any).code = 'COMPLAINT_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    if (!params.resolutionNotesAr || params.resolutionNotesAr.trim().length < 3) {
      const err = new Error('يجب إدخال ملاحظات المعالجة أو قرار الدعم الفني.');
      (err as any).code = 'MISSING_RESOLUTION_NOTES';
      (err as any).statusCode = 400;
      throw err;
    }

    if (
      params.refundAmountPiasters !== undefined &&
      (!Number.isInteger(params.refundAmountPiasters) || params.refundAmountPiasters < 0)
    ) {
      const err = new Error('قيمة التعويض بالقرش يجب أن تكون عدداً صحيحاً غير سالب.');
      (err as any).code = 'INVALID_REFUND_PIASTERS';
      (err as any).statusCode = 400;
      throw err;
    }

    const nowIso = new Date().toISOString();
    const prevStatus = complaint.status;

    const event: ComplaintEvent = {
      id: `cevt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      complaintId: complaint.id,
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorName: params.actorName,
      action: params.targetStatus === 'resolved' ? 'RESOLVED' : 'STATUS_CHANGED',
      fromStatus: prevStatus,
      toStatus: params.targetStatus,
      messageAr: params.resolutionNotesAr.trim(),
      createdAt: nowIso,
    };

    const updated: Complaint = {
      ...complaint,
      status: params.targetStatus,
      resolutionNotesAr: params.resolutionNotesAr.trim(),
      refundAmountPiasters:
        params.refundAmountPiasters !== undefined
          ? params.refundAmountPiasters
          : complaint.refundAmountPiasters,
      events: [...complaint.events, event],
      updatedAt: nowIso,
      resolvedAt: params.targetStatus === 'resolved' ? nowIso : complaint.resolvedAt,
    };

    PersistentStore.saveComplaint(updated);

    AuditLogger.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorName: params.actorName,
      actionType: 'COMPLAINT_RESOLVED',
      targetEntity: 'complaint',
      targetId: complaint.id,
      descriptionAr: `تحديث حالة الشكوى ${complaint.ticketNumber} إلى (${params.targetStatus}): ${params.resolutionNotesAr.trim()}`,
      previousState: { status: prevStatus },
      newState: { status: params.targetStatus, refundAmountPiasters: updated.refundAmountPiasters },
    });

    return updated;
  }
}
