import { Types } from "mongoose";
import { ActionTraceModel, ActionTraceStatus } from "../entities/implements/ActionTraceSchema";
import { classifyActionFailure, getErrorMessage, safeString } from "../helpers/actionTrace";

type TraceActor = {
  userId?: string;
  role?: string;
  name?: string;
  sellerId?: string;
};

type TraceInput = {
  actionType: string;
  sourceModule: string;
  sourceId?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  actor?: TraceActor;
  sellerId?: string;
  sellerName?: string;
  branchId?: string;
  branchName?: string;
  status?: ActionTraceStatus;
  summary: string;
  failureMessage?: string;
  failureCategory?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

type TraceListParams = {
  page?: number;
  limit?: number;
  status?: string;
  actionType?: string;
  actionTypes?: string[];
  sourceModule?: string;
  entityType?: string;
  actorUserId?: string;
  actorRole?: string;
  q?: string;
  from?: string;
  to?: string;
  order?: "asc" | "desc";
};

type TraceActorOption = {
  actorUserId: string;
  actorName: string;
  actorRole: string;
};

const toObjectId = (value?: string) => {
  const raw = safeString(value);
  return Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : undefined;
};

const buildTraceDto = (doc: any) => ({
  _id: String(doc?._id || ""),
  actionType: safeString(doc?.action_type),
  sourceModule: safeString(doc?.source_module),
  sourceId: safeString(doc?.source_id),
  entityType: safeString(doc?.entity_type),
  entityId: doc?.entity_id ? String(doc.entity_id) : null,
  entityLabel: safeString(doc?.entity_label),
  actorUserId: doc?.actor_user_id ? String(doc.actor_user_id) : null,
  actorRole: safeString(doc?.actor_role),
  actorName: safeString(doc?.actor_name),
  sellerId: doc?.seller_id ? String(doc.seller_id) : null,
  sellerName: safeString(doc?.seller_name),
  branchId: doc?.branch_id ? String(doc.branch_id) : null,
  branchName: safeString(doc?.branch_name),
  status: doc?.status === "failed" ? "failed" : "success",
  failureCategory: safeString(doc?.failure_category),
  failureMessage: safeString(doc?.failure_message),
  summary: safeString(doc?.summary),
  metadata: doc?.metadata || {},
  createdAt: doc?.created_at || null,
});

const recordActionTrace = async (input: TraceInput) => {
  const summary = safeString(input.summary);
  if (!summary) {
    throw new Error("La trazabilidad requiere un resumen");
  }

  const actorUserId = safeString(input.actor?.userId);
  const actorRole = safeString(input.actor?.role);
  const actorName = safeString(input.actor?.name);
  const sellerId = safeString(input.sellerId || input.actor?.sellerId);
  const branchId = safeString(input.branchId);
  const entityId = safeString(input.entityId);

  return await ActionTraceModel.create({
    action_type: safeString(input.actionType),
    source_module: safeString(input.sourceModule),
    source_id: safeString(input.sourceId),
    entity_type: safeString(input.entityType),
    entity_id: entityId && Types.ObjectId.isValid(entityId) ? new Types.ObjectId(entityId) : undefined,
    entity_label: safeString(input.entityLabel),
    actor_user_id: actorUserId && Types.ObjectId.isValid(actorUserId) ? new Types.ObjectId(actorUserId) : undefined,
    actor_role: actorRole,
    actor_name: actorName,
    seller_id: sellerId && Types.ObjectId.isValid(sellerId) ? new Types.ObjectId(sellerId) : undefined,
    seller_name: safeString(input.sellerName),
    branch_id: branchId && Types.ObjectId.isValid(branchId) ? new Types.ObjectId(branchId) : undefined,
    branch_name: safeString(input.branchName),
    status: input.status === "failed" ? "failed" : "success",
    failure_category: safeString(input.failureCategory),
    failure_message: safeString(input.failureMessage),
    summary,
    metadata: input.metadata || {},
    created_at: input.createdAt || new Date(),
  });
};

const recordActionTraceSafe = async (input: TraceInput) => {
  try {
    return await recordActionTrace(input);
  } catch (error) {
    console.error("[action-trace] record failed", {
      actionType: input?.actionType,
      sourceModule: input?.sourceModule,
      sourceId: input?.sourceId,
      message: getErrorMessage(error),
    });
    return null;
  }
};

const listActionTraces = async (params: TraceListParams = {}) => {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(100, Math.max(5, Number(params.limit || 20)));
  const skip = (page - 1) * limit;
  const query: any = {};

  if (params.status && params.status !== "all") query.status = params.status;
  const actionTypes = Array.isArray(params.actionTypes)
    ? params.actionTypes.map((item) => safeString(item)).filter(Boolean)
    : [];

  if (actionTypes.length > 0) {
    query.action_type = { $in: actionTypes };
  } else if (params.actionType) {
    query.action_type = params.actionType;
  }
  if (params.sourceModule) query.source_module = params.sourceModule;
  if (params.entityType) query.entity_type = params.entityType;

  const actorUserId = toObjectId(params.actorUserId);
  if (actorUserId) query.actor_user_id = actorUserId;
  if (params.actorRole) query.actor_role = params.actorRole;

  const from = params.from ? new Date(params.from) : null;
  const to = params.to ? new Date(params.to) : null;
  if (from || to) {
    query.created_at = {};
    if (from && !Number.isNaN(from.getTime())) query.created_at.$gte = from;
    if (to && !Number.isNaN(to.getTime())) query.created_at.$lte = to;
  }

  const q = safeString(params.q);
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [
      { action_type: regex },
      { source_module: regex },
      { entity_label: regex },
      { actor_name: regex },
      { summary: regex },
      { failure_message: regex },
      { source_id: regex },
    ];
  }

  const [rows, total, statusSummary] = await Promise.all([
    ActionTraceModel.find(query).sort({ created_at: params.order === "asc" ? 1 : -1, _id: params.order === "asc" ? 1 : -1 }).skip(skip).limit(limit).lean(),
    ActionTraceModel.countDocuments(query),
    ActionTraceModel.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const summary = {
    success: 0,
    failed: 0,
  };
  statusSummary.forEach((row: any) => {
    if (row?._id === "failed") summary.failed = Number(row?.count || 0);
    if (row?._id === "success") summary.success = Number(row?.count || 0);
  });

  return {
    rows: rows.map(buildTraceDto),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary,
  };
};

const listActionTraceActors = async (): Promise<TraceActorOption[]> => {
  const rows = await ActionTraceModel.aggregate([
    {
      $match: {
        actor_user_id: { $exists: true, $ne: null },
      },
    },
    {
      $sort: {
        created_at: -1,
        _id: -1,
      },
    },
    {
      $group: {
        _id: "$actor_user_id",
        actorName: { $first: "$actor_name" },
        actorRole: { $first: "$actor_role" },
      },
    },
    {
      $project: {
        _id: 0,
        actorUserId: { $toString: "$_id" },
        actorName: "$actorName",
        actorRole: "$actorRole",
      },
    },
    {
      $sort: {
        actorName: 1,
        actorUserId: 1,
      },
    },
  ]);

  return rows.map((row: any) => ({
    actorUserId: safeString(row?.actorUserId),
    actorName: safeString(row?.actorName),
    actorRole: safeString(row?.actorRole),
  })).filter((row) => row.actorUserId);
};

const recordFailureFromError = async (input: Omit<TraceInput, "status"> & { error: unknown }) =>
  await recordActionTraceSafe({
    ...input,
    status: "failed",
    failureCategory: input.failureCategory || classifyActionFailure(input.error),
    failureMessage: input.failureMessage || getErrorMessage(input.error, "No se pudo completar la accion"),
  });

export const ActionTraceService = {
  recordActionTraceSafe,
  recordFailureFromError,
  listActionTraces,
  listActionTraceActors,
};
