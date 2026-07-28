import ExcelJS from "exceljs";
import { Types } from "mongoose";
import { InventoryAuditEventModel } from "../entities/implements/InventoryAuditEventSchema";
import { InventoryAuditMovementModel } from "../entities/implements/InventoryAuditMovementSchema";
import { SucursalModel } from "../entities/implements/SucursalSchema";
import { UserModel } from "../entities/implements/UserSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";

type AuditDirection = "in" | "out" | "neutral";

export type InventoryAuditActor = {
  userId?: string;
  role?: string;
  name?: string;
  sellerId?: string;
};

export type InventoryAuditAuthLike = {
  id?: string;
  role?: string;
  email?: string;
  sellerId?: string;
};

export type InventoryAuditMovementInput = {
  productId?: string;
  productNameSnapshot: string;
  variantKey?: string;
  variantLabelSnapshot?: string;
  variantAttributesSnapshot?: Record<string, string>;
  sellerId?: string;
  sellerName?: string;
  branchId?: string;
  branchName?: string;
  stockBefore: number;
  stockAfter: number;
  stockDelta?: number;
  performedAt?: Date;
};

export type InventoryAuditEventInput = {
  eventType: string;
  sourceModule: string;
  sourceId?: string;
  correlationId?: string;
  actor?: InventoryAuditActor;
  sellerId?: string;
  sellerName?: string;
  branchId?: string;
  branchName?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  movements: InventoryAuditMovementInput[];
};

type ListParams = {
  from?: Date;
  to?: Date;
  sellerId?: string;
  productId?: string;
  branchId?: string;
  eventType?: string;
  actorUserId?: string;
  direction?: string;
  q?: string;
  page?: number;
  limit?: number;
};

const toObjectId = (value?: string) => {
  const raw = String(value || "").trim();
  return Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : undefined;
};

const toTrimmed = (value: unknown) => String(value ?? "").trim();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toDirection = (delta: number): AuditDirection =>
  delta > 0 ? "in" : delta < 0 ? "out" : "neutral";

const normalizeVariantMap = (value?: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(value || {}).map(([key, item]) => [String(key).trim(), String(item ?? "").trim()])
  );

const buildVariantLabel = (variants?: Record<string, string>, fallback?: string) => {
  const values = Object.values(normalizeVariantMap(variants)).filter(Boolean);
  if (values.length > 0) return values.join(" / ");
  return toTrimmed(fallback);
};

const resolveActor = async (actor?: InventoryAuditActor): Promise<InventoryAuditActor> => {
  if (!actor?.userId) {
    return {
      userId: toTrimmed(actor?.userId),
      role: toTrimmed(actor?.role),
      name: toTrimmed(actor?.name),
      sellerId: toTrimmed(actor?.sellerId),
    };
  }

  const nextActor: InventoryAuditActor = {
    userId: toTrimmed(actor.userId),
    role: toTrimmed(actor.role),
    name: toTrimmed(actor.name),
    sellerId: toTrimmed(actor.sellerId),
  };

  if (!nextActor.name && nextActor.userId && Types.ObjectId.isValid(nextActor.userId)) {
    const user = await UserModel.findById(nextActor.userId).select("email vendedor role").lean();
    if (user) {
      nextActor.name = toTrimmed((user as any)?.email) || nextActor.name;
      if (!nextActor.role) {
        nextActor.role = toTrimmed((user as any)?.role);
      }
      if (!nextActor.sellerId) {
        nextActor.sellerId = toTrimmed((user as any)?.vendedor);
      }
    }
  }

  return nextActor;
};

const resolveSellerName = async (sellerId?: string, sellerName?: string) => {
  if (toTrimmed(sellerName)) return toTrimmed(sellerName);
  const id = toTrimmed(sellerId);
  if (!Types.ObjectId.isValid(id)) return "";
  const seller = await VendedorModel.findById(id).select("marca nombre apellido").lean();
  if (!seller) return "";
  const brand = toTrimmed((seller as any)?.marca);
  const fullName = `${toTrimmed((seller as any)?.nombre)} ${toTrimmed((seller as any)?.apellido)}`.trim();
  return [brand, fullName].filter(Boolean).join(" - ");
};

const resolveBranchName = async (branchId?: string, branchName?: string) => {
  if (toTrimmed(branchName)) return toTrimmed(branchName);
  const id = toTrimmed(branchId);
  if (!Types.ObjectId.isValid(id)) return "";
  const branch = await SucursalModel.findById(id).select("nombre").lean();
  return toTrimmed((branch as any)?.nombre);
};

const buildBaseMatch = (params: ListParams) => {
  const match: any = {};
  if (params.from || params.to) {
    match.created_at = {};
    if (params.from) match.created_at.$gte = params.from;
    if (params.to) match.created_at.$lte = params.to;
  }
  const sellerId = toObjectId(params.sellerId);
  if (sellerId) match.seller_id = sellerId;
  const productId = toObjectId(params.productId);
  if (productId) match.product_id = productId;
  const branchId = toObjectId(params.branchId);
  if (branchId) match.branch_id = branchId;
  if (toTrimmed(params.eventType) && params.eventType !== "all") {
    match.event_type = toTrimmed(params.eventType);
  }
  if (toTrimmed(params.direction) && params.direction !== "all") {
    match.movement_direction = toTrimmed(params.direction);
  }
  return match;
};

const buildLookupStages = () => [
  {
    $lookup: {
      from: "InventoryAuditEvent",
      localField: "event_id",
      foreignField: "_id",
      as: "event",
    },
  },
  {
    $unwind: {
      path: "$event",
      preserveNullAndEmptyArrays: true,
    },
  },
];

const buildSearchMatch = (params: ListParams) => {
  const q = toTrimmed(params.q);
  const searchOr: any[] = [];
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    searchOr.push(
      { product_name_snapshot: regex },
      { variant_label_snapshot: regex },
      { seller_name: regex },
      { branch_name: regex },
      { "event.actor_name": regex },
      { source_id: regex },
      { "event.source_id": regex }
    );
  }

  const actorUserId = toObjectId(params.actorUserId);
  if (actorUserId) {
    searchOr.push({ "event.actor_user_id": actorUserId });
  }

  return searchOr.length > 0 ? { $or: searchOr } : null;
};

const buildSummary = async (params: ListParams) => {
  const match = buildBaseMatch(params);
  const searchMatch = buildSearchMatch(params);
  const pipeline: any[] = [{ $match: match }, ...buildLookupStages()];
  if (searchMatch) pipeline.push({ $match: searchMatch });

  const [totals, byType, byActor, topProducts] = await Promise.all([
    InventoryAuditMovementModel.aggregate([
      ...pipeline,
      {
        $group: {
          _id: null,
          movementCount: { $sum: 1 },
          totalOut: {
            $sum: {
              $cond: [{ $lt: ["$stock_delta", 0] }, { $abs: "$stock_delta" }, 0],
            },
          },
          totalIn: {
            $sum: {
              $cond: [{ $gt: ["$stock_delta", 0] }, "$stock_delta", 0],
            },
          },
          uniqueProducts: { $addToSet: "$product_id" },
        },
      },
    ]),
    InventoryAuditMovementModel.aggregate([
      ...pipeline,
      {
        $group: {
          _id: "$event_type",
          count: { $sum: 1 },
          totalDelta: { $sum: "$stock_delta" },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 8 },
    ]),
    InventoryAuditMovementModel.aggregate([
      ...pipeline,
      {
        $group: {
          _id: "$event.actor_name",
          count: { $sum: 1 },
          outUnits: {
            $sum: {
              $cond: [{ $lt: ["$stock_delta", 0] }, { $abs: "$stock_delta" }, 0],
            },
          },
        },
      },
      { $sort: { count: -1, outUnits: -1 } },
      { $limit: 8 },
    ]),
    InventoryAuditMovementModel.aggregate([
      ...pipeline,
      {
        $group: {
          _id: {
            productId: "$product_id",
            productName: "$product_name_snapshot",
            variantLabel: "$variant_label_snapshot",
          },
          count: { $sum: 1 },
          totalAdjustment: { $sum: { $abs: "$stock_delta" } },
        },
      },
      { $sort: { totalAdjustment: -1, count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const totalsRow = totals[0] || {};

  return {
    movementCount: Number(totalsRow?.movementCount || 0),
    totalOut: Number(totalsRow?.totalOut || 0),
    totalIn: Number(totalsRow?.totalIn || 0),
    uniqueProducts: Array.isArray(totalsRow?.uniqueProducts) ? totalsRow.uniqueProducts.filter(Boolean).length : 0,
    byType: byType.map((row: any) => ({
      eventType: toTrimmed(row?._id) || "sin_tipo",
      count: Number(row?.count || 0),
      totalDelta: Number(row?.totalDelta || 0),
    })),
    byActor: byActor.map((row: any) => ({
      actorName: toTrimmed(row?._id) || "Sin actor",
      count: Number(row?.count || 0),
      outUnits: Number(row?.outUnits || 0),
    })),
    topProducts: topProducts.map((row: any) => ({
      productId: toTrimmed(row?._id?.productId),
      productName: toTrimmed(row?._id?.productName),
      variantLabel: toTrimmed(row?._id?.variantLabel),
      count: Number(row?.count || 0),
      totalAdjustment: Number(row?.totalAdjustment || 0),
    })),
  };
};

const listMovements = async (params: ListParams) => {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(200, Math.max(1, Number(params.limit || 20)));
  const skip = (page - 1) * limit;
  const match = buildBaseMatch(params);
  const searchMatch = buildSearchMatch(params);

  const pipeline: any[] = [{ $match: match }, ...buildLookupStages()];
  if (searchMatch) pipeline.push({ $match: searchMatch });
  pipeline.push(
    { $sort: { created_at: -1, _id: -1 } },
    {
      $facet: {
        rows: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              event_id: 1,
              event_type: 1,
              source_module: 1,
              source_id: 1,
              correlation_id: 1,
              product_id: 1,
              product_name_snapshot: 1,
              variant_key: 1,
              variant_label_snapshot: 1,
              variant_attributes_snapshot: 1,
              seller_id: 1,
              seller_name: 1,
              branch_id: 1,
              branch_name: 1,
              stock_before: 1,
              stock_delta: 1,
              stock_after: 1,
              movement_direction: 1,
              performed_at: 1,
              created_at: 1,
              event_actor_name: "$event.actor_name",
              event_actor_role: "$event.actor_role",
              event_comment: "$event.comment",
              event_metadata: "$event.metadata",
              event_source_id: "$event.source_id",
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    }
  );

  const [result, summary] = await Promise.all([
    InventoryAuditMovementModel.aggregate(pipeline),
    buildSummary(params),
  ]);

  const rowBlock = result[0] || { rows: [], total: [] };
  const total = Number(rowBlock?.total?.[0]?.count || 0);

  return {
    rows: rowBlock.rows || [],
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary,
  };
};

const getEventDetail = async (eventId: string) => {
  if (!Types.ObjectId.isValid(eventId)) {
    throw new Error("Evento de auditoria invalido");
  }

  const event = await InventoryAuditEventModel.findById(eventId).lean();
  if (!event) {
    throw new Error("Evento de auditoria no encontrado");
  }

  const movements = await InventoryAuditMovementModel.find({ event_id: event._id })
    .sort({ created_at: 1, _id: 1 })
    .lean();

  return {
    event,
    movements,
  };
};

const exportMovementsReport = async (params: ListParams) => {
  const fullResult = await listMovements({ ...params, page: 1, limit: 5000 });
  const workbook = new ExcelJS.Workbook();

  const movementSheet = workbook.addWorksheet("Movimientos");
  movementSheet.columns = [
    { header: "Fecha", key: "fecha", width: 22 },
    { header: "Tipo", key: "tipo", width: 30 },
    { header: "Producto", key: "producto", width: 34 },
    { header: "Variante", key: "variante", width: 30 },
    { header: "Vendedor", key: "vendedor", width: 28 },
    { header: "Sucursal", key: "sucursal", width: 24 },
    { header: "Antes", key: "antes", width: 12 },
    { header: "Delta", key: "delta", width: 12 },
    { header: "Despues", key: "despues", width: 12 },
    { header: "Usuario", key: "usuario", width: 28 },
    { header: "Rol", key: "rol", width: 16 },
    { header: "Modulo", key: "modulo", width: 24 },
    { header: "Referencia", key: "referencia", width: 28 },
  ];
  fullResult.rows.forEach((row: any) => {
    movementSheet.addRow({
      fecha: row?.created_at ? new Date(row.created_at).toISOString() : "",
      tipo: row?.event_type || "",
      producto: row?.product_name_snapshot || "",
      variante: row?.variant_label_snapshot || "",
      vendedor: row?.seller_name || "",
      sucursal: row?.branch_name || "",
      antes: Number(row?.stock_before || 0),
      delta: Number(row?.stock_delta || 0),
      despues: Number(row?.stock_after || 0),
      usuario: row?.event_actor_name || "",
      rol: row?.event_actor_role || "",
      modulo: row?.source_module || "",
      referencia: row?.source_id || row?.event_source_id || "",
    });
  });

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.columns = [
    { header: "Metrica", key: "metrica", width: 28 },
    { header: "Valor", key: "valor", width: 18 },
  ];
  summarySheet.addRows([
    { metrica: "Movimientos", valor: fullResult.summary.movementCount },
    { metrica: "Ingresos de stock", valor: fullResult.summary.totalIn },
    { metrica: "Salidas de stock", valor: fullResult.summary.totalOut },
    { metrica: "Productos unicos", valor: fullResult.summary.uniqueProducts },
  ]);

  const typeSheet = workbook.addWorksheet("Tipos");
  typeSheet.columns = [
    { header: "Tipo", key: "tipo", width: 30 },
    { header: "Movimientos", key: "movimientos", width: 14 },
    { header: "Delta total", key: "delta", width: 14 },
  ];
  fullResult.summary.byType.forEach((row) => typeSheet.addRow({
    tipo: row.eventType,
    movimientos: row.count,
    delta: row.totalDelta,
  }));

  const actorSheet = workbook.addWorksheet("Usuarios");
  actorSheet.columns = [
    { header: "Usuario", key: "usuario", width: 28 },
    { header: "Movimientos", key: "movimientos", width: 14 },
    { header: "Salidas", key: "salidas", width: 14 },
  ];
  fullResult.summary.byActor.forEach((row) => actorSheet.addRow({
    usuario: row.actorName,
    movimientos: row.count,
    salidas: row.outUnits,
  }));

  [movementSheet, summarySheet, typeSheet, actorSheet].forEach((sheet) => {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer as ArrayBuffer),
    filename: `inventory_audit_${Date.now()}.xlsx`,
  };
};

const recordEvent = async (input: InventoryAuditEventInput) => {
  const movements = Array.isArray(input.movements) ? input.movements : [];
  if (movements.length === 0) {
    throw new Error("La auditoria requiere al menos un movimiento");
  }

  const actor = await resolveActor(input.actor);
  const sellerName = await resolveSellerName(input.sellerId || actor.sellerId, input.sellerName);
  const branchName = await resolveBranchName(input.branchId, input.branchName);
  const createdAt = new Date();

  const event = await InventoryAuditEventModel.create({
    event_type: toTrimmed(input.eventType),
    source_module: toTrimmed(input.sourceModule),
    source_id: toTrimmed(input.sourceId),
    correlation_id: toTrimmed(input.correlationId),
    actor_user_id: toObjectId(actor.userId),
    actor_role: toTrimmed(actor.role),
    actor_name: toTrimmed(actor.name),
    seller_id: toObjectId(input.sellerId || actor.sellerId),
    seller_name: sellerName,
    branch_id: toObjectId(input.branchId),
    branch_name: branchName,
    comment: toTrimmed(input.comment),
    metadata: input.metadata || {},
    audit_status: "recorded",
    movement_count: movements.length,
    created_at: createdAt,
  });

  const movementDocs = await Promise.all(
    movements.map(async (movement) => {
      const stockBefore = Number(movement.stockBefore || 0);
      const stockAfter = Number(movement.stockAfter || 0);
      const stockDelta =
        movement.stockDelta === undefined ? stockAfter - stockBefore : Number(movement.stockDelta || 0);
      const movementSellerName = await resolveSellerName(
        movement.sellerId || input.sellerId || actor.sellerId,
        movement.sellerName || sellerName
      );
      const movementBranchName = await resolveBranchName(
        movement.branchId || input.branchId,
        movement.branchName || branchName
      );
      return {
        event_id: event._id,
        event_type: toTrimmed(input.eventType),
        source_module: toTrimmed(input.sourceModule),
        source_id: toTrimmed(input.sourceId),
        correlation_id: toTrimmed(input.correlationId),
        product_id: toObjectId(movement.productId),
        product_name_snapshot: toTrimmed(movement.productNameSnapshot) || "Producto",
        variant_key: toTrimmed(movement.variantKey),
        variant_label_snapshot:
          buildVariantLabel(movement.variantAttributesSnapshot, movement.variantLabelSnapshot) || "",
        variant_attributes_snapshot: normalizeVariantMap(movement.variantAttributesSnapshot),
        seller_id: toObjectId(movement.sellerId || input.sellerId || actor.sellerId),
        seller_name: movementSellerName,
        branch_id: toObjectId(movement.branchId || input.branchId),
        branch_name: movementBranchName,
        stock_before: stockBefore,
        stock_delta: stockDelta,
        stock_after: stockAfter,
        movement_direction: toDirection(stockDelta),
        performed_at: movement.performedAt || createdAt,
        created_at: createdAt,
      };
    })
  );

  await InventoryAuditMovementModel.insertMany(movementDocs);

  return {
    eventId: String(event._id),
    movementCount: movementDocs.length,
  };
};

const recordEventSafe = async (input: InventoryAuditEventInput) => {
  try {
    return await recordEvent(input);
  } catch (error: any) {
    console.error("[inventory-audit] record failed", {
      at: new Date().toISOString(),
      eventType: input?.eventType,
      sourceModule: input?.sourceModule,
      sourceId: input?.sourceId,
      actor: input?.actor,
      message: error?.message || String(error),
      stack: error?.stack || "",
      payload: {
        movementCount: Array.isArray(input?.movements) ? input.movements.length : 0,
        sellerId: input?.sellerId,
        branchId: input?.branchId,
      },
    });
    return null;
  }
};

const buildActorFromAuth = async (auth?: InventoryAuditAuthLike): Promise<InventoryAuditActor> => {
  const userId = toTrimmed(auth?.id);
  const role = toTrimmed(auth?.role);
  const name = toTrimmed(auth?.email);
  const sellerId = toTrimmed(auth?.sellerId);
  return resolveActor({ userId, role, name, sellerId });
};

export const InventoryAuditService = {
  buildActorFromAuth,
  recordEvent,
  recordEventSafe,
  listMovements,
  getEventDetail,
  exportMovementsReport,
};
