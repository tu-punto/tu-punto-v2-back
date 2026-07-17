import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";
import moment from "moment-timezone";
import { Types } from "mongoose";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { ReportsRepository } from "../repositories/reports.repository";

const TZ = "America/La_Paz";
const READY_FOR_PICKUP_STATUS = "LISTO PARA RECOGER";
const SEND_TO_BRANCH_STATUS = "PARA ENVIAR A OTRA SUCURSAL";
const WAITING_STATUSES = new Set(["En Espera", READY_FOR_PICKUP_STATUS]);

type OrderAuditParams = {
  from?: Date;
  to?: Date;
  branchId?: string;
  currentBranchId?: string;
  suspiciousOnly?: boolean;
};

type BranchRef = {
  id: string;
  name: string;
};

type DetailRow = {
  source: "shipping" | "external";
  record_id: string;
  pedido_ref_id: string;
  fecha_base: string;
  numero_guia: string;
  buyer_tracking_code: string;
  cliente: string;
  vendedor: string;
  telefono_cliente: string;
  carnet_cliente: string;
  canal: string;
  service_origin: string;
  origen_pedido: string;
  estado_pedido: string;
  estado_publico_estimado: string;
  delivered: string;
  tipo_destino: string;
  lugar_origen: string;
  lugar_entrega: string;
  origen_sucursal_id: string;
  origen_sucursal_nombre: string;
  destino_sucursal_id: string;
  destino_sucursal_nombre: string;
  sucursal_actual_relacion: string;
  es_inter_sucursal: string;
  parece_venta_no_pedido: string;
  entra_como_pedido_canonico: string;
  entra_en_todos: string;
  entra_en_listo_para_recoger: string;
  entra_en_para_enviar: string;
  entra_en_en_camino: string;
  entra_en_entregado: string;
  motivo_inclusion: string;
  motivo_exclusion: string;
  alertas: string;
};

const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeTextLower = (value: unknown) => normalizeText(value).toLowerCase();
const normalizeStatus = (value: unknown) => normalizeText(value);
const booleanLabel = (value: boolean) => (value ? "si" : "no");

const countBy = <T extends string>(items: T[]) =>
  items.reduce<Record<string, number>>((acc, item) => {
    const key = item || "(vacio)";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const formatDateForCell = (value: unknown) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return moment(date).tz(TZ).format("YYYY-MM-DD HH:mm:ss");
};

const getBranchId = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return String(value?._id || value?.id_sucursal || value?.id || "").trim();
  }
  return "";
};

const getBranchName = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value?.nombre || "").trim();
  }
  return "";
};

const buildBranchLookup = (branches: any[]) => {
  const byId = new Map<string, BranchRef>();
  const byNormalizedName = new Map<string, BranchRef>();

  for (const branch of branches || []) {
    const id = getBranchId(branch);
    const name = getBranchName(branch);
    if (!id && !name) continue;
    const ref = { id, name };
    if (id) byId.set(id, ref);
    if (name) byNormalizedName.set(normalizeTextLower(name), ref);
  }

  return { byId, byNormalizedName };
};

const resolveBranchFromAny = (
  value: any,
  branchLookup: ReturnType<typeof buildBranchLookup>
): BranchRef | null => {
  const id = getBranchId(value);
  if (id && branchLookup.byId.has(id)) return branchLookup.byId.get(id)!;

  const name = getBranchName(value);
  if (name && branchLookup.byNormalizedName.has(normalizeTextLower(name))) {
    return branchLookup.byNormalizedName.get(normalizeTextLower(name))!;
  }

  if (id || name) {
    return {
      id,
      name,
    };
  }

  return null;
};

const inferInternalBranches = (row: any, branchLookup: ReturnType<typeof buildBranchLookup>) => {
  const origin =
    resolveBranchFromAny(row?.lugar_origen, branchLookup) ||
    (row?.tipo_destino !== "sucursal" ? resolveBranchFromAny(row?.sucursal, branchLookup) : null);

  let destination: BranchRef | null = null;

  if (row?.tipo_destino === "sucursal") {
    destination =
      resolveBranchFromAny(row?.sucursal, branchLookup) ||
      resolveBranchFromAny(row?.lugar_entrega, branchLookup);
  } else {
    destination = resolveBranchFromAny(row?.lugar_entrega, branchLookup);
  }

  return { origin, destination };
};

const inferExternalBranches = (row: any, branchLookup: ReturnType<typeof buildBranchLookup>) => {
  const origin =
    resolveBranchFromAny(row?.origen_sucursal, branchLookup) ||
    resolveBranchFromAny(row?.sucursal, branchLookup);

  const destination =
    resolveBranchFromAny(row?.destino_sucursal, branchLookup) ||
    resolveBranchFromAny(row?.lugar_entrega, branchLookup);

  return { origin, destination };
};

const buildSellerLabel = (row: any) => {
  if (row?.is_external) return normalizeText(row?.vendedor);

  const sellerNames = new Set<string>();
  for (const sale of row?.venta || []) {
    const fullName = [normalizeText(sale?.vendedor?.nombre), normalizeText(sale?.vendedor?.apellido)]
      .filter(Boolean)
      .join(" ");
    if (fullName) sellerNames.add(fullName);
  }
  return Array.from(sellerNames).join(" | ");
};

const estimatePublicStatus = (status: string, isSaleLike: boolean) => {
  if (isSaleLike) return "NO_PEDIDO";
  if (status === "Entregado") return "Entregado";
  if (status === "En camino") return "En camino";
  if (status === SEND_TO_BRANCH_STATUS) return SEND_TO_BRANCH_STATUS;
  return "Listo para recoger";
};

const buildShippingMatch = (params: OrderAuditParams) => {
  const filter: any = {};
  if (params.from || params.to) {
    filter.hora_entrega_acordada = {};
    if (params.from) filter.hora_entrega_acordada.$gte = params.from;
    if (params.to) filter.hora_entrega_acordada.$lte = params.to;
  }
  if (params.branchId && Types.ObjectId.isValid(params.branchId)) {
    const branchObjectId = new Types.ObjectId(params.branchId);
    filter.$or = [
      { lugar_origen: branchObjectId },
      { sucursal: branchObjectId },
    ];
  }
  return filter;
};

const buildExternalMatch = (params: OrderAuditParams) => {
  const filter: any = {
    $or: [
      { service_origin: { $exists: false } },
      { service_origin: "external" },
    ],
  };
  if (params.from || params.to) {
    filter.fecha_pedido = {};
    if (params.from) filter.fecha_pedido.$gte = params.from;
    if (params.to) filter.fecha_pedido.$lte = params.to;
  }
  if (params.branchId && Types.ObjectId.isValid(params.branchId)) {
    const branchObjectId = new Types.ObjectId(params.branchId);
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { origen_sucursal: branchObjectId },
          { destino_sucursal: branchObjectId },
          { sucursal: branchObjectId },
        ],
      },
    ];
  }
  return filter;
};

const rowMatchesCurrentBranch = (currentBranchId: string, originId: string, destinationId: string) => {
  if (!currentBranchId) return false;
  return currentBranchId === originId || currentBranchId === destinationId;
};

const isInterbranch = (originId: string, destinationId: string) =>
  Boolean(originId && destinationId && originId !== destinationId);

const buildDetailRows = (
  shippingRows: any[],
  externalRows: any[],
  branchLookup: ReturnType<typeof buildBranchLookup>,
  params: OrderAuditParams
) => {
  const currentBranchId = normalizeText(params.currentBranchId || params.branchId);
  const details: DetailRow[] = [];

  const pushRow = (payload: DetailRow) => {
    if (params.suspiciousOnly && !payload.alertas) return;
    details.push(payload);
  };

  for (const row of shippingRows) {
    const status = normalizeStatus(row?.estado_pedido);
    const { origin, destination } = inferInternalBranches(row, branchLookup);
    const originId = origin?.id || "";
    const destinationId = destination?.id || "";
    const originName = origin?.name || "";
    const destinationName = destination?.name || "";
    const relatedToCurrent = rowMatchesCurrentBranch(currentBranchId, originId, destinationId);
    const interbranch = isInterbranch(originId, destinationId);
    const looksLikeSale =
      normalizeTextLower(status) === "interno" ||
      normalizeTextLower(row?.lugar_entrega) === "no aplica";

    const pendingSend = status === SEND_TO_BRANCH_STATUS && interbranch;
    const canonicalOrder = !looksLikeSale;
    const entersTodos = canonicalOrder && status !== "Entregado" && (!currentBranchId || relatedToCurrent);
    const entersListo =
      canonicalOrder &&
      !pendingSend &&
      status !== "En camino" &&
      status !== "Entregado" &&
      (!currentBranchId || relatedToCurrent);
    const entersParaEnviar =
      canonicalOrder &&
      pendingSend &&
      (!currentBranchId || currentBranchId === originId);
    const entersEnCamino =
      canonicalOrder &&
      status === "En camino" &&
      (!currentBranchId || relatedToCurrent);
    const entersEntregado =
      canonicalOrder &&
      status === "Entregado" &&
      (!currentBranchId || relatedToCurrent);

    const alerts: string[] = [];
    if (looksLikeSale) alerts.push("parece_venta_no_pedido");
    if (!originId) alerts.push("sin_sucursal_origen");
    if (normalizeTextLower(row?.tipo_destino) === "sucursal" && !destinationId) {
      alerts.push("sin_sucursal_destino");
    }
    if (!normalizeText(row?.numero_guia) && canonicalOrder) alerts.push("sin_numero_guia");
    if (status === SEND_TO_BRANCH_STATUS && !interbranch) alerts.push("estado_para_enviar_sin_ruta_inter_sucursal");
    if (status === "En camino" && !interbranch && normalizeTextLower(row?.tipo_destino) === "sucursal") {
      alerts.push("estado_en_camino_sin_ruta_inter_sucursal");
    }
    if (currentBranchId && canonicalOrder && !relatedToCurrent) {
      alerts.push("quedaria_fuera_por_relacion_sucursal_actual");
    }
    if (status === "Entregado" && WAITING_STATUSES.has(status)) {
      alerts.push("estado_inconsistente");
    }

    const reasonInclusion = [
      entersTodos ? "todos" : "",
      entersListo ? "listo_para_recoger" : "",
      entersParaEnviar ? "para_enviar" : "",
      entersEnCamino ? "en_camino" : "",
      entersEntregado ? "entregado" : "",
    ].filter(Boolean).join("|");
    const reasonExclusion = !canonicalOrder
      ? "excluido_por_parecer_venta"
      : currentBranchId && !relatedToCurrent
        ? "sin_relacion_con_sucursal_actual"
        : status === "Entregado"
          ? "solo_visible_en_entregado"
          : "";

    pushRow({
      source: "shipping",
      record_id: normalizeText(row?._id),
      pedido_ref_id: normalizeText(row?._id),
      fecha_base: formatDateForCell(row?.hora_entrega_acordada || row?.fecha_pedido),
      numero_guia: normalizeText(row?.numero_guia),
      buyer_tracking_code: normalizeText(row?.buyer_tracking_code),
      cliente: normalizeText(row?.cliente),
      vendedor: buildSellerLabel(row),
      telefono_cliente: normalizeText(row?.telefono_cliente),
      carnet_cliente: normalizeText(row?.carnet_cliente),
      canal: normalizeText(row?.origen_pedido) === "catalogo" ? "Catalogo" : "Interno",
      service_origin: row?.simple_package_order ? "simple_package_order" : "shipping",
      origen_pedido: normalizeText(row?.origen_pedido),
      estado_pedido: status,
      estado_publico_estimado: estimatePublicStatus(status, looksLikeSale),
      delivered: booleanLabel(status === "Entregado"),
      tipo_destino: normalizeText(row?.tipo_destino),
      lugar_origen: normalizeText(originName || getBranchName(row?.lugar_origen)),
      lugar_entrega: normalizeText(row?.lugar_entrega),
      origen_sucursal_id: originId,
      origen_sucursal_nombre: originName,
      destino_sucursal_id: destinationId,
      destino_sucursal_nombre: destinationName,
      sucursal_actual_relacion: currentBranchId ? (relatedToCurrent ? "relacionada" : "sin_relacion") : "",
      es_inter_sucursal: booleanLabel(interbranch),
      parece_venta_no_pedido: booleanLabel(looksLikeSale),
      entra_como_pedido_canonico: booleanLabel(canonicalOrder),
      entra_en_todos: booleanLabel(entersTodos),
      entra_en_listo_para_recoger: booleanLabel(entersListo),
      entra_en_para_enviar: booleanLabel(entersParaEnviar),
      entra_en_en_camino: booleanLabel(entersEnCamino),
      entra_en_entregado: booleanLabel(entersEntregado),
      motivo_inclusion: reasonInclusion,
      motivo_exclusion: reasonExclusion,
      alertas: alerts.join("|"),
    });
  }

  for (const row of externalRows) {
    const status = normalizeStatus(row?.estado_pedido || (row?.delivered ? "Entregado" : "En Espera"));
    const { origin, destination } = inferExternalBranches(row, branchLookup);
    const originId = origin?.id || "";
    const destinationId = destination?.id || "";
    const originName = origin?.name || "";
    const destinationName = destination?.name || "";
    const relatedToCurrent = rowMatchesCurrentBranch(currentBranchId, originId, destinationId);
    const interbranch = isInterbranch(originId, destinationId);
    const looksLikeSale = false;
    const pendingSend = status === SEND_TO_BRANCH_STATUS && interbranch;
    const canonicalOrder = true;
    const entersTodos = status !== "Entregado" && (!currentBranchId || relatedToCurrent);
    const entersListo =
      !pendingSend &&
      status !== "En camino" &&
      status !== "Entregado" &&
      (!currentBranchId || relatedToCurrent);
    const entersParaEnviar =
      pendingSend &&
      (!currentBranchId || currentBranchId === originId);
    const entersEnCamino =
      status === "En camino" &&
      (!currentBranchId || relatedToCurrent);
    const entersEntregado =
      status === "Entregado" &&
      (!currentBranchId || relatedToCurrent);

    const alerts: string[] = [];
    if (!originId) alerts.push("sin_sucursal_origen");
    if (interbranch && !destinationId) alerts.push("sin_sucursal_destino");
    if (!normalizeText(row?.numero_guia)) alerts.push("sin_numero_guia");
    if (status === SEND_TO_BRANCH_STATUS && !interbranch) alerts.push("estado_para_enviar_sin_ruta_inter_sucursal");
    if (currentBranchId && !relatedToCurrent) alerts.push("quedaria_fuera_por_relacion_sucursal_actual");

    const reasonInclusion = [
      entersTodos ? "todos" : "",
      entersListo ? "listo_para_recoger" : "",
      entersParaEnviar ? "para_enviar" : "",
      entersEnCamino ? "en_camino" : "",
      entersEntregado ? "entregado" : "",
    ].filter(Boolean).join("|");
    const reasonExclusion =
      currentBranchId && !relatedToCurrent
        ? "sin_relacion_con_sucursal_actual"
        : status === "Entregado"
          ? "solo_visible_en_entregado"
          : "";

    pushRow({
      source: "external",
      record_id: normalizeText(row?._id),
      pedido_ref_id: normalizeText(row?.pedido_ref),
      fecha_base: formatDateForCell(row?.fecha_pedido),
      numero_guia: normalizeText(row?.numero_guia),
      buyer_tracking_code: normalizeText(row?.buyer_tracking_code),
      cliente: normalizeText(row?.comprador),
      vendedor: normalizeText(row?.vendedor),
      telefono_cliente: normalizeText(row?.telefono_comprador),
      carnet_cliente: normalizeText(row?.carnet_comprador),
      canal: "Externo",
      service_origin: normalizeText(row?.service_origin || "external"),
      origen_pedido: "",
      estado_pedido: status,
      estado_publico_estimado: estimatePublicStatus(status, looksLikeSale),
      delivered: booleanLabel(status === "Entregado" || row?.delivered === true),
      tipo_destino: destinationId ? "sucursal" : "otro_lugar",
      lugar_origen: normalizeText(originName || getBranchName(row?.origen_sucursal)),
      lugar_entrega: normalizeText(row?.lugar_entrega || destinationName),
      origen_sucursal_id: originId,
      origen_sucursal_nombre: originName,
      destino_sucursal_id: destinationId,
      destino_sucursal_nombre: destinationName,
      sucursal_actual_relacion: currentBranchId ? (relatedToCurrent ? "relacionada" : "sin_relacion") : "",
      es_inter_sucursal: booleanLabel(interbranch),
      parece_venta_no_pedido: booleanLabel(false),
      entra_como_pedido_canonico: booleanLabel(canonicalOrder),
      entra_en_todos: booleanLabel(entersTodos),
      entra_en_listo_para_recoger: booleanLabel(entersListo),
      entra_en_para_enviar: booleanLabel(entersParaEnviar),
      entra_en_en_camino: booleanLabel(entersEnCamino),
      entra_en_entregado: booleanLabel(entersEntregado),
      motivo_inclusion: reasonInclusion,
      motivo_exclusion: reasonExclusion,
      alertas: alerts.join("|"),
    });
  }

  return details.sort((a, b) => (a.fecha_base < b.fecha_base ? 1 : -1));
};

const objectEntriesSorted = (record: Record<string, number>) =>
  Object.entries(record).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const buildWorkbook = async (
  summaryRows: Array<[string, string | number]>,
  detailRows: DetailRow[],
  distributions: {
    rawStatus: Record<string, number>;
    publicStatus: Record<string, number>;
    alertas: Record<string, number>;
    origen: Record<string, number>;
    destino: Record<string, number>;
    canal: Record<string, number>;
    source: Record<string, number>;
  }
) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TuPunto Order Audit";
  wb.created = new Date();

  const summarySheet = wb.addWorksheet("Resumen");
  summarySheet.addRow(["Indicador", "Valor"]);
  summarySheet.getRow(1).font = { bold: true };
  summaryRows.forEach((row) => summarySheet.addRow(row));
  summarySheet.columns = [{ width: 42 }, { width: 22 }];

  const distributionsSheet = wb.addWorksheet("Distribuciones");
  distributionsSheet.addRow(["Grupo", "Clave", "Cantidad"]);
  distributionsSheet.getRow(1).font = { bold: true };

  const addDistribution = (group: string, data: Record<string, number>) => {
    objectEntriesSorted(data).forEach(([key, value]) => {
      distributionsSheet.addRow([group, key, value]);
    });
  };

  addDistribution("estado_pedido", distributions.rawStatus);
  addDistribution("estado_publico_estimado", distributions.publicStatus);
  addDistribution("alertas", distributions.alertas);
  addDistribution("origen_sucursal", distributions.origen);
  addDistribution("destino_sucursal", distributions.destino);
  addDistribution("canal", distributions.canal);
  addDistribution("source", distributions.source);
  distributionsSheet.columns = [{ width: 28 }, { width: 42 }, { width: 16 }];

  const detailSheet = wb.addWorksheet("Detalle");
  const headers = Object.keys(detailRows[0] || {
    source: "",
    record_id: "",
    pedido_ref_id: "",
    fecha_base: "",
    numero_guia: "",
    buyer_tracking_code: "",
    cliente: "",
    vendedor: "",
    telefono_cliente: "",
    carnet_cliente: "",
    canal: "",
    service_origin: "",
    origen_pedido: "",
    estado_pedido: "",
    estado_publico_estimado: "",
    delivered: "",
    tipo_destino: "",
    lugar_origen: "",
    lugar_entrega: "",
    origen_sucursal_id: "",
    origen_sucursal_nombre: "",
    destino_sucursal_id: "",
    destino_sucursal_nombre: "",
    sucursal_actual_relacion: "",
    es_inter_sucursal: "",
    parece_venta_no_pedido: "",
    entra_como_pedido_canonico: "",
    entra_en_todos: "",
    entra_en_listo_para_recoger: "",
    entra_en_para_enviar: "",
    entra_en_en_camino: "",
    entra_en_entregado: "",
    motivo_inclusion: "",
    motivo_exclusion: "",
    alertas: "",
  });
  detailSheet.addRow(headers);
  detailSheet.getRow(1).font = { bold: true };
  detailRows.forEach((row) => {
    detailSheet.addRow(headers.map((header) => (row as any)[header] ?? ""));
  });
  detailSheet.columns = headers.map((header) => ({
    key: header,
    width: [
      "record_id",
      "pedido_ref_id",
      "numero_guia",
      "buyer_tracking_code",
      "origen_sucursal_id",
      "destino_sucursal_id",
    ].includes(header)
      ? 24
      : ["motivo_inclusion", "motivo_exclusion", "alertas", "lugar_entrega", "cliente", "vendedor"].includes(header)
        ? 32
        : 18,
  }));

  const filename = `auditoria_pedidos_${moment().tz(TZ).format("YYYYMMDD_HHmmss")}.xlsx`;
  const outDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, filename);
  await wb.xlsx.writeFile(filePath);
  return { filePath, filename };
};

const getOrderAuditReport = async (params: OrderAuditParams) => {
  const branches = await ReportsRepository.fetchSucursalesBasicas();
  const branchLookup = buildBranchLookup(branches as any[]);

  const [shippingRows, externalRows] = await Promise.all([
    PedidoModel.find(buildShippingMatch(params))
      .sort({ hora_entrega_acordada: -1 })
      .populate([
        { path: "sucursal", select: "_id nombre" },
        { path: "lugar_origen", select: "_id nombre" },
        { path: "venta", populate: [{ path: "vendedor", select: "nombre apellido" }] },
      ])
      .lean(),
    VentaExternaModel.find(buildExternalMatch(params))
      .sort({ fecha_pedido: -1 })
      .populate([
        { path: "sucursal", select: "_id nombre" },
        { path: "origen_sucursal", select: "_id nombre" },
        { path: "destino_sucursal", select: "_id nombre" },
      ])
      .lean(),
  ]);

  const detailRows = buildDetailRows(shippingRows, externalRows, branchLookup, params);

  const summary = {
    generatedAt: moment().tz(TZ).format("YYYY-MM-DD HH:mm:ss"),
    filters: {
      from: formatDateForCell(params.from),
      to: formatDateForCell(params.to),
      branchId: normalizeText(params.branchId),
      currentBranchId: normalizeText(params.currentBranchId || params.branchId),
      suspiciousOnly: Boolean(params.suspiciousOnly),
    },
    totals: {
      total_registros_evaluados: detailRows.length,
      total_shipping: detailRows.filter((row) => row.source === "shipping").length,
      total_external: detailRows.filter((row) => row.source === "external").length,
      total_pedidos_validos: detailRows.filter((row) => row.entra_como_pedido_canonico === "si").length,
      total_excluidos_como_venta: detailRows.filter((row) => row.parece_venta_no_pedido === "si").length,
      total_sospechosos: detailRows.filter((row) => Boolean(row.alertas)).length,
      total_sin_numero_guia: detailRows.filter((row) => row.alertas.includes("sin_numero_guia")).length,
      total_sin_sucursal_origen: detailRows.filter((row) => row.alertas.includes("sin_sucursal_origen")).length,
      total_sin_sucursal_destino: detailRows.filter((row) => row.alertas.includes("sin_sucursal_destino")).length,
      total_destino_no_aplica: detailRows.filter((row) => normalizeTextLower(row.lugar_entrega) === "no aplica").length,
      total_estado_interno: detailRows.filter((row) => normalizeTextLower(row.estado_pedido) === "interno").length,
      total_tab_todos: detailRows.filter((row) => row.entra_en_todos === "si").length,
      total_tab_listo_para_recoger: detailRows.filter((row) => row.entra_en_listo_para_recoger === "si").length,
      total_tab_para_enviar: detailRows.filter((row) => row.entra_en_para_enviar === "si").length,
      total_tab_en_camino: detailRows.filter((row) => row.entra_en_en_camino === "si").length,
      total_tab_entregado: detailRows.filter((row) => row.entra_en_entregado === "si").length,
    },
  };

  const distributions = {
    rawStatus: countBy(detailRows.map((row) => row.estado_pedido || "(vacio)")),
    publicStatus: countBy(detailRows.map((row) => row.estado_publico_estimado || "(vacio)")),
    alertas: countBy(
      detailRows.flatMap((row) => normalizeText(row.alertas).split("|").map((item) => item.trim()).filter(Boolean))
    ),
    origen: countBy(detailRows.map((row) => row.origen_sucursal_nombre || "(sin origen)")),
    destino: countBy(detailRows.map((row) => row.destino_sucursal_nombre || row.lugar_entrega || "(sin destino)")),
    canal: countBy(detailRows.map((row) => row.canal || "(vacio)")),
    source: countBy(detailRows.map((row) => row.source || "(vacio)")),
  };

  return {
    ...summary,
    distributions,
    rows: detailRows,
  };
};

const exportOrderAuditReportXlsx = async (params: OrderAuditParams) => {
  const report = await getOrderAuditReport(params);
  const summaryRows: Array<[string, string | number]> = [
    ["generado_en", report.generatedAt],
    ["filtro_desde", report.filters.from || ""],
    ["filtro_hasta", report.filters.to || ""],
    ["filtro_branch_id", report.filters.branchId || ""],
    ["filtro_current_branch_id", report.filters.currentBranchId || ""],
    ["suspicious_only", report.filters.suspiciousOnly ? "si" : "no"],
    ...Object.entries(report.totals).map(([key, value]) => [key, value]),
  ];

  return buildWorkbook(summaryRows, report.rows, report.distributions);
};

export const OrderAuditReportService = {
  getOrderAuditReport,
  exportOrderAuditReportXlsx,
};
