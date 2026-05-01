// src/services/reports.service.ts
import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";
import moment from "moment-timezone";
import { Types } from "mongoose";
import { ReportsRepository } from "../repositories/reports.repository";
import { variantFingerprint, variantLabel, variantsToEntries } from "../utils/variantKey";

const TZ = "America/La_Paz";

type VentasQrParams = {
  meses: string[];        // ["2025-11","2025-12",...]
  sucursalIds?: string[]; // opcional
};

function normalizeMesesList(meses: string[]) {
  const filtered = (meses || []).filter(m => /^\d{4}-\d{2}$/.test(m));
  const unique = Array.from(new Set(filtered)).sort();
  if (!unique.length) throw new Error("meses es requerido (YYYY-MM[])");
  return unique;
}

type Params = {
  mes?: string; // YYYY-MM
  meses?: string[]; // YYYY-MM[]
  sucursalIds?: string[];
  modoTop?: "clientes" | "vendedores";
  ticketPromedioModo?: "pago_fijo" | "comision" | "pago_fijo_mas_comision";
  reportes?: string[];
  columnas?: Record<string, string[]>;
};

type ExportStockParams = { idSucursal: string };
type InventoryParams = { idSucursal: string; sellerId?: string };
type VariantRiskParams = {
  sellerId?: string;
  limit?: number;
  minCombinaciones?: number;
  minEspacioTeorico?: number;
};

type TemporarySellerSalesParams = {
  sellerId: string;
};

type ExportComisionesParams = {
  mes?: string;
  meses?: string[];
  mesFin?: string;
  sucursalIds?: string[];
};

type StockRow = {
  producto: string;
  variante: string;
  id_vendedor: string;
  vendedor: string;
  stock: number;
};

type InventoryRow = {
  id_producto: string;
  producto: string;
  variante: string;
  variant_key: string;
  id_vendedor: string;
  vendedor: string;
  estado_cliente: "activo" | "debe_renovar";
  stock_actual: number;
  unidades_en_espera: number;
  tiene_entregas_en_espera: boolean;
  stock_total_reportado: number;
  es_temporal: boolean;
};

type VariantRiskRow = {
  id_producto: string;
  producto: string;
  id_vendedor: string;
  vendedor: string;
  group_id: number | "";
  sucursales: number;
  combinaciones_unicas: number;
  combinaciones_max_sucursal: number;
  atributos_distintos: number;
  espacio_teorico: number;
  cobertura_pct: number;
  firmas_atributos: number;
  combinaciones_incompletas: number;
  score_riesgo: number;
  atributos: string;
  firmas_ejemplo: string;
  motivo: string;
};

function formatVariante(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const obj = v as Record<string, unknown>;

  const preferred = ["Talla", "Color", "Modelo"];
  const keys = Object.keys(obj);

  const ordered = [
    ...preferred.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferred.includes(k)).sort(),
  ];

  return ordered.map((k) => `${k}: ${String(obj[k])}`).join("/");
}

function toVariantRecord(variantes: unknown): Record<string, string> | null {
  if (!variantes || typeof variantes !== "object") return null;

  const entries = variantsToEntries(variantes as Record<string, string>);
  if (!entries.length) return null;
  return Object.fromEntries(entries);
}

function stripBaseProductPrefix(label: unknown, baseName?: unknown): string {
  const raw = String(label || "").trim();
  const base = String(baseName || "").trim();
  if (!raw || !base) return raw;

  const rawNorm = normalizeText(raw);
  const baseNorm = normalizeText(base);
  if (!baseNorm || !rawNorm.startsWith(baseNorm)) return raw;

  return raw.slice(base.length).replace(/^[-:/\s]+/, "").trim() || raw;
}

function normalizeInventoryVariantValueLabel(label: unknown, baseName?: unknown): string {
  const stripped = stripBaseProductPrefix(label, baseName);
  return normalizeText(stripped).replace(/(^|\/)\s*[^:/]+:\s*/g, "$1");
}

function buildInventoryAliasKeys(params: {
  idProducto?: unknown;
  variantKey?: unknown;
  variantes?: unknown;
  variante?: unknown;
  idVendedor?: unknown;
  baseName?: unknown;
  esTemporal?: boolean;
}) {
  const sellerId = String(params.idVendedor || "").trim();
  const productId = String(params.idProducto || "").trim();
  const variantKey = String(params.variantKey || "").trim();
  const variantRecord = toVariantRecord(params.variantes);
  const fingerprint = variantRecord ? variantFingerprint(variantRecord) : "";
  const valueLabel = variantRecord
    ? normalizeInventoryVariantValueLabel(variantLabel(variantRecord), params.baseName)
    : normalizeInventoryVariantValueLabel(params.variante, params.baseName);
  const aliases = new Set<string>();

  if (params.esTemporal) {
    aliases.add(`temp|${sellerId}|${normalizeText(params.variante)}`);
    return Array.from(aliases);
  }

  if (productId && variantKey) aliases.add(`prod|${productId}|var|${variantKey}`);
  if (productId && fingerprint) aliases.add(`prod|${productId}|fp|${fingerprint}`);
  if (productId && valueLabel) aliases.add(`prod|${productId}|lbl|${valueLabel}`);
  if (!productId && valueLabel) aliases.add(`fallback|${sellerId}|${valueLabel}`);

  return Array.from(aliases);
}

function resolveInventoryRowKey(
  aliasMap: Map<string, string>,
  params: Parameters<typeof buildInventoryAliasKeys>[0]
) {
  const aliases = buildInventoryAliasKeys(params);
  for (const alias of aliases) {
    const existing = aliasMap.get(alias);
    if (existing) return existing;
  }

  return aliases[0] || `fallback|${normalizeText(params.variante)}`;
}

function registerInventoryAliases(
  aliasMap: Map<string, string>,
  canonicalKey: string,
  params: Parameters<typeof buildInventoryAliasKeys>[0]
) {
  for (const alias of buildInventoryAliasKeys(params)) {
    aliasMap.set(alias, canonicalKey);
  }
}

function getInventoryDisplayVariant(params: {
  variantes?: unknown;
  nombreVariante?: unknown;
  baseName?: unknown;
}) {
  const fromMap = formatVariante(params.variantes);
  if (fromMap) return fromMap;
  return stripBaseProductPrefix(params.nombreVariante, params.baseName);
}

function getSellerLifecycleStatus(fechaVigencia: unknown): "activo" | "debe_renovar" | "ya_no_es_cliente" {
  if (!fechaVigencia) return "ya_no_es_cliente";

  const hoy = moment.tz(TZ).startOf("day");
  const vigencia = moment.tz(fechaVigencia, TZ).endOf("day");
  if (!vigencia.isValid()) return "ya_no_es_cliente";

  const diasVencido = hoy.diff(vigencia, "day");
  if (diasVencido <= 0) return "activo";
  if (diasVencido <= 20) return "debe_renovar";
  return "ya_no_es_cliente";
}

function monthRange(mes: string) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error("mes debe ser 'YYYY-MM'");
  const start = moment.tz(`${mes}-01 00:00:00`, TZ).toDate();
  const end = moment(start).add(1, "month").toDate();
  return { start, end };
}

function normalizeMeses(mes?: string, meses?: string[]) {
  const list: string[] = [];
  if (Array.isArray(meses)) list.push(...meses);
  if (mes) list.push(mes);
  const filtered = list.filter((m) => /^\d{4}-\d{2}$/.test(m));
  const unique = Array.from(new Set(filtered)).sort();
  if (!unique.length) throw new Error("mes o meses es requerido (YYYY-MM)");
  return unique;
}

function rangeMeses(meses: string[]) {
  const ordenados = [...meses].sort();
  const start = moment.tz(`${ordenados[0]}-01 00:00:00`, TZ).toDate();
  const end = moment.tz(`${ordenados[ordenados.length - 1]}-01 00:00:00`, TZ)
    .add(1, "month")
    .toDate();
  return { start, end };
}

function rangeUltimos3Meses(mesFin: string) {
  if (!/^\d{4}-\d{2}$/.test(mesFin)) throw new Error("mesFin debe ser 'YYYY-MM'");

  // end = 1er día del mesFin + 1 mes (exclusivo)
  const end = moment.tz(`${mesFin}-01 00:00:00`, TZ).add(1, "month").toDate();
  // start = 1er día del mesFin - 2 meses (incluye mesFin-2)
  const start = moment.tz(`${mesFin}-01 00:00:00`, TZ).subtract(2, "month").toDate();
  return { start, end };
}

function listaMeses3(mesFin: string) {
  const base = moment.tz(`${mesFin}-01 00:00:00`, TZ);
  return [
    base.clone().subtract(2, "month").format("YYYY-MM"),
    base.clone().subtract(1, "month").format("YYYY-MM"),
    base.clone().format("YYYY-MM"),
  ];
}
function rangeUltimos4Meses(mesFin: string) {
  if (!/^\d{4}-\d{2}$/.test(mesFin)) throw new Error("mesFin debe ser 'YYYY-MM'");

  // end = 1er día de mesFin + 1 mes (exclusivo)
  const end = moment.tz(`${mesFin}-01 00:00:00`, TZ).add(1, "month").toDate();
  // start = 1er día de mesFin - 3 meses (incluye mesFin-3)
  const start = moment.tz(`${mesFin}-01 00:00:00`, TZ).subtract(3, "month").toDate();

  return { start, end };
}

function listaMeses4(mesFin: string) {
  const base = moment.tz(`${mesFin}-01 00:00:00`, TZ);
  return [
    base.clone().subtract(3, "month").format("YYYY-MM"),
    base.clone().subtract(2, "month").format("YYYY-MM"),
    base.clone().subtract(1, "month").format("YYYY-MM"),
    base.clone().format("YYYY-MM"),
  ];
}

function getSucursalFromPedido(p: any) {
  const id =
    (p.sucursal?._id || p.sucursal) ||
    (p.lugar_origen?._id || p.lugar_origen);
  const nombre = p.sucursal?.nombre || p.lugar_origen?.nombre || "Sin Sucursal";
  return { id: String(id || ""), nombre };
}

function safeNum(n: any) {
  if (typeof n === "number" && !isNaN(n)) return n;
  if (typeof n === "string" && n.trim() !== "") {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
  }
  return 0;
}

function safeProduct(values: number[]) {
  let total = 1;
  for (const value of values) {
    const safeValue = Math.max(0, Math.trunc(value));
    if (safeValue <= 0) return 0;
    total *= safeValue;
    if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) {
      return Number.MAX_SAFE_INTEGER;
    }
  }
  return total;
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTicketPromedioMode(value: unknown): "pago_fijo" | "comision" | "pago_fijo_mas_comision" {
  if (value === "comision") return "comision";
  if (value === "pago_fijo_mas_comision") return "pago_fijo_mas_comision";
  return "pago_fijo";
}

function buildProductoDisplayName(params: {
  baseName?: unknown;
  nombreVariante?: unknown;
  variantes?: unknown;
}) {
  const baseName = String(params.baseName || "").trim();
  const nombreVariante = String(params.nombreVariante || "").trim();
  const varianteDesdeMapa = formatVariante(params.variantes);
  const variantLabel = nombreVariante || varianteDesdeMapa;

  if (!baseName && !variantLabel) return "Producto";
  if (!baseName) return variantLabel;
  if (!variantLabel) return baseName;

  const baseNorm = normalizeText(baseName);
  const variantNorm = normalizeText(variantLabel);

  if (
    variantNorm === baseNorm ||
    variantNorm.startsWith(`${baseNorm} -`) ||
    variantNorm.startsWith(`${baseNorm}:`) ||
    variantNorm.startsWith(`${baseNorm} /`) ||
    variantNorm.startsWith(`${baseNorm},`) ||
    variantNorm.startsWith(`${baseNorm} `)
  ) {
    return variantLabel;
  }

  return `${baseName} - ${variantLabel}`;
}

function buildVariantDisplayName(params: {
  producto?: unknown;
  nombreVariante?: unknown;
  variantes?: unknown;
}) {
  const baseName = String(params.producto || "").trim();
  const nombreVariante = stripBaseProductPrefix(params.nombreVariante, baseName);
  const desdeMapa = stripBaseProductPrefix(formatVariante(params.variantes), baseName);

  return nombreVariante || desdeMapa || "Temporal";
}

function isVentaDirectaLike(params: { estado_pedido?: unknown; observaciones?: unknown }) {
  const estado = String(params.estado_pedido || "").trim().toLowerCase();
  const obs = String(params.observaciones || "").toLowerCase();

  return (
    estado === "interno" ||
    obs.includes("pedido generado automaticamente desde una venta directa") ||
    obs.includes("pedido generado autom\u00e1ticamente desde una venta directa")
  );
}

function buildVariantRiskRows(rawProducts: any[], params?: VariantRiskParams): VariantRiskRow[] {
  const minCombinaciones = Math.max(0, Number(params?.minCombinaciones) || 0);
  const minEspacioTeorico = Math.max(0, Number(params?.minEspacioTeorico) || 0);
  const limit = Math.max(1, Math.min(500, Number(params?.limit) || 100));

  const rows = (rawProducts || [])
    .map((product) => {
      const uniqueCombos = new Map<
        string,
        { variantes: Record<string, string>; attributeSignature: string }
      >();
      const attributeNames = new Map<string, string>();
      const attributeValues = new Map<string, Set<string>>();
      const signatureCounts = new Map<string, number>();
      const sucursales = Array.isArray(product?.sucursales) ? product.sucursales : [];
      let combinacionesMaxSucursal = 0;

      for (const sucursal of sucursales) {
        const combinaciones = Array.isArray(sucursal?.combinaciones) ? sucursal.combinaciones : [];
        combinacionesMaxSucursal = Math.max(combinacionesMaxSucursal, combinaciones.length);

        for (const combinacion of combinaciones) {
          const entries = variantsToEntries(combinacion?.variantes);
          if (!entries.length) continue;

          const normalizedRecord: Record<string, string> = {};
          for (const [rawKey, rawValue] of entries) {
            const keyNorm = normalizeText(rawKey);
            const valueNorm = String(rawValue || "").trim();
            if (!keyNorm || !valueNorm) continue;

            normalizedRecord[keyNorm] = valueNorm;
            if (!attributeNames.has(keyNorm)) {
              attributeNames.set(keyNorm, String(rawKey).trim());
            }
            if (!attributeValues.has(keyNorm)) {
              attributeValues.set(keyNorm, new Set<string>());
            }
            attributeValues.get(keyNorm)!.add(valueNorm);
          }

          const fingerprint = variantFingerprint(normalizedRecord);
          if (!fingerprint) continue;

          const attributeSignature = Object.keys(normalizedRecord).sort().join("|");
          if (!uniqueCombos.has(fingerprint)) {
            uniqueCombos.set(fingerprint, {
              variantes: normalizedRecord,
              attributeSignature,
            });
          }
        }
      }

      if (!uniqueCombos.size) return null;

      for (const combo of uniqueCombos.values()) {
        signatureCounts.set(
          combo.attributeSignature,
          (signatureCounts.get(combo.attributeSignature) || 0) + 1
        );
      }

      const combinacionesUnicas = uniqueCombos.size;
      const atributosDistintos = attributeValues.size;
      const valoresPorAtributo = Array.from(attributeValues.entries())
        .map(([keyNorm, values]) => ({
          keyNorm,
          keyDisplay: attributeNames.get(keyNorm) || keyNorm,
          count: values.size,
        }))
        .sort((a, b) => b.count - a.count || a.keyDisplay.localeCompare(b.keyDisplay));

      const espacioTeorico = safeProduct(valoresPorAtributo.map((item) => item.count));
      const firmasAtributos = signatureCounts.size;
      const combinacionesIncompletas = Array.from(uniqueCombos.values()).filter(
        (combo) => Object.keys(combo.variantes).length < atributosDistintos
      ).length;
      const coberturaPct =
        espacioTeorico > 0
          ? +((combinacionesUnicas / espacioTeorico) * 100).toFixed(2)
          : 0;
      const scoreRiesgo =
        espacioTeorico +
        (firmasAtributos - 1) * 25 +
        combinacionesIncompletas * 5 +
        Math.max(0, atributosDistintos - 2) * 10;

      const atributos = valoresPorAtributo
        .map((item) => `${item.keyDisplay}(${item.count})`)
        .join(", ");
      const firmasEjemplo = Array.from(signatureCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([signature, count]) => {
          const readable = signature
            .split("|")
            .filter(Boolean)
            .map((keyNorm) => attributeNames.get(keyNorm) || keyNorm)
            .join(" + ");
          return `${readable || "Sin atributos"} (${count})`;
        })
        .join(" | ");

      const motivos: string[] = [];
      motivos.push(`Matriz potencial ${espacioTeorico} con ${atributosDistintos} atributo(s)`);
      if (firmasAtributos > 1) {
        motivos.push(`${firmasAtributos} firmas de atributos distintas`);
      }
      if (combinacionesIncompletas > 0) {
        motivos.push(`${combinacionesIncompletas} combinaciones sin todos los atributos`);
      }
      if (combinacionesUnicas !== espacioTeorico) {
        motivos.push(`${combinacionesUnicas} combinaciones reales`);
      }

      return {
        id_producto: String(product?._id || ""),
        producto: String(product?.nombre_producto || ""),
        id_vendedor: String(product?.id_vendedor || ""),
        vendedor: String(product?.vendedor_nombre_completo || "").trim(),
        group_id: typeof product?.groupId === "number" ? product.groupId : "",
        sucursales: sucursales.length,
        combinaciones_unicas: combinacionesUnicas,
        combinaciones_max_sucursal: combinacionesMaxSucursal,
        atributos_distintos: atributosDistintos,
        espacio_teorico: espacioTeorico,
        cobertura_pct: coberturaPct,
        firmas_atributos: firmasAtributos,
        combinaciones_incompletas: combinacionesIncompletas,
        score_riesgo: scoreRiesgo,
        atributos,
        firmas_ejemplo: firmasEjemplo,
        motivo: motivos.join("; "),
      } satisfies VariantRiskRow;
    })
    .filter((row): row is VariantRiskRow => Boolean(row))
    .filter(
      (row) =>
        row.combinaciones_unicas >= minCombinaciones &&
        row.espacio_teorico >= minEspacioTeorico
    )
    .sort((a, b) =>
      b.score_riesgo - a.score_riesgo ||
      b.espacio_teorico - a.espacio_teorico ||
      b.combinaciones_unicas - a.combinaciones_unicas ||
      a.producto.localeCompare(b.producto)
    );

  return rows.slice(0, limit);
}

type ExportIngresos3MParams = {
  mes?: string;
  meses?: string[];
  mesFin?: string;
  incluirDeuda?: boolean;
};

type ExportClientesActivosParams = { mes?: string; meses?: string[]; mesFin?: string };
type ExportVentasVendedoresParams = { mes?: string; meses?: string[]; mesFin?: string };
type ExportClientesStatusParams = {};
function rangeOctToToday() {
  const hoy = moment.tz(TZ).endOf("day").toDate();
  const start = moment.tz("2025-10-01 00:00:00", TZ).toDate(); // Oct 1, 2025
  return { start, end: hoy };
};

function parseFechaPreservandoHoraOriginal(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return moment.parseZone(value.toISOString());
  return moment.parseZone(String(value));
}

const SIMPLE_DELIVERY_DEFAULT_SELLERS = [
  { id: "6863adbd1c1493ba582e5f7f", nombre: "Michelle Andrade" },
  { id: "6929c7603f097364d6bf21f5", nombre: "Jessmy Estefani" },
  { id: "6921ec250f648dc833be70ad", nombre: "Camila Azurduy" },
  { id: "69810f7f46336267d1bdfef5", nombre: "Judith Montaño" },
  { id: "697a404bad1c6f00979b5b87", nombre: "Nikole" },
] as const;

const SIMPLE_DELIVERY_DEFAULT_MONTHS = [1, 2, 11, 12] as const;

const MONTH_LABELS_ES: Record<number, string> = {
  1: "Enero",
  2: "Febrero",
  3: "Marzo",
  4: "Abril",
  5: "Mayo",
  6: "Junio",
  7: "Julio",
  8: "Agosto",
  9: "Septiembre",
  10: "Octubre",
  11: "Noviembre",
  12: "Diciembre",
};

function resolveMesesSeleccionados(params: { mes?: string; meses?: string[]; mesFin?: string }, fallbackWindow?: 3 | 4) {
  if (params.mes || (params.meses && params.meses.length)) {
    return normalizeMeses(params.mes, params.meses);
  }

  if (params.mesFin) {
    if (fallbackWindow === 4) return listaMeses4(params.mesFin);
    return listaMeses3(params.mesFin);
  }

  throw new Error("mes o meses es requerido (YYYY-MM)");
}


export const ReportsService = {
  async getOperacionMensual({
    mes,
    meses,
    sucursalIds,
    modoTop = "clientes",
    ticketPromedioModo = "pago_fijo",
  }: Params) {
    const mesesSeleccionados = normalizeMeses(mes, meses);
    const { start, end } = rangeMeses(mesesSeleccionados);
    const mesSet = new Set(mesesSeleccionados);
    const selectedTicketPromedioMode = normalizeTicketPromedioMode(ticketPromedioModo);
    const pedidos = await ReportsRepository.fetchPedidosMensual({ start, end, sucursalIds });

    // Catálogos auxiliares
    const sucMap = new Map<string, string>(); // id -> nombre
    const pushSucursal = (id: string, nombre: string) => {
      if (id) sucMap.set(id, nombre);
    };

    // ------------- Preparación de colecciones base -------------
    type VentaLike = {
      sucursalId: string;
      sucursalNombre: string;
      productoId?: string; // undefined en temporales
      variantKey?: string;
      nombreVariante?: string;
      productoNombre: string;
      productoBaseNombre?: string;
      productoCategoria?: string;
      mes: string;
      cantidad: number;
      precioUnit: number;
      utilidad: number;
      vendedorId?: string;
      vendedorNombre?: string;
    };

    const ventas: VentaLike[] = [];
    const pedidosFlat: any[] = [];
    const clientesPorPedido: { sucursalId: string; clave: string }[] = [];
    const ventasPorSucursalAcc = new Map<
      string,
      { sucursalId: string; sucursalNombre: string; ventas_directas: number; entregas_entregadas: number }
    >();

    for (const p of pedidos as any[]) {
      const fechaBase = p.hora_entrega_real || p.fecha_pedido;
      const mesPedido = fechaBase ? moment.tz(fechaBase, TZ).format("YYYY-MM") : "";
      if (!mesPedido || !mesSet.has(mesPedido)) continue;

      const { id: sucursalId, nombre: sucursalNombre } = getSucursalFromPedido(p);
      pushSucursal(sucursalId, sucursalNombre);

      // conteo de ventas por sucursal (ventas directas vs entregadas)
      {
        const estado = String(p.estado_pedido || "").trim().toLowerCase();
        const obs = String(p.observaciones || "").toLowerCase();
        const esVentaDirecta =
          estado === "interno" ||
          obs.includes("pedido generado automáticamente desde una venta directa") ||
          obs.includes("pedido generado automaticamente desde una venta directa");
        const esEntregaEntregada = estado === "entregado";
        const esVentaDirectaNormalizada = isVentaDirectaLike({
          estado_pedido: p.estado_pedido,
          observaciones: p.observaciones,
        });

        if (esVentaDirectaNormalizada || esEntregaEntregada) {
          const key = sucursalId || "sin_sucursal";
          const nombre = sucursalId ? sucursalNombre : "Sin Sucursal";
          const got =
            ventasPorSucursalAcc.get(key) || {
              sucursalId: key,
              sucursalNombre: nombre,
              ventas_directas: 0,
              entregas_entregadas: 0,
            };

          if (esVentaDirectaNormalizada) got.ventas_directas += 1;
          else if (esEntregaEntregada) got.entregas_entregadas += 1;

          ventasPorSucursalAcc.set(key, got);
        }
      }

      // totales por pedido
      const totalCobrado =
        safeNum(p.subtotal_qr) + safeNum(p.subtotal_efectivo) + safeNum(p.cargo_delivery);

      pedidosFlat.push({
        _id: String(p._id || ""),
        sucursalId,
        sucursalNombre,
        fecha: fechaBase,
        mes: mesPedido,
        estado_pedido: p.estado_pedido || "",
        observaciones: p.observaciones || "",
        cliente: p.cliente || "",
        telefono_cliente: p.telefono_cliente || "",
        totalCobrado,
        costoDelivery: safeNum(p.costo_delivery),
        cargoDelivery: safeNum(p.cargo_delivery),
      });

      // clave cliente (teléfono o nombre)
      const claveCliente = p.telefono_cliente || p.cliente || "";
      if (claveCliente) clientesPorPedido.push({ sucursalId, clave: String(claveCliente) });

      // ventas normales (array Venta poblada)
      if (Array.isArray(p.venta)) {
        for (const vRaw of p.venta as any[]) {
          if (!(vRaw && typeof vRaw === "object" && "cantidad" in vRaw && "precio_unitario" in vRaw)) continue;

          const v = vRaw as {
            cantidad: number;
            precio_unitario: number;
            nombre_variante?: string;
            variantes?: Record<string, string>;
            variantKey?: string;
            sucursal?: any;
            producto?: any;
            vendedor?: any;
          };

          const cantidad = safeNum(v.cantidad);
          const precio = safeNum(v.precio_unitario);
          if (!cantidad || !precio) continue;

          const sIdRaw = typeof v.sucursal === "string" ? v.sucursal : (v.sucursal?._id ?? sucursalId);
          const sId = String(sIdRaw);
          const sNom =
            typeof v.sucursal === "string"
              ? (sucMap.get(sId) || sucursalNombre)
              : (v.sucursal?.nombre || sucursalNombre);

          const categoriaNombre = v?.producto?.categoria?.categoria || v?.producto?.categoria || "";
          const baseNombre = v?.producto?.nombre_producto || "";
          const nombreCompleto = buildProductoDisplayName({
            baseName: baseNombre,
            nombreVariante: v?.nombre_variante,
            variantes: v?.variantes,
          });

          ventas.push({
            sucursalId: sId,
            sucursalNombre: sNom,
            productoId: v?.producto?._id ? String(v.producto._id) : (v?.producto ? String(v.producto) : undefined),
            variantKey: v?.variantKey ? String(v.variantKey) : undefined,
            nombreVariante: v?.nombre_variante ? String(v.nombre_variante) : undefined,
            productoNombre: nombreCompleto,
            productoBaseNombre: baseNombre || undefined,
            productoCategoria: categoriaNombre || undefined,
            mes: mesPedido,
            cantidad,
            precioUnit: precio,
            utilidad: safeNum((v as any)?.utilidad),
            vendedorId: v?.vendedor ? String(v.vendedor._id || v.vendedor) : undefined,
            vendedorNombre:
              v?.vendedor?.nombre && v?.vendedor?.apellido
                ? `${v.vendedor.nombre} ${v.vendedor.apellido}`
                : undefined,
          });
        }
      }

      // productos temporales
      if (Array.isArray(p.productos_temporales)) {
        for (const t of p.productos_temporales as any[]) {
          const cantidad = safeNum(t?.cantidad);
          const precio = safeNum(t?.precio_unitario);
          if (!cantidad || !precio) continue;

          ventas.push({
            sucursalId,
            sucursalNombre,
            productoId: undefined,
            productoNombre: `TEMP: ${t.producto}`,
            productoCategoria: "Temporal",
            mes: mesPedido,
            cantidad,
            precioUnit: precio,
            utilidad: 0,
            vendedorId: t?.id_vendedor ? String(t.id_vendedor) : undefined,
            vendedorNombre: undefined,
          });
        }
      }
    }

    // Base compartida para reportes de clientes/vendedores activos por servicios.
    const vendedoresServicioMensualMap = new Map<
      string,
      { mes: string; id_sucursal: string; sucursal: string; id_vendedor: string; servicios_total_bs: number }
    >();

    {
      const vendedores = await ReportsRepository.fetchVendedoresConPagoSucursales();

      for (const ven of vendedores as any[]) {
        const idVendedor = String(ven._id || "").trim();
        if (!idVendedor) continue;

        const vigencia = ven.fecha_vigencia ? moment.tz(ven.fecha_vigencia, TZ).endOf("day") : null;
        const pagos = Array.isArray(ven.pago_sucursales) ? ven.pago_sucursales : [];

        for (const pago of pagos) {
          if (pago?.activo === false) continue;

          const idSucursal = pago?.id_sucursal ? String(pago.id_sucursal) : "";
          const sucursal = String(pago?.sucursalName || sucMap.get(idSucursal) || "").trim();
          if (!idSucursal || !sucursal) continue;
          if (sucursalIds?.length && !sucursalIds.includes(idSucursal)) continue;

          const fechaIngreso = pago?.fecha_ingreso ? moment.tz(pago.fecha_ingreso, TZ).startOf("day") : null;
          const fechaSalida = pago?.fecha_salida ? moment.tz(pago.fecha_salida, TZ).endOf("day") : null;
          const serviciosTotalBs =
            safeNum(pago?.alquiler) +
            safeNum(pago?.exhibicion) +
            safeNum(pago?.delivery) +
            safeNum(pago?.entrega_simple);

          for (const mesSel of mesesSeleccionados) {
            const monthStart = moment.tz(`${mesSel}-01 00:00:00`, TZ).startOf("month");
            const monthEnd = monthStart.clone().endOf("month");

            if (vigencia && vigencia.isBefore(monthStart)) continue;
            if (fechaIngreso && fechaIngreso.isAfter(monthEnd)) continue;
            if (fechaSalida && fechaSalida.isBefore(monthStart)) continue;

            const key = `${mesSel}|${idSucursal}|${idVendedor}`;
            if (!vendedoresServicioMensualMap.has(key)) {
              vendedoresServicioMensualMap.set(key, {
                mes: mesSel,
                id_sucursal: idSucursal,
                sucursal,
                id_vendedor: idVendedor,
                servicios_total_bs: serviciosTotalBs,
              });
            }
          }
        }
      }
    }

    const comisionMensualPorVendedorMap = new Map<
      string,
      { mes: string; id_sucursal: string; sucursal: string; id_vendedor: string; comision_bs: number }
    >();

    for (const venta of ventas) {
      const idVendedor = String(venta.vendedorId || "").trim();
      const idSucursal = String(venta.sucursalId || "").trim();
      const sucursal = String(venta.sucursalNombre || sucMap.get(idSucursal) || "").trim();
      const mesVenta = String(venta.mes || "").trim();
      if (!idVendedor || !idSucursal || !sucursal || !mesVenta) continue;
      if (sucursalIds?.length && !sucursalIds.includes(idSucursal)) continue;

      const key = `${mesVenta}|${idSucursal}|${idVendedor}`;
      const got = comisionMensualPorVendedorMap.get(key) || {
        mes: mesVenta,
        id_sucursal: idSucursal,
        sucursal,
        id_vendedor: idVendedor,
        comision_bs: 0,
      };
      got.comision_bs += safeNum(venta.utilidad);
      comisionMensualPorVendedorMap.set(key, got);
    }

    // ------------- 1) Top 10 productos por sucursal -------------
    const topProductosPorSucursal: any[] = [];
    {
      const sucursalFilterSet = new Set((sucursalIds || []).map((id) => String(id)));
      const acc = new Map<
        string,
        {
          sucursalId: string;
          sucursalNombre: string;
          productoId?: string;
          productoNombre: string;
          productoCategoria?: string;
          unidades: number;
          monto: number;
        }
      >();

      for (const v of ventas) {
        if (!v.sucursalId) continue;
        if (sucursalFilterSet.size > 0 && !sucursalFilterSet.has(String(v.sucursalId))) continue;
        if (!String(v.sucursalNombre || "").trim()) continue;

        const productoKey = v.variantKey
          ? `variant:${v.variantKey}`
          : v.productoId
            ? `product:${v.productoId}|name:${normalizeText(v.productoNombre)}`
            : `nom:${normalizeText(v.productoNombre)}`;
        const key = `${v.sucursalId}|${productoKey}`;
        const got =
          acc.get(key) || {
            sucursalId: v.sucursalId,
            sucursalNombre: v.sucursalNombre,
            productoId: v.productoId,
            productoNombre: v.productoNombre,
            productoCategoria: v.productoCategoria,
            unidades: 0,
            monto: 0,
          };
        got.unidades += v.cantidad;
        got.monto += v.cantidad * v.precioUnit;
        acc.set(key, got);
      }

      const porSuc = new Map<string, any[]>();
      for (const row of acc.values()) {
        if (!String(row.sucursalNombre || "").trim()) continue;
        const arr = porSuc.get(row.sucursalId) || [];
        arr.push(row);
        porSuc.set(row.sucursalId, arr);
      }

      for (const [sucId, arr] of porSuc.entries()) {
        arr.sort((a, b) => (b.unidades - a.unidades) || (b.monto - a.monto));
        const top = arr.slice(0, 10).map((r, i) => ({
          id_sucursal: sucId,
          sucursal: r.sucursalNombre || sucMap.get(sucId) || "",
          categoria: r.productoCategoria || "",
          id_producto: r.productoId || null,
          nombre_producto: r.productoNombre,
          unidades: r.unidades,
          monto_bs: +r.monto.toFixed(2),
          rank: i + 1,
        })).filter((r) => String(r.sucursal || "").trim().length > 0);
        topProductosPorSucursal.push(...top);
      }

      topProductosPorSucursal.sort(
        (a, b) => a.id_sucursal.localeCompare(b.id_sucursal) || (a.rank - b.rank),
      );
    }

    // ------------- 2) Top 10 (clientes o vendedores) GLOBAL -------------
    let topGlobal: any[] = [];
    const topGlobalSucursalFilterSet = new Set((sucursalIds || []).map((id) => String(id)));
    if (modoTop === "vendedores") {
      const acc = new Map<string, { vendedorId: string; vendedor: string; monto: number }>();

      for (const v of ventas) {
        if (!v.vendedorId) continue;
        if (topGlobalSucursalFilterSet.size > 0 && !topGlobalSucursalFilterSet.has(String(v.sucursalId))) continue;
        const k = v.vendedorId;
        const got = acc.get(k) || { vendedorId: k, vendedor: v.vendedorNombre || k, monto: 0 };
        got.monto += v.cantidad * v.precioUnit;
        acc.set(k, got);
      }

      topGlobal = Array.from(acc.values())
        .map((g) => ({ id_vendedor: g.vendedorId, vendedor: g.vendedor, cliente: g.vendedor, monto_bs: +g.monto.toFixed(2) }))
        .sort((a, b) => b.monto_bs - a.monto_bs)
        .slice(0, 10);
    } else {
      const acc2 = new Map<string, { cliente: string; monto: number; pedidos: number }>();

      for (const p of pedidosFlat) {
        if (topGlobalSucursalFilterSet.size > 0 && !topGlobalSucursalFilterSet.has(String(p.sucursalId))) continue;
        const clave = p.telefono_cliente || p.cliente || "";
        if (!clave) continue;
        const totalCobrado = safeNum(p.totalCobrado);
        const got = acc2.get(clave) || { cliente: p.cliente || String(clave), monto: 0, pedidos: 0 };
        got.monto += totalCobrado;
        got.pedidos += 1;
        acc2.set(clave, got);
      }

      topGlobal = Array.from(acc2.values())
        .map((g) => ({
          cliente: g.cliente,
          pedidos: g.pedidos,
          monto_bs: +g.monto.toFixed(2),
          ticket_promedio_bs: +(g.monto / (g.pedidos || 1)).toFixed(2),
        }))
        .sort((a, b) => b.monto_bs - a.monto_bs)
        .slice(0, 10);
    }

    // ------------- 3) Delivery promedio por sucursal -------------
    const deliveryPromedioPorSucursal: any[] = [];
    let deliveryPromedioGlobal: any = {};
    {
      const acc = new Map<string, { sucursalId: string; sum: number; sumPos: number; n: number; nPos: number }>();

      for (const p of pedidosFlat) {
        if (isVentaDirectaLike(p)) continue;
        const k = p.sucursalId;
        const got = acc.get(k) || { sucursalId: k, sum: 0, sumPos: 0, n: 0, nPos: 0 };
        got.sum += p.costoDelivery;
        got.n += 1;
        if (p.costoDelivery > 0) {
          got.sumPos += p.costoDelivery;
          got.nPos += 1;
        }
        acc.set(k, got);
      }

      for (const a of acc.values()) {
        deliveryPromedioPorSucursal.push({
          id_sucursal: a.sucursalId,
          sucursal: sucMap.get(a.sucursalId) || "",
          envios: a.n,
          promedio_bs: +(a.sum / (a.n || 1)).toFixed(2),
          promedio_sin_ceros_bs: +(a.sumPos / (a.nPos || 1)).toFixed(2),
        });
      }

      deliveryPromedioPorSucursal.sort((a, b) => a.sucursal.localeCompare(b.sucursal));

      const totalEnvios = Array.from(acc.values()).reduce((s, r) => s + safeNum(r.n), 0);
      const sumaCostos = Array.from(acc.values()).reduce((s, r) => s + safeNum(r.sum), 0);
      const totalEnviosPositivos = Array.from(acc.values()).reduce((s, r) => s + safeNum(r.nPos), 0);
      const sumaCostosPositivos = Array.from(acc.values()).reduce((s, r) => s + safeNum(r.sumPos), 0);

      deliveryPromedioGlobal = {
        envios: totalEnvios,
        promedio_bs: totalEnvios ? +(sumaCostos / totalEnvios).toFixed(2) : 0,
        promedio_sin_ceros_bs: totalEnviosPositivos ? +(sumaCostosPositivos / totalEnviosPositivos).toFixed(2) : 0,
      };
    }

    // ------------- 3B) Costo por entrega promedio (operativo) -------------
    const costoEntregaPromedioPorSucursal: any[] = [];
    let costoEntregaPromedioGlobal: any = {};
    {
      const gastos = await ReportsRepository.fetchGastosOperativosEnRango({ start, end, sucursalIds });
      const costosMap = new Map<string, { sucursalId: string; sucursalNombre: string; costos: number }>();
      let totalCostos = 0;

      for (const g of gastos as any[]) {
        const mesGasto = g?.fecha ? moment.tz(g.fecha, TZ).format("YYYY-MM") : "";
        if (mesGasto && !mesSet.has(mesGasto)) continue;
        const rawId = g?.id_sucursal?._id || g?.id_sucursal || "";
        const sucId = rawId ? String(rawId) : "sin_sucursal";
        const sucNombre = g?.id_sucursal?.nombre || (rawId ? (sucMap.get(String(rawId)) || "") : "Sin Sucursal");
        if (rawId) pushSucursal(String(rawId), sucNombre);

        const got = costosMap.get(sucId) || { sucursalId: sucId, sucursalNombre: sucNombre || "Sin Sucursal", costos: 0 };
        const monto = safeNum(g?.monto);
        got.costos += monto;
        totalCostos += monto;
        costosMap.set(sucId, got);
      }

      const entregasMap = new Map<string, number>();
      let totalEntregas = 0;
      for (const p of pedidosFlat) {
        if (isVentaDirectaLike(p)) continue;
        const sucId = p.sucursalId ? String(p.sucursalId) : "sin_sucursal";
        entregasMap.set(sucId, (entregasMap.get(sucId) || 0) + 1);
        totalEntregas += 1;
      }

      const keys = new Set<string>([...costosMap.keys(), ...entregasMap.keys()]);
      for (const k of keys) {
        const costos = costosMap.get(k)?.costos || 0;
        const entregas = entregasMap.get(k) || 0;
        const nombre =
          k === "sin_sucursal"
            ? "Sin Sucursal"
            : (costosMap.get(k)?.sucursalNombre || sucMap.get(k) || "");

        costoEntregaPromedioPorSucursal.push({
          id_sucursal: k === "sin_sucursal" ? null : k,
          sucursal: nombre,
          costos_operativos_bs: +costos.toFixed(2),
          entregas,
          costo_entrega_promedio_bs: entregas ? +(costos / entregas).toFixed(2) : 0,
        });
      }

      costoEntregaPromedioPorSucursal.sort((a, b) => a.sucursal.localeCompare(b.sucursal));
      costoEntregaPromedioGlobal = {
        costos_operativos_bs: +totalCostos.toFixed(2),
        entregas: totalEntregas,
        costo_entrega_promedio_bs: totalEntregas ? +(totalCostos / totalEntregas).toFixed(2) : 0,
      };
    }

    // ------------- 4) Clientes atendidos por hora (L–S) por sucursal -------------
    const clientesPorHoraMensual: any[] = [];
    const clientesPorHoraDetalle: any[] = [];
    {
      const acc = new Map<string, number>(); // sucursalId|hora

      for (const p of pedidosFlat) {
        const base = parseFechaPreservandoHoraOriginal(p.fecha);
        if (!base) continue;
        const dow = base.isoWeekday(); // 1=Lunes ... 7=Domingo
        if (dow < 1 || dow > 6) continue; // L–S
        const hora = base.hour();
        const key = `${p.sucursalId}|${hora}`;
        acc.set(key, (acc.get(key) || 0) + 1);
        clientesPorHoraDetalle.push({
          id_sucursal: p.sucursalId || "",
          sucursal: p.sucursalNombre || sucMap.get(String(p.sucursalId || "")) || "",
          id_pedido: p._id || "",
          fecha: p.fecha || null,
          hora: `${String(hora).padStart(2, "0")}:00`,
          cliente: p.cliente || "",
          telefono_cliente: p.telefono_cliente || "",
          estado_pedido: p.estado_pedido || "",
          observaciones: p.observaciones || "",
        });
      }

      for (const [sucId, sucNombre] of sucMap.entries()) {
        for (let h = 0; h < 24; h++) {
          const key = `${sucId}|${h}`;
          const count = acc.get(key) || 0;
          clientesPorHoraMensual.push({
            id_sucursal: sucId,
            sucursal: sucNombre,
            hora: `${String(h).padStart(2, "0")}:00`,
            clientes_atendidos: count,
          });
        }
      }

      clientesPorHoraMensual.sort((a, b) => a.sucursal.localeCompare(b.sucursal) || a.hora.localeCompare(b.hora));
      clientesPorHoraDetalle.sort(
        (a, b) =>
          a.sucursal.localeCompare(b.sucursal) ||
          a.hora.localeCompare(b.hora) ||
          String(a.id_pedido).localeCompare(String(b.id_pedido)),
      );
    }

    // ------------- 4B) Ventas por hora (todos los dias) por sucursal -------------
    const ventasPorHoraPorSucursal: any[] = [];
    const ventasPorHoraEntregasPorSucursal: any[] = [];
    const ventasPorHoraVentasPorSucursal: any[] = [];
    const ventasPorHoraDetalle: any[] = [];
    {
      const accTotal = new Map<string, number>(); // sucursalId|hora
      const accEntregas = new Map<string, number>(); // sucursalId|hora
      const accVentas = new Map<string, number>(); // sucursalId|hora

      for (const p of pedidosFlat) {
        // Usa la hora UTC tal cual viene en la BD (sin ajustar a zona local del servidor)
        const base = parseFechaPreservandoHoraOriginal(p.fecha);
        if (!base) continue;
        const hora = base.hour();
        const key = `${p.sucursalId}|${hora}`;
        accTotal.set(key, (accTotal.get(key) || 0) + 1);

        const estado = String(p.estado_pedido || "").trim().toLowerCase();
        if (estado === "entregado") {
          accEntregas.set(key, (accEntregas.get(key) || 0) + 1);
        } else if (estado === "interno") {
          accVentas.set(key, (accVentas.get(key) || 0) + 1);
        }

        ventasPorHoraDetalle.push({
          id_pedido: String(p._id || ""),
          hora,
        });
      }

      for (const [sucId, sucNombre] of sucMap.entries()) {
        const rowsTotal: any[] = [];
        const rowsEntregas: any[] = [];
        const rowsVentas: any[] = [];
        for (let h = 0; h < 24; h++) {
          const key = `${sucId}|${h}`;
          rowsTotal.push({
            id_sucursal: sucId,
            sucursal: sucNombre,
            hora: h,
            ventas: accTotal.get(key) || 0,
          });
          rowsEntregas.push({
            id_sucursal: sucId,
            sucursal: sucNombre,
            hora: h,
            ventas: accEntregas.get(key) || 0,
          });
          rowsVentas.push({
            id_sucursal: sucId,
            sucursal: sucNombre,
            hora: h,
            ventas: accVentas.get(key) || 0,
          });
        }

        rowsTotal.sort((a, b) => b.ventas - a.ventas || a.hora - b.hora);
        rowsEntregas.sort((a, b) => b.ventas - a.ventas || a.hora - b.hora);
        rowsVentas.sort((a, b) => b.ventas - a.ventas || a.hora - b.hora);

        rowsTotal.forEach((r, idx) => {
          ventasPorHoraPorSucursal.push({ ...r, rank: idx + 1 });
        });
        rowsEntregas.forEach((r, idx) => {
          ventasPorHoraEntregasPorSucursal.push({ ...r, rank: idx + 1 });
        });
        rowsVentas.forEach((r, idx) => {
          ventasPorHoraVentasPorSucursal.push({ ...r, rank: idx + 1 });
        });
      }

      ventasPorHoraPorSucursal.sort(
        (a, b) => a.sucursal.localeCompare(b.sucursal) || a.rank - b.rank,
      );
      ventasPorHoraEntregasPorSucursal.sort(
        (a, b) => a.sucursal.localeCompare(b.sucursal) || a.rank - b.rank,
      );
      ventasPorHoraVentasPorSucursal.sort(
        (a, b) => a.sucursal.localeCompare(b.sucursal) || a.rank - b.rank,
      );

      ventasPorHoraDetalle.sort((a, b) => a.hora - b.hora || a.id_pedido.localeCompare(b.id_pedido));
    }

    // ------------- 5) Ticket promedio por vendedor (servicios) -------------
    let ticketPromedioPorSucursal: any[] = [];
    let ticketPromedioGlobal: any = {};
    {
      const servicioRows = Array.from(vendedoresServicioMensualMap.values());
      const ticketRowsMap = new Map<
        string,
        {
          mes: string;
          id_sucursal: string;
          sucursal: string;
          id_vendedor: string;
          pago_fijo_bs: number;
          comision_bs: number;
        }
      >();

      for (const row of servicioRows) {
        const key = `${row.mes}|${row.id_sucursal}|${row.id_vendedor}`;
        if (!ticketRowsMap.has(key)) {
          ticketRowsMap.set(key, {
            mes: row.mes,
            id_sucursal: row.id_sucursal,
            sucursal: row.sucursal,
            id_vendedor: row.id_vendedor,
            pago_fijo_bs: 0,
            comision_bs: 0,
          });
        }

        ticketRowsMap.get(key)!.pago_fijo_bs += safeNum(row.servicios_total_bs);
      }

      for (const row of comisionMensualPorVendedorMap.values()) {
        const key = `${row.mes}|${row.id_sucursal}|${row.id_vendedor}`;
        const existing = ticketRowsMap.get(key);
        if (!existing) continue;
        existing.comision_bs += safeNum(row.comision_bs);
      }

      const resolveSelectedTicketTotal = (row: { pago_fijo_bs: number; comision_bs: number }) => {
        if (selectedTicketPromedioMode === "comision") return safeNum(row.comision_bs);
        if (selectedTicketPromedioMode === "pago_fijo_mas_comision") {
          return safeNum(row.pago_fijo_bs) + safeNum(row.comision_bs);
        }
        return safeNum(row.pago_fijo_bs);
      };

      const acc = new Map<
        string,
        {
          mes: string;
          id_sucursal: string;
          sucursal: string;
          vendedores_activos: number;
          total_servicios_bs: number;
          total_comision_bs: number;
          total_ticket_bs: number;
        }
      >();
      const global = new Set<string>();
      let totalServiciosGlobal = 0;
      let totalComisionGlobal = 0;

      for (const row of ticketRowsMap.values()) {
        const key = `${row.mes}|${row.id_sucursal}`;
        const got = acc.get(key) || {
          mes: row.mes,
          id_sucursal: row.id_sucursal,
          sucursal: row.sucursal,
          vendedores_activos: 0,
          total_servicios_bs: 0,
          total_comision_bs: 0,
          total_ticket_bs: 0,
        };

        got.vendedores_activos += 1;
        got.total_servicios_bs += safeNum(row.pago_fijo_bs);
        got.total_comision_bs += safeNum(row.comision_bs);
        got.total_ticket_bs += resolveSelectedTicketTotal(row);
        acc.set(key, got);

        global.add(`${row.mes}|${row.id_vendedor}`);
        totalServiciosGlobal += safeNum(row.pago_fijo_bs);
        totalComisionGlobal += safeNum(row.comision_bs);
      }

      ticketPromedioPorSucursal = Array.from(acc.values())
        .map((r) => ({
          ...r,
          total_servicios_bs: +r.total_servicios_bs.toFixed(2),
          total_comision_bs: +r.total_comision_bs.toFixed(2),
          total_ticket_bs: +r.total_ticket_bs.toFixed(2),
          ticket_promedio_modo: selectedTicketPromedioMode,
          ticket_promedio_bs: r.vendedores_activos ? +(r.total_ticket_bs / r.vendedores_activos).toFixed(2) : 0,
        }))
        .sort((a, b) => a.mes.localeCompare(b.mes) || a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal));

      const totalVendedores = global.size;
      const promedioPorSucursal = new Map<string, { suma_ticket_bs: number; filas: number }>();

      for (const row of ticketPromedioPorSucursal) {
        const idSucursal = String(row.id_sucursal || "").trim();
        if (!idSucursal) continue;
        const got = promedioPorSucursal.get(idSucursal) || { suma_ticket_bs: 0, filas: 0 };
        got.suma_ticket_bs += safeNum(row.ticket_promedio_bs);
        got.filas += 1;
        promedioPorSucursal.set(idSucursal, got);
      }

      const sucursalesConsideradas = promedioPorSucursal.size;
      const sumaPromediosSucursal = Array.from(promedioPorSucursal.values()).reduce((sum, item) => {
        const promedioSucursal = item.filas ? item.suma_ticket_bs / item.filas : 0;
        return sum + promedioSucursal;
      }, 0);

      ticketPromedioGlobal = {
        vendedores_activos: totalVendedores,
        sucursales: sucursalesConsideradas,
        total_servicios_bs: +totalServiciosGlobal.toFixed(2),
        total_comision_bs: +totalComisionGlobal.toFixed(2),
        total_ticket_bs:
          selectedTicketPromedioMode === "comision"
            ? +totalComisionGlobal.toFixed(2)
            : selectedTicketPromedioMode === "pago_fijo_mas_comision"
              ? +(totalServiciosGlobal + totalComisionGlobal).toFixed(2)
              : +totalServiciosGlobal.toFixed(2),
        ticket_promedio_modo: selectedTicketPromedioMode,
        ticket_promedio_bs: sucursalesConsideradas ? +(sumaPromediosSucursal / sucursalesConsideradas).toFixed(2) : 0,
      };
    }


    // ------------- 5B) Ticket promedio de clientes (por sucursal y global) -------------
    let ticketPromedioClientesPorSucursal: any[] = [];
    let ticketPromedioClientesGlobal: any = {};
    {
      const acc = new Map<string, { id_sucursal: string; sucursal: string; pedidos: number; monto_total_bs: number }>();

      for (const p of pedidosFlat) {
        const idSucursal = p.sucursalId ? String(p.sucursalId) : "sin_sucursal";
        const sucursalNombre = p.sucursalNombre || sucMap.get(idSucursal) || "Sin Sucursal";
        const totalCobrado = safeNum(p.totalCobrado);

        const got = acc.get(idSucursal) || {
          id_sucursal: idSucursal === "sin_sucursal" ? "" : idSucursal,
          sucursal: sucursalNombre,
          pedidos: 0,
          monto_total_bs: 0,
        };

        got.pedidos += 1;
        got.monto_total_bs += totalCobrado;
        acc.set(idSucursal, got);
      }

      ticketPromedioClientesPorSucursal = Array.from(acc.values())
        .map((r) => ({
          id_sucursal: r.id_sucursal,
          sucursal: r.sucursal,
          pedidos: r.pedidos,
          monto_total_bs: +r.monto_total_bs.toFixed(2),
          ticket_promedio_bs: r.pedidos ? +(r.monto_total_bs / r.pedidos).toFixed(2) : 0,
        }))
        .sort((a, b) => a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal));

      const pedidos = ticketPromedioClientesPorSucursal.reduce((s, r) => s + safeNum(r.pedidos), 0);
      const montoTotal = ticketPromedioClientesPorSucursal.reduce((s, r) => s + safeNum(r.monto_total_bs), 0);

      ticketPromedioClientesGlobal = {
        pedidos,
        monto_total_bs: +montoTotal.toFixed(2),
        ticket_promedio_bs: pedidos ? +(montoTotal / pedidos).toFixed(2) : 0,
      };
    }
    // ------------- 5C) Entregas externas realizadas por sucursal -------------
    let entregasExternasRealizadasPorSucursal: any[] = [];
    let entregasExternasRealizadasGlobal: any = {};
    {
      const externalSales = await ReportsRepository.fetchEntregasExternasRealizadasEnRango({
        start,
        end,
        sucursalIds,
      });

      const acc = new Map<string, { id_sucursal: string; sucursal: string; cantidad_paquetes: number; monto_cobrado_bs: number }>();
      let totalPaquetes = 0;
      let totalMontoCobrado = 0;

      for (const sale of externalSales as any[]) {
        const fechaBase = sale?.hora_entrega_real || sale?.fecha_pedido;
        const mesEntrega = fechaBase ? moment.tz(fechaBase, TZ).format("YYYY-MM") : "";
        if (!mesEntrega || !mesSet.has(mesEntrega)) continue;

        const rawSucursalId = sale?.sucursal?._id || sale?.sucursal || "";
        const idSucursal = rawSucursalId ? String(rawSucursalId) : "sin_sucursal";
        const sucursal = sale?.sucursal?.nombre || sucMap.get(idSucursal) || "Sin Sucursal";
        if (rawSucursalId) pushSucursal(String(rawSucursalId), sucursal);

        const montoCobrado = safeNum(sale?.monto_paga_vendedor) + safeNum(sale?.monto_paga_comprador);
        const got = acc.get(idSucursal) || {
          id_sucursal: idSucursal === "sin_sucursal" ? "" : idSucursal,
          sucursal,
          cantidad_paquetes: 0,
          monto_cobrado_bs: 0,
        };

        got.cantidad_paquetes += 1;
        got.monto_cobrado_bs += montoCobrado;
        acc.set(idSucursal, got);

        totalPaquetes += 1;
        totalMontoCobrado += montoCobrado;
      }

      entregasExternasRealizadasPorSucursal = Array.from(acc.values())
        .map((row) => ({
          ...row,
          monto_cobrado_bs: +row.monto_cobrado_bs.toFixed(2),
        }))
        .sort((a, b) => a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal));

      entregasExternasRealizadasGlobal = {
        cantidad_paquetes: totalPaquetes,
        monto_cobrado_bs: +totalMontoCobrado.toFixed(2),
      };
    }
    // ------------- 6) Clientes activos (por sucursal y global) -------------
    let clientesActivosPorSucursal: any[] = [];
    let clientesActivosGlobal: any = {};
    {
      const porSuc = new Map<string, { sucursal: string; vendedores: Set<string> }>();
      const global = new Set<string>();

      for (const row of vendedoresServicioMensualMap.values()) {
        const idSucursal = String(row.id_sucursal || "").trim();
        const sucursal = String(row.sucursal || sucMap.get(idSucursal) || "").trim();
        const idVendedor = String(row.id_vendedor || "").trim();
        if (!idSucursal || !sucursal || !idVendedor) continue;

        global.add(idVendedor);
        const got = porSuc.get(idSucursal) || { sucursal, vendedores: new Set<string>() };
        got.vendedores.add(idVendedor);
        porSuc.set(idSucursal, got);
      }

      for (const [sId, got] of porSuc.entries()) {
        clientesActivosPorSucursal.push({
          id_sucursal: sId,
          sucursal: got.sucursal,
          clientes_activos: got.vendedores.size,
        });
      }

      clientesActivosPorSucursal.sort((a, b) => a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal));
      clientesActivosGlobal = { clientes_activos: global.size };
    }

    // ------------- 6B) Clientes nuevos por mes y sucursal -------------
    let clientesNuevosPorSucursal: any[] = [];
    let clientesNuevosGlobal: any = {};
    const clientesNuevosDetalle: any[] = [];
    {
      const vendedores = await ReportsRepository.fetchVendedoresConPagoSucursales();
      const acc = new Map<
        string,
        { mes: string; id_sucursal: string; sucursal: string; tipo: "nuevo" | "ampliacion"; clientes_nuevos: number }
      >();
      const globalNuevos = new Set<string>();
      const globalAmpliaron = new Set<string>();

      for (const ven of vendedores as any[]) {
        const idVendedor = String(ven._id || "").trim();
        if (!idVendedor) continue;

        const pagosRaw = Array.isArray(ven.pago_sucursales) ? ven.pago_sucursales : [];
        const earliestBySucursal = new Map<string, any>();

        for (const pago of pagosRaw) {
          const idSucursal = pago?.id_sucursal ? String(pago.id_sucursal) : "";
          const sucursal = String(pago?.sucursalName || sucMap.get(idSucursal) || "").trim();
          const fechaIngreso = pago?.fecha_ingreso ? moment.tz(pago.fecha_ingreso, TZ) : null;
          if (!idSucursal || !sucursal || !fechaIngreso?.isValid()) continue;

          const current = earliestBySucursal.get(idSucursal);
          if (!current || fechaIngreso.isBefore(current.fechaIngreso)) {
            earliestBySucursal.set(idSucursal, {
              id_sucursal: idSucursal,
              sucursal,
              fechaIngreso,
            });
          }
        }

        const ingresosOrdenados = Array.from(earliestBySucursal.values()).sort(
          (a, b) =>
            a.fechaIngreso.valueOf() - b.fechaIngreso.valueOf() ||
            String(a.id_sucursal).localeCompare(String(b.id_sucursal)),
        );

        const primeraFechaIngreso = ingresosOrdenados[0]?.fechaIngreso
          ? ingresosOrdenados[0].fechaIngreso.clone().startOf("day")
          : null;

        ingresosOrdenados.forEach((ingreso) => {
          if (ingreso.fechaIngreso.isBefore(start) || !ingreso.fechaIngreso.isBefore(end)) return;
          if (sucursalIds?.length && !sucursalIds.includes(String(ingreso.id_sucursal))) return;

          const mes = ingreso.fechaIngreso.format("YYYY-MM");
          const tipo = (
            primeraFechaIngreso && ingreso.fechaIngreso.clone().startOf("day").isSame(primeraFechaIngreso)
              ? "nuevo"
              : "ampliacion"
          ) as "nuevo" | "ampliacion";
          const key = `${mes}|${ingreso.id_sucursal}|${tipo}`;
          const got = acc.get(key) || {
            mes,
            id_sucursal: ingreso.id_sucursal,
            sucursal: ingreso.sucursal,
            tipo,
            clientes_nuevos: 0,
          };

          got.clientes_nuevos += 1;
          acc.set(key, got);

          if (tipo === "nuevo") globalNuevos.add(idVendedor);
          else globalAmpliaron.add(idVendedor);

          clientesNuevosDetalle.push({
            mes,
            tipo,
            id_sucursal: ingreso.id_sucursal,
            sucursal: ingreso.sucursal,
            id_vendedor: idVendedor,
            vendedor: `${ven.nombre || ""} ${ven.apellido || ""}`.trim(),
            mail: ven.mail || "",
            telefono: ven.telefono != null ? String(ven.telefono) : "",
            fecha_ingreso: ingreso.fechaIngreso.toDate(),
          });
        });
      }

      clientesNuevosPorSucursal = Array.from(acc.values()).sort(
        (a, b) =>
          a.mes.localeCompare(b.mes) ||
          a.sucursal.localeCompare(b.sucursal) ||
          a.tipo.localeCompare(b.tipo) ||
          a.id_sucursal.localeCompare(b.id_sucursal),
      );

      clientesNuevosDetalle.sort(
        (a, b) =>
          a.mes.localeCompare(b.mes) ||
          a.sucursal.localeCompare(b.sucursal) ||
          a.tipo.localeCompare(b.tipo) ||
          String(a.fecha_ingreso || "").localeCompare(String(b.fecha_ingreso || "")) ||
          String(a.id_vendedor || "").localeCompare(String(b.id_vendedor || "")),
      );

      clientesNuevosGlobal = {
        clientes_nuevos: globalNuevos.size,
        clientes_ampliaron: globalAmpliaron.size,
      };
    }

    // ------------- 7) Vendedores activos (por sucursal) -------------
    let vendedoresActivosPorSucursal: any[] = [];
    {
      const rows = await ReportsRepository.fetchVendedoresActivosPorSucursalEnRango({
        start,
        end,
        sucursalIds,
      });

      vendedoresActivosPorSucursal = (rows as any[]).map((r) => ({
        id_sucursal: r.id_sucursal || "",
        sucursal: r.sucursal || sucMap.get(String(r.id_sucursal || "")) || "",
        vendedores_activos: typeof r.vendedores_activos === "number" ? r.vendedores_activos : 0,
      }));

      vendedoresActivosPorSucursal.sort(
        (a, b) => a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal),
      );
    }

    // ------------- 8) Numero de ventas por sucursal (detalle y total) -------------
    let numeroVentasPorSucursal: any[] = [];
    let numeroVentasTotalPorSucursal: any[] = [];
    {
      numeroVentasPorSucursal = Array.from(ventasPorSucursalAcc.values()).map((r) => ({
        id_sucursal: r.sucursalId,
        sucursal: r.sucursalNombre || "",
        ventas_directas: r.ventas_directas,
        entregas_entregadas: r.entregas_entregadas,
      }));

      numeroVentasPorSucursal.sort((a, b) => a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal));

      numeroVentasTotalPorSucursal = numeroVentasPorSucursal.map((r) => ({
        id_sucursal: r.id_sucursal,
        sucursal: r.sucursal,
        ventas_totales: safeNum(r.ventas_directas) + safeNum(r.entregas_entregadas),
      }));

      numeroVentasTotalPorSucursal.sort((a, b) => a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal));
    }

    // ------------- 9) Monto vendido (mensual y por sucursal) -------------
    const ventasMensualPorSucursal: any[] = [];
    const ventasMensualPorSucursalDetalle: any[] = [];
    {
      const acc = new Map<
        string,
        { sucursalId: string; sucursalNombre: string; mes: string; monto: number; ventas: number }
      >();

      for (const p of pedidosFlat) {
        const sucursalId = String(p.sucursalId || "").trim();
        const sucursalNombre = String(p.sucursalNombre || sucMap.get(sucursalId) || "").trim();
        if (!sucursalId || !sucursalNombre) continue;

        const mes = String(p.mes || "").trim();
        if (!mes) continue;

        const totalCobrado = safeNum(p.totalCobrado);
        const k = `${sucursalId}|${mes}`;
        const got = acc.get(k) || {
          sucursalId,
          sucursalNombre,
          mes,
          monto: 0,
          ventas: 0,
        };

        got.monto += totalCobrado;
        got.ventas += 1;
        acc.set(k, got);

        ventasMensualPorSucursalDetalle.push({
          mes,
          id_sucursal: sucursalId,
          sucursal: sucursalNombre,
          id_pedido: p._id || "",
          fecha: p.fecha || null,
          cliente: p.cliente || "",
          telefono_cliente: p.telefono_cliente || "",
          estado_pedido: p.estado_pedido || "",
          observaciones: p.observaciones || "",
          monto_bs: +totalCobrado.toFixed(2),
        });
      }

      for (const a of acc.values()) {
        ventasMensualPorSucursal.push({
          mes: a.mes,
          id_sucursal: a.sucursalId,
          sucursal: a.sucursalNombre,
          ventas: a.ventas,
          monto_bs: +a.monto.toFixed(2),
        });
      }

      ventasMensualPorSucursal.sort(
        (a, b) => a.mes.localeCompare(b.mes) || a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal),
      );
      ventasMensualPorSucursalDetalle.sort(
        (a, b) =>
          a.mes.localeCompare(b.mes) ||
          a.sucursal.localeCompare(b.sucursal) ||
          String(a.fecha || "").localeCompare(String(b.fecha || "")) ||
          String(a.id_pedido || "").localeCompare(String(b.id_pedido || "")),
      );
    }

    return {
      meses: mesesSeleccionados,
      topProductosPorSucursal,
      topGlobal,
      deliveryPromedioPorSucursal,
      deliveryPromedioGlobal,
      costoEntregaPromedioPorSucursal,
      costoEntregaPromedioGlobal,
      clientesPorHoraMensual,
      clientesPorHoraDetalle,
      ventasPorHoraPorSucursal,
      ventasPorHoraEntregasPorSucursal,
      ventasPorHoraVentasPorSucursal,
      ventasPorHoraDetalle,
      ticketPromedioModo: selectedTicketPromedioMode,
      ticketPromedioPorSucursal,
      ticketPromedioGlobal,
      ticketPromedioClientesPorSucursal,
      ticketPromedioClientesGlobal,
      entregasExternasRealizadasPorSucursal,
      entregasExternasRealizadasGlobal,
      clientesActivosPorSucursal,
      clientesActivosGlobal,
      clientesNuevosPorSucursal,
      clientesNuevosGlobal,
      clientesNuevosDetalle,
      vendedoresActivosPorSucursal,
      numeroVentasPorSucursal,
      numeroVentasTotalPorSucursal,
      ventasMensualPorSucursal,
      ventasMensualPorSucursalDetalle,
    };
  },

  async getComisionesPorMeses({ mes, meses, sucursalIds }: Params) {
    const mesesSeleccionados = normalizeMeses(mes, meses);
    const { start, end } = rangeMeses(mesesSeleccionados);
    const mesSet = new Set(mesesSeleccionados);
    const pedidos = await ReportsRepository.fetchPedidosConVentasEnRango({ start, end, sucursalIds });

    const acc = new Map<string, { mes: string; id_sucursal: string; sucursal: string; comision_bs: number }>();
    const sucMap = new Map<string, string>();

    for (const p of pedidos as any[]) {
      const fecha = p.hora_entrega_real || p.fecha_pedido;
      if (!fecha) continue;
      const mesPedido = moment.tz(fecha, TZ).format("YYYY-MM");
      if (!mesSet.has(mesPedido)) continue;

      const { id: sucursalId, nombre: sucursalNombre } = getSucursalFromPedido(p);
      if (!sucursalId || !String(sucursalNombre || "").trim()) continue;
      sucMap.set(sucursalId, sucursalNombre);

      const ventas = Array.isArray(p.venta) ? p.venta : [];
      for (const v of ventas) {
        const utilidad = safeNum(v?.utilidad);
        const key = `${mesPedido}|${sucursalId}`;
        const got = acc.get(key) || {
          mes: mesPedido,
          id_sucursal: sucursalId,
          sucursal: sucursalNombre,
          comision_bs: 0,
        };
        got.comision_bs += utilidad;
        acc.set(key, got);
      }
    }

    const rows = Array.from(acc.values())
      .map((r) => ({ ...r, comision_bs: +r.comision_bs.toFixed(2) }))
      .sort((a, b) => a.mes.localeCompare(b.mes) || a.sucursal.localeCompare(b.sucursal) || a.id_sucursal.localeCompare(b.id_sucursal));

    const totalesPorMes = mesesSeleccionados.map((m) => ({
      mes: m,
      comision_bs: +rows.filter((r) => r.mes === m).reduce((s, r) => s + safeNum(r.comision_bs), 0).toFixed(2),
    }));

    const totalGeneral = {
      comision_bs: +rows.reduce((s, r) => s + safeNum(r.comision_bs), 0).toFixed(2),
      sucursales: new Set(rows.map((r) => r.id_sucursal)).size,
    };

    return { meses: mesesSeleccionados, rows, totalesPorMes, totalGeneral };
  },

  async getIngresosPorMeses({ mes, meses, mesFin, incluirDeuda = false }: ExportIngresos3MParams) {
    const mesesSeleccionados = resolveMesesSeleccionados({ mes, meses, mesFin }, 4);
    const { start, end } = rangeMeses(mesesSeleccionados);
    const mesSet = new Set(mesesSeleccionados);
    const docs = await ReportsRepository.fetchIngresosFlujoEnRango({ start, end });

    const detalle = (docs as any[])
      .map((d) => {
        const mesRow = d.fecha ? moment.utc(d.fecha).format("YYYY-MM") : "";
        return {
          mes: mesRow,
          fecha: d.fecha || null,
          categoria: d.categoria || "",
          concepto: d.concepto || "",
          monto_bs: typeof d.monto === "number" ? +d.monto.toFixed(2) : 0,
          esDeuda: !!d.esDeuda,
          id_vendedor: d.id_vendedor ? String(d.id_vendedor) : "",
          id_trabajador: d.id_trabajador ? String(d.id_trabajador) : "",
        };
      })
      .filter((r) => r.mes && mesSet.has(r.mes))
      .filter((r) => incluirDeuda || !r.esDeuda)
      .sort((a, b) => a.mes.localeCompare(b.mes) || String(a.fecha || "").localeCompare(String(b.fecha || "")));

    const totalesPorMes = mesesSeleccionados.map((m) => ({
      mes: m,
      monto_bs: +detalle.filter((r) => r.mes === m).reduce((s, r) => s + safeNum(r.monto_bs), 0).toFixed(2),
    }));

    const totalGlobal = {
      monto_bs: +totalesPorMes.reduce((s, r) => s + safeNum(r.monto_bs), 0).toFixed(2),
      movimientos: detalle.length,
    };

    return { meses: mesesSeleccionados, detalle, totalesPorMes, totalGlobal };
  },

  async getClientesActivosServicio({ mes, meses, mesFin }: ExportClientesActivosParams) {
    const mesesSeleccionados = resolveMesesSeleccionados({ mes, meses, mesFin }, 3);
    const { start, end } = rangeMeses(mesesSeleccionados);
    const vendedores = await ReportsRepository.fetchVendedoresConPagoSucursales();
    const ventas = await ReportsRepository.fetchVentas3MPorVendedor({ start, end });

    const ventasMap = new Map<string, Map<string, number>>();
    for (const v of ventas as any[]) {
      const vid = String(v.id_vendedor || "");
      const mesRow = String(v.mes || "");
      if (!vid || !mesesSeleccionados.includes(mesRow)) continue;
      if (!ventasMap.has(vid)) ventasMap.set(vid, new Map(mesesSeleccionados.map((m) => [m, 0])));
      ventasMap.get(vid)!.set(mesRow, (ventasMap.get(vid)!.get(mesRow) || 0) + safeNum(v.monto_bs));
    }

    const sucursalesSet = new Set<string>();
    const vendedoresActivos = (vendedores as any[])
      .map((ven) => {
        const id = String(ven._id || "").trim();
        if (!id) return null;

        const vigencia = ven.fecha_vigencia ? moment.tz(ven.fecha_vigencia, TZ).endOf("day") : null;
        const pagos = Array.isArray(ven.pago_sucursales) ? ven.pago_sucursales : [];
        const mesesActivos = new Set<string>();
        const psMap = new Map<string, any>();

        for (const ps of pagos) {
          if (ps?.activo === false) continue;

          const sucursal = String(ps?.sucursalName || "").trim();
          if (!sucursal) continue;

          const fechaIngreso = ps?.fecha_ingreso ? moment.tz(ps.fecha_ingreso, TZ).startOf("day") : null;
          const fechaSalida = ps?.fecha_salida ? moment.tz(ps.fecha_salida, TZ).endOf("day") : null;

          for (const mesSel of mesesSeleccionados) {
            const monthStart = moment.tz(`${mesSel}-01 00:00:00`, TZ).startOf("month");
            const monthEnd = monthStart.clone().endOf("month");

            if (vigencia && vigencia.isBefore(monthStart)) continue;
            if (fechaIngreso && fechaIngreso.isAfter(monthEnd)) continue;
            if (fechaSalida && fechaSalida.isBefore(monthStart)) continue;

            mesesActivos.add(mesSel);
            sucursalesSet.add(sucursal);
            if (!psMap.has(sucursal)) psMap.set(sucursal, ps);
          }
        }

        if (mesesActivos.size === 0) return null;

        return {
          ven,
          id,
          mesesActivos,
          psMap,
        };
      })
      .filter(Boolean) as Array<{ ven: any; id: string; mesesActivos: Set<string>; psMap: Map<string, any> }>;

    const sucursales = Array.from(sucursalesSet).sort();

    const rows = vendedoresActivos
      .map(({ ven, id, mesesActivos, psMap }) => {
        const nombreCompleto = `${ven.nombre || ""} ${ven.apellido || ""}`.trim();
        const byMes = ventasMap.get(id) || new Map(mesesSeleccionados.map((m) => [m, 0]));
        const totalPeriodo = mesesSeleccionados.reduce((s, m) => s + (byMes.get(m) || 0), 0);

        const planesCols: Record<string, any> = {};
        for (const s of sucursales) {
          const ps = psMap.get(s);
          planesCols[`${s} - Activo`] = !!ps;
          planesCols[`${s} - Alquiler`] = safeNum(ps?.alquiler);
          planesCols[`${s} - Exhibicion`] = safeNum(ps?.exhibicion);
          planesCols[`${s} - Delivery`] = safeNum(ps?.delivery);
          planesCols[`${s} - EntregaSimple`] = safeNum(ps?.entrega_simple);
        }

        return {
          id_cliente: id,
          cliente: nombreCompleto,
          mail: ven.mail || "",
          telefono: ven.telefono || "",
          fecha_vigencia: ven.fecha_vigencia || null,
          comision_porcentual: safeNum(ven.comision_porcentual),
          comision_fija: safeNum(ven.comision_fija),
          meses_activos: Array.from(mesesActivos).sort().join(", "),
          cantidad_meses_activos: mesesActivos.size,
          sucursales_activas: Array.from(psMap.keys()).sort().join(", "),
          cantidad_sucursales_activas: psMap.size,
          ...Object.fromEntries(mesesSeleccionados.map((m) => [m, +((byMes.get(m) || 0).toFixed(2))])),
          total_periodo_bs: +totalPeriodo.toFixed(2),
          ...planesCols,
        };
      })
      .sort((a, b) => String(a.cliente || "").localeCompare(String(b.cliente || "")) || String(a.id_cliente || "").localeCompare(String(b.id_cliente || "")));

    const totalesPorMes = mesesSeleccionados.map((m) => ({
      mes: m,
      clientes_activos: vendedoresActivos.reduce((sum, item) => sum + (item.mesesActivos.has(m) ? 1 : 0), 0),
    }));

    const resumen = {
      clientes_activos: rows.length,
      ...Object.fromEntries(totalesPorMes.map((r) => [r.mes, r.clientes_activos])),
      total_periodo_bs: +rows.reduce((s, r) => s + safeNum(r.total_periodo_bs), 0).toFixed(2),
    };

    return { meses: mesesSeleccionados, resumen, totalesPorMes, rows };
  },

  async getVentasVendedoresPorMeses({ mes, meses, mesFin }: ExportVentasVendedoresParams) {
    const mesesSeleccionados = resolveMesesSeleccionados({ mes, meses, mesFin }, 4);
    const { start, end } = rangeMeses(mesesSeleccionados);
    const detalle = await ReportsRepository.fetchVentasDetalleEnRango({ start, end });

    type AccVendedor = {
      id_vendedor: string;
      vendedor: string;
      porMes: Map<string, { monto: number; unidades: number; prodCount: Map<string, number>; prodName: Map<string, string> }>;
      totalMonto: number;
      totalUnidades: number;
      totalProdCount: Map<string, number>;
      totalProdName: Map<string, string>;
    };

    const acc = new Map<string, AccVendedor>();

    for (const r of detalle as any[]) {
      const vid = String(r.id_vendedor || "");
      if (!vid || !r.fecha) continue;

      const mesRow = moment.tz(r.fecha, TZ).format("YYYY-MM");
      if (!mesesSeleccionados.includes(mesRow)) continue;

      const monto = safeNum(r.total_bs);
      const unidades = safeNum(r.cantidad);
      const pid = String(r.id_producto || "");
      const pname = String(r.producto || "");

      const got = acc.get(vid) || {
        id_vendedor: vid,
        vendedor: r.vendedor || vid,
        porMes: new Map(),
        totalMonto: 0,
        totalUnidades: 0,
        totalProdCount: new Map(),
        totalProdName: new Map(),
      };

      if (!got.porMes.has(mesRow)) {
        got.porMes.set(mesRow, { monto: 0, unidades: 0, prodCount: new Map(), prodName: new Map() });
      }

      const monthAcc = got.porMes.get(mesRow)!;
      monthAcc.monto += monto;
      monthAcc.unidades += unidades;
      if (pid) {
        monthAcc.prodCount.set(pid, (monthAcc.prodCount.get(pid) || 0) + unidades);
        if (pname) monthAcc.prodName.set(pid, pname);
      }

      got.totalMonto += monto;
      got.totalUnidades += unidades;
      if (pid) {
        got.totalProdCount.set(pid, (got.totalProdCount.get(pid) || 0) + unidades);
        if (pname) got.totalProdName.set(pid, pname);
      }

      acc.set(vid, got);
    }

    const topProducto = (prodCount: Map<string, number>, prodName: Map<string, string>) => {
      let topId = "";
      let topQty = -1;
      for (const [pid, qty] of prodCount.entries()) {
        if (qty > topQty) {
          topId = pid;
          topQty = qty;
        }
      }
      return {
        id: topId || "",
        nombre: topId ? prodName.get(topId) || "" : "",
      };
    };

    const resumen = Array.from(acc.values())
      .map((v) => {
        const row: any = {
          id_vendedor: v.id_vendedor,
          vendedor: v.vendedor,
        };

        for (const mesRow of mesesSeleccionados) {
          const mm = v.porMes.get(mesRow) || { monto: 0, unidades: 0, prodCount: new Map(), prodName: new Map() };
          const top = topProducto(mm.prodCount, mm.prodName);
          row[`${mesRow} - Total Ventas (Bs)`] = +mm.monto.toFixed(2);
          row[`${mesRow} - Total Unidades`] = mm.unidades;
          row[`${mesRow} - Top Producto Id`] = top.id;
          row[`${mesRow} - Top Producto`] = top.nombre;
        }

        const topTotal = topProducto(v.totalProdCount, v.totalProdName);
        row["TOTAL - Total Ventas (Bs)"] = +v.totalMonto.toFixed(2);
        row["TOTAL - Total Unidades"] = v.totalUnidades;
        row["TOTAL - Top Producto Id"] = topTotal.id;
        row["TOTAL - Top Producto"] = topTotal.nombre;

        return row;
      })
      .sort((a, b) => safeNum(b["TOTAL - Total Ventas (Bs)"]) - safeNum(a["TOTAL - Total Ventas (Bs)"]));

    const detalleFiltrado = (detalle as any[])
      .filter((r) => r.fecha && mesesSeleccionados.includes(moment.tz(r.fecha, TZ).format("YYYY-MM")))
      .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")) || String(a.id_venta || "").localeCompare(String(b.id_venta || "")));

    return { meses: mesesSeleccionados, resumen, detalle: detalleFiltrado };
  },

  async exportClientesStatusXlsx(_: ExportClientesStatusParams) {
    const vendedores = await ReportsRepository.fetchVendedoresConPagoSucursales();
    const today = moment.tz(TZ).startOf("day");

    const rows: any[] = [];

    for (const v of vendedores as any[]) {
      const vigencia = v.fecha_vigencia ? moment.tz(v.fecha_vigencia, TZ).endOf("day") : null;
      const vendedorActivo = !!vigencia && !vigencia.isBefore(today);

      const pagos = Array.isArray(v.pago_sucursales) ? v.pago_sucursales : [];
      for (const p of pagos) {
        const start = p?.fecha_ingreso ? moment.tz(p.fecha_ingreso, TZ).startOf("day") : null;
        const end = p?.fecha_salida ? moment.tz(p.fecha_salida, TZ).endOf("day") : null;

        const fueraDeRango =
          (start && start.isAfter(today)) ||
          (end && end.isBefore(today));

        const estadoSucursal = p?.activo !== false && !fueraDeRango;
        const activo = vendedorActivo && estadoSucursal;

        rows.push({
          id_vendedor: String(v._id || ""),
          vendedor: `${v.nombre || ""} ${v.apellido || ""}`.trim(),
          mail: v.mail || "",
          telefono: v.telefono || "",
          fecha_vigencia: v.fecha_vigencia || null,
          id_sucursal: p?.id_sucursal ? String(p.id_sucursal) : "",
          sucursal: p?.sucursalName || "",
          fecha_ingreso: p?.fecha_ingreso || null,
          fecha_salida: p?.fecha_salida || null,
          estado_sucursal: estadoSucursal ? "activo" : "inactivo",
          activo: !!activo,
        });
      }
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const ws = wb.addWorksheet("Clientes_Status");
    if (rows.length) {
      ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 24 }));
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(r));
    }

    const filename = `clientes_status.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);

    await wb.xlsx.writeFile(filePath);
    return { filePath, filename };
  },

  async exportVendedoresPagosSucursalesXlsx() {
    const [vendedores, sucursalesRaw] = await Promise.all([
      ReportsRepository.fetchVendedoresConPagoSucursales(),
      ReportsRepository.fetchSucursalesBasicas(),
    ]);
    const today = moment.tz(TZ).startOf("day");

    const sucursalesMap = new Map<string, string>();
    for (const suc of sucursalesRaw as any[]) {
      const id = String(suc?._id || "").trim();
      const nombre = String(suc?.nombre || "").trim();
      if (id) sucursalesMap.set(id, nombre || id);
    }

    for (const vendedor of vendedores as any[]) {
      const pagos = Array.isArray(vendedor?.pago_sucursales) ? vendedor.pago_sucursales : [];
      for (const pago of pagos) {
        const id = pago?.id_sucursal ? String(pago.id_sucursal).trim() : "";
        const nombre = String(pago?.sucursalName || "").trim();
        if (id && !sucursalesMap.has(id)) sucursalesMap.set(id, nombre || id);
      }
    }

    const sucursales = Array.from(sucursalesMap.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre) || a.id.localeCompare(b.id));

    const rows = (vendedores as any[])
      .map((vendedor) => {
        const estado = getSellerLifecycleStatus(vendedor?.fecha_vigencia);
        const pagos = Array.isArray(vendedor?.pago_sucursales) ? vendedor.pago_sucursales : [];
        const pagosPorSucursal = new Map<string, number>();

        for (const pago of pagos) {
          const idSucursal = pago?.id_sucursal ? String(pago.id_sucursal).trim() : "";
          if (!idSucursal || pago?.activo === false) continue;

          const fechaIngreso = pago?.fecha_ingreso ? moment.tz(pago.fecha_ingreso, TZ).startOf("day") : null;
          const fechaSalida = pago?.fecha_salida ? moment.tz(pago.fecha_salida, TZ).endOf("day") : null;
          const fueraDeRango =
            (fechaIngreso && fechaIngreso.isAfter(today)) ||
            (fechaSalida && fechaSalida.isBefore(today));
          if (fueraDeRango) continue;

          const pagoMensual =
            safeNum(pago?.alquiler) +
            safeNum(pago?.exhibicion) +
            safeNum(pago?.delivery) +
            safeNum(pago?.entrega_simple);

          pagosPorSucursal.set(idSucursal, (pagosPorSucursal.get(idSucursal) || 0) + pagoMensual);
        }

        const pagosCols: Record<string, number> = {};
        for (const sucursal of sucursales) {
          pagosCols[`${sucursal.nombre} - Pago mensual`] = +(pagosPorSucursal.get(sucursal.id) || 0).toFixed(2);
        }

        return {
          id_vendedor: String(vendedor?._id || ""),
          vendedor: `${vendedor?.nombre || ""} ${vendedor?.apellido || ""}`.trim(),
          estado: estado === "ya_no_es_cliente" ? "Inactivo" : "Activo",
          estado_detalle: estado,
          mail: vendedor?.mail || "",
          telefono: vendedor?.telefono || "",
          fecha_vigencia: vendedor?.fecha_vigencia || null,
          comision_porcentual: safeNum(vendedor?.comision_porcentual),
          comision_fija: safeNum(vendedor?.comision_fija),
          ...pagosCols,
        };
      })
      .sort((a, b) => String(a.vendedor || "").localeCompare(String(b.vendedor || "")));

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const ws = wb.addWorksheet("Vendedores_Pagos");
    const baseColumns = [
      { header: "Id Vendedor", key: "id_vendedor", width: 28 },
      { header: "Vendedor", key: "vendedor", width: 28 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Estado Detalle", key: "estado_detalle", width: 18 },
      { header: "Mail", key: "mail", width: 28 },
      { header: "Telefono", key: "telefono", width: 16 },
      { header: "Fecha Vigencia", key: "fecha_vigencia", width: 18 },
      { header: "Comision Porcentual", key: "comision_porcentual", width: 20 },
      { header: "Comision Fija", key: "comision_fija", width: 16 },
    ];
    const sucursalColumns = sucursales.map((sucursal) => ({
      header: `${sucursal.nombre} - Pago mensual`,
      key: `${sucursal.nombre} - Pago mensual`,
      width: Math.max(22, sucursal.nombre.length + 16),
    }));

    ws.columns = [...baseColumns, ...sucursalColumns];
    ws.getRow(1).font = { bold: true };
    rows.forEach((row) => ws.addRow(row));
    ws.getColumn("fecha_vigencia").numFmt = "dd/mm/yyyy";
    for (const column of sucursalColumns) {
      ws.getColumn(column.key).numFmt = '#,##0.00';
    }
    ws.getColumn("comision_porcentual").numFmt = '#,##0.00';
    ws.getColumn("comision_fija").numFmt = '#,##0.00';

    const filename = `vendedores_pagos_sucursales.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);

    await wb.xlsx.writeFile(filePath);
    return { filePath, filename };
  },

  async getInventarioActual({ idSucursal, sellerId }: InventoryParams) {
    if (!idSucursal) throw new Error("idSucursal es requerido");

    const vendedores = await ReportsRepository.fetchVendedoresConPagoSucursales();
    const today = moment.tz(TZ).startOf("day");
    const requestedSellerId = String(sellerId || "").trim();

    const sellerMeta = new Map<string, { vendedor: string; estado_cliente: "activo" | "debe_renovar" }>();

    for (const ven of vendedores as any[]) {
      const idVendedor = String(ven._id || "").trim();
      if (!idVendedor) continue;
      if (requestedSellerId && requestedSellerId !== idVendedor) continue;

      const estadoCliente = getSellerLifecycleStatus(ven.fecha_vigencia);
      if (estadoCliente === "ya_no_es_cliente") continue;

      const pagos = Array.isArray(ven.pago_sucursales) ? ven.pago_sucursales : [];

      const tieneSucursalActiva = pagos.some((pago: any) => {
        const idSucursalPago = pago?.id_sucursal ? String(pago.id_sucursal) : "";
        if (idSucursalPago !== idSucursal) return false;
        if (pago?.activo === false) return false;

        const start = pago?.fecha_ingreso ? moment.tz(pago.fecha_ingreso, TZ).startOf("day") : null;
        const end = pago?.fecha_salida ? moment.tz(pago.fecha_salida, TZ).endOf("day") : null;
        const fueraDeRango = (start && start.isAfter(today)) || (end && end.isBefore(today));
        return !fueraDeRango;
      });

      if (!tieneSucursalActiva) continue;

      sellerMeta.set(idVendedor, {
        vendedor: `${ven.nombre || ""} ${ven.apellido || ""}`.trim(),
        estado_cliente: estadoCliente,
      });
    }

    const sellerIds = Array.from(sellerMeta.keys());
    if (!sellerIds.length) {
      return {
        filtros: { id_sucursal: idSucursal, id_vendedor: requestedSellerId || null },
        resumen: { productos: 0, stock_actual: 0, unidades_en_espera: 0, stock_total_reportado: 0 },
        rows: [] as InventoryRow[],
      };
    }

    const [rowsRaw, pedidosEnEspera] = await Promise.all([
      ReportsRepository.fetchStockProductosPorSucursal({ idSucursal, sellerIds }),
      ReportsRepository.fetchPedidosEnEsperaPorSucursal({ idSucursal }),
    ]);

    const inventoryMap = new Map<string, InventoryRow>();
    const inventoryAliasMap = new Map<string, string>();

    for (const r of rowsRaw as any[]) {
      const idVendedor = String(r.id_vendedor || "").trim();
      const seller = sellerMeta.get(idVendedor);
      if (!seller) continue;

        const producto = String(r.nombre_producto || "");
        const variante = getInventoryDisplayVariant({
          variantes: r.variantes,
          baseName: producto,
        });
        const variantKey = String(r.variantKey || "").trim();
        const rowKey = resolveInventoryRowKey(inventoryAliasMap, {
          idProducto: r.id_producto,
          variantKey,
          variantes: r.variantes,
          variante,
          idVendedor,
          baseName: producto,
        });

        inventoryMap.set(rowKey, {
          id_producto: String(r.id_producto || ""),
          producto,
          variante,
          variant_key: variantKey,
          id_vendedor: idVendedor,
        vendedor: seller.vendedor || String(r.vendedor_nombre_completo || ""),
        estado_cliente: seller.estado_cliente,
        stock_actual: safeNum(r.stock),
        unidades_en_espera: 0,
        tiene_entregas_en_espera: false,
          stock_total_reportado: safeNum(r.stock),
          es_temporal: false,
        });
        registerInventoryAliases(inventoryAliasMap, rowKey, {
          idProducto: r.id_producto,
          variantKey,
          variantes: r.variantes,
          variante,
          idVendedor,
          baseName: producto,
        });
      }

    for (const pedido of pedidosEnEspera as any[]) {
      const ventas = Array.isArray(pedido?.venta) ? pedido.venta : [];
      const temporales = Array.isArray(pedido?.productos_temporales) ? pedido.productos_temporales : [];

      for (const venta of ventas) {
        const idVendedor = String(venta?.vendedor?._id || venta?.vendedor || "").trim();
        const seller = sellerMeta.get(idVendedor);
        if (!seller) continue;

        const idProducto = String(venta?.producto?._id || venta?.producto || "").trim();
        const producto = String(venta?.producto?.nombre_producto || "").trim();
        const variante = getInventoryDisplayVariant({
          variantes: venta?.variantes,
          nombreVariante: venta?.nombre_variante,
          baseName: producto,
        });
        const variantKey = String(venta?.variantKey || "").trim();
        const cantidad = safeNum(venta?.cantidad);
        const rowKey = resolveInventoryRowKey(inventoryAliasMap, {
          idProducto,
          variantKey,
          variantes: venta?.variantes,
          variante,
          idVendedor,
          baseName: producto,
        });

        const got = inventoryMap.get(rowKey) || {
          id_producto: idProducto,
          producto,
          variante,
          variant_key: variantKey,
          id_vendedor: idVendedor,
          vendedor: seller.vendedor,
          estado_cliente: seller.estado_cliente,
          stock_actual: 0,
          unidades_en_espera: 0,
          tiene_entregas_en_espera: false,
          stock_total_reportado: 0,
          es_temporal: false,
        };

        got.unidades_en_espera += cantidad;
        got.tiene_entregas_en_espera = got.unidades_en_espera > 0;
        got.stock_total_reportado = got.stock_actual + got.unidades_en_espera;
        inventoryMap.set(rowKey, got);
        registerInventoryAliases(inventoryAliasMap, rowKey, {
          idProducto,
          variantKey: got.variant_key || variantKey,
          variantes: venta?.variantes,
          variante: got.variante || variante,
          idVendedor,
          baseName: producto,
        });
      }

      for (const temporal of temporales) {
        const idVendedor = String(temporal?.id_vendedor || "").trim();
        const seller = sellerMeta.get(idVendedor);
        if (!seller) continue;

        const producto = String(temporal?.producto || "").trim();
        const cantidad = safeNum(temporal?.cantidad);
        const rowKey = resolveInventoryRowKey(inventoryAliasMap, {
          variante: producto,
          idVendedor,
          esTemporal: true,
        });

        const got = inventoryMap.get(rowKey) || {
          id_producto: "",
          producto,
          variante: "Temporal",
          variant_key: "",
          id_vendedor: idVendedor,
          vendedor: seller.vendedor,
          estado_cliente: seller.estado_cliente,
          stock_actual: 0,
          unidades_en_espera: 0,
          tiene_entregas_en_espera: false,
          stock_total_reportado: 0,
          es_temporal: true,
        };

        got.unidades_en_espera += cantidad;
        got.tiene_entregas_en_espera = got.unidades_en_espera > 0;
        got.stock_total_reportado = got.stock_actual + got.unidades_en_espera;
        inventoryMap.set(rowKey, got);
        registerInventoryAliases(inventoryAliasMap, rowKey, {
          variante: producto,
          idVendedor,
          esTemporal: true,
        });
      }
    }

    const rows = Array.from(inventoryMap.values())
      .map((row) => ({
        ...row,
        stock_actual: safeNum(row.stock_actual),
        unidades_en_espera: safeNum(row.unidades_en_espera),
        stock_total_reportado: safeNum(row.stock_actual) + safeNum(row.unidades_en_espera),
        tiene_entregas_en_espera: safeNum(row.unidades_en_espera) > 0,
      }))
      .filter((row) => safeNum(row.stock_actual) > 0 || safeNum(row.unidades_en_espera) > 0)
      .sort(
        (a, b) =>
          a.vendedor.localeCompare(b.vendedor) ||
          a.producto.localeCompare(b.producto) ||
          a.variante.localeCompare(b.variante) ||
          a.id_producto.localeCompare(b.id_producto),
      );

    return {
      filtros: { id_sucursal: idSucursal, id_vendedor: requestedSellerId || null },
      resumen: {
        productos: rows.length,
        stock_actual: rows.reduce((sum, row) => sum + safeNum(row.stock_actual), 0),
        unidades_en_espera: rows.reduce((sum, row) => sum + safeNum(row.unidades_en_espera), 0),
        stock_total_reportado: rows.reduce((sum, row) => sum + safeNum(row.stock_total_reportado), 0),
      },
      rows,
    };
  },

  async exportInventarioActualXlsx(params: InventoryParams) {
    const data = await this.getInventarioActual(params);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const wsResumen = wb.addWorksheet("Resumen");
    wsResumen.columns = Object.keys(data.resumen).map((key) => ({ header: key, key, width: 24 }));
    wsResumen.addRow(data.resumen);
    wsResumen.getRow(1).font = { bold: true };

    const ws = wb.addWorksheet("Inventario_Actual");
    if (data.rows.length) {
      ws.columns = Object.keys(data.rows[0]).map((key) => ({ header: key, key, width: 24 }));
      ws.getRow(1).font = { bold: true };
      data.rows.forEach((row) => ws.addRow(row));
    }

    const filename = `inventario_actual_${params.idSucursal}${params.sellerId ? `_${params.sellerId}` : "_todos"}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);

    await wb.xlsx.writeFile(filePath);
    return { filePath, filename };
  },

  async exportOperacionMensualXlsx(params: Params) {
    const data = await this.getOperacionMensual(params);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const reportesSet = params.reportes && params.reportes.length ? new Set(params.reportes) : null;
    if (reportesSet?.has("ticketPromedioPorSucursal")) reportesSet.add("ticketPromedioGlobal");
    if (reportesSet?.has("ticketPromedioClientesPorSucursal")) reportesSet.add("ticketPromedioClientesGlobal");
    if (reportesSet?.has("clientesNuevosPorSucursal")) reportesSet.add("clientesNuevosDetalle");
    if (
      reportesSet?.has("ventasPorHoraPorSucursal") ||
      reportesSet?.has("ventasPorHoraEntregasPorSucursal") ||
      reportesSet?.has("ventasPorHoraVentasPorSucursal")
    ) {
      reportesSet.add("ventasPorHoraDetalle");
    }
    if (reportesSet?.has("clientesActivosPorSucursal")) reportesSet.add("clientesActivosGlobal");
    if (reportesSet?.has("costoEntregaPromedioPorSucursal")) reportesSet.add("costoEntregaPromedioGlobal");
    if (reportesSet?.has("deliveryPromedioPorSucursal")) reportesSet.add("deliveryPromedioGlobal");
    if (reportesSet?.has("clientesPorHoraMensual")) reportesSet.add("clientesPorHoraDetalle");
    if (reportesSet?.has("ventasMensualPorSucursal")) reportesSet.add("ventasMensualPorSucursalDetalle");
    if (reportesSet?.has("entregasExternasRealizadasPorSucursal")) reportesSet.add("entregasExternasRealizadasGlobal");
    const colsMap = params.columnas;

    const pickCols = (rows: any[], key: string) => {
      const cols = colsMap?.[key];
      if (!Array.isArray(cols) || !cols.length) return rows;
      return rows.map((r) => Object.fromEntries(cols.map((c) => [c, (r as any)[c]])));
    };

    const addSheet = (name: string, key: string, rows: any[]) => {
      if (reportesSet && !reportesSet.has(key)) return null;
      const rowsPicked = pickCols(rows, key);
      const ws = wb.addWorksheet(name);
      if (!rowsPicked.length) return ws;
      const headers = Object.keys(rowsPicked[0]);
      ws.addRow(headers);
      rowsPicked.forEach((r) => ws.addRow(headers.map((h) => (r as any)[h])));
      ws.getRow(1).font = { bold: true };
      ws.columns?.forEach((c) => {
        c.width = 20;
      });
      return ws;
    };

    addSheet("Top10_Productos_por_Sucursal", "topProductosPorSucursal", data.topProductosPorSucursal);
    addSheet("Top10_Global", "topGlobal", data.topGlobal);
    addSheet("Delivery_Promedio", "deliveryPromedioPorSucursal", data.deliveryPromedioPorSucursal);
    addSheet("Delivery_Promedio_Global", "deliveryPromedioGlobal", [data.deliveryPromedioGlobal]);
    addSheet("Costo_Entrega_Promedio", "costoEntregaPromedioPorSucursal", data.costoEntregaPromedioPorSucursal);
    addSheet("Costo_Entrega_Global", "costoEntregaPromedioGlobal", [data.costoEntregaPromedioGlobal]);
    addSheet("Clientes_por_Hora_(Mes)", "clientesPorHoraMensual", data.clientesPorHoraMensual);
    addSheet("Clientes_por_Hora_Detalle", "clientesPorHoraDetalle", data.clientesPorHoraDetalle);
    addSheet("Ventas_Por_Hora", "ventasPorHoraPorSucursal", data.ventasPorHoraPorSucursal);
    addSheet("Ventas_Por_Hora_Entregas", "ventasPorHoraEntregasPorSucursal", data.ventasPorHoraEntregasPorSucursal);
    addSheet("Ventas_Por_Hora_Ventas", "ventasPorHoraVentasPorSucursal", data.ventasPorHoraVentasPorSucursal);
    addSheet("Ventas_Por_Hora_Detalle", "ventasPorHoraDetalle", data.ventasPorHoraDetalle);
    addSheet("Ticket_Promedio_Por_Sucursal", "ticketPromedioPorSucursal", data.ticketPromedioPorSucursal);
    addSheet("Ticket_Promedio_Global", "ticketPromedioGlobal", [data.ticketPromedioGlobal]);
    addSheet("Ticket_Clientes_Por_Sucursal", "ticketPromedioClientesPorSucursal", data.ticketPromedioClientesPorSucursal);
    addSheet("Ticket_Clientes_Global", "ticketPromedioClientesGlobal", [data.ticketPromedioClientesGlobal]);
    addSheet("Entregas_Externas_Por_Sucursal", "entregasExternasRealizadasPorSucursal", data.entregasExternasRealizadasPorSucursal);
    addSheet("Entregas_Externas_Global", "entregasExternasRealizadasGlobal", [data.entregasExternasRealizadasGlobal]);
    addSheet("Clientes_Activos_Por_Sucursal", "clientesActivosPorSucursal", data.clientesActivosPorSucursal);
    addSheet("Clientes_Activos_Global", "clientesActivosGlobal", [data.clientesActivosGlobal]);
    addSheet("Clientes_Nuevos_Por_Sucursal", "clientesNuevosPorSucursal", data.clientesNuevosPorSucursal);
    addSheet("Clientes_Nuevos_Detalle", "clientesNuevosDetalle", data.clientesNuevosDetalle);
    addSheet("Vendedores_Activos_Por_Sucursal", "vendedoresActivosPorSucursal", data.vendedoresActivosPorSucursal);
    addSheet("Numero_Ventas_Por_Sucursal", "numeroVentasPorSucursal", data.numeroVentasPorSucursal);
    addSheet("Numero_Ventas_Total_Por_Sucursal", "numeroVentasTotalPorSucursal", data.numeroVentasTotalPorSucursal);
    addSheet("Ventas_Mensual_Por_Sucursal", "ventasMensualPorSucursal", data.ventasMensualPorSucursal);
    addSheet(
      "Ventas_Mensual_Por_Sucursal_Detalle",
      "ventasMensualPorSucursalDetalle",
      data.ventasMensualPorSucursalDetalle,
    );

    const meses = data.meses || [];
    const filename =
      meses.length <= 1
        ? `operacion_mensual_${meses[0] || "sin_mes"}.xlsx`
        : `operacion_mensual_${meses[0]}_a_${meses[meses.length - 1]}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);

    return { filePath, filename };
  },

  async exportStockProductosXlsx({ idSucursal }: ExportStockParams) {
    const rowsRaw = await ReportsRepository.fetchStockProductosPorSucursal({ idSucursal });

    const rows: StockRow[] = (rowsRaw as any[]).map((r) => ({
      producto: r.nombre_producto || "",
      variante: formatVariante(r.variantes),
      id_vendedor: r.id_vendedor || "",
      vendedor: r.vendedor_nombre_completo || "",
      stock: typeof r.stock === "number" ? r.stock : 0,
    }));

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const ws = wb.addWorksheet("Stock_Productos");
    ws.columns = [
      { header: "Producto", key: "producto", width: 35 },
      { header: "Variante", key: "variante", width: 45 },
      { header: "Id Vendedor", key: "id_vendedor", width: 28 },
      { header: "Vendedor", key: "vendedor", width: 28 },
      { header: "Stock", key: "stock", width: 10 },
    ];
    ws.getRow(1).font = { bold: true };

    rows.forEach((row) => ws.addRow(row));

    const filename = `stock_productos_${idSucursal}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);

    return { filePath, filename };
  },

  async getProductosRiesgoVariantes(params: VariantRiskParams = {}) {
    const rowsRaw = await ReportsRepository.fetchProductosParaReporteVariantes({
      sellerId: params.sellerId,
    });
    const rows = buildVariantRiskRows(rowsRaw as any[], params);

    return {
      total: rows.length,
      filtros: {
        sellerId: params.sellerId || "",
        limit: Math.max(1, Math.min(500, Number(params.limit) || 100)),
        minCombinaciones: Math.max(0, Number(params.minCombinaciones) || 0),
        minEspacioTeorico: Math.max(0, Number(params.minEspacioTeorico) || 0),
      },
      rows,
    };
  },

  async exportProductosRiesgoVariantesXlsx(params: VariantRiskParams = {}) {
    const data = await this.getProductosRiesgoVariantes(params);
    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const ws = wb.addWorksheet("Productos_Variantes_Riesgo");
    ws.columns = [
      { header: "Score Riesgo", key: "score_riesgo", width: 16 },
      { header: "Espacio Teorico", key: "espacio_teorico", width: 16 },
      { header: "Combinaciones Unicas", key: "combinaciones_unicas", width: 18 },
      { header: "Cobertura %", key: "cobertura_pct", width: 12 },
      { header: "Firmas Atributos", key: "firmas_atributos", width: 16 },
      { header: "Comb. Incompletas", key: "combinaciones_incompletas", width: 18 },
      { header: "Atributos Distintos", key: "atributos_distintos", width: 18 },
      { header: "Producto", key: "producto", width: 32 },
      { header: "Id Producto", key: "id_producto", width: 28 },
      { header: "Id Vendedor", key: "id_vendedor", width: 28 },
      { header: "Vendedor", key: "vendedor", width: 28 },
      { header: "Group Id", key: "group_id", width: 12 },
      { header: "Sucursales", key: "sucursales", width: 10 },
      { header: "Max Comb. Sucursal", key: "combinaciones_max_sucursal", width: 18 },
      { header: "Atributos", key: "atributos", width: 40 },
      { header: "Firmas Ejemplo", key: "firmas_ejemplo", width: 50 },
      { header: "Motivo", key: "motivo", width: 65 },
    ];
    ws.getRow(1).font = { bold: true };
    data.rows.forEach((row) => ws.addRow(row));

    const filename = `productos_variantes_riesgo.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);

    return { filePath, filename };
  },

  async exportComisiones3MesesXlsx({ mesFin, sucursalIds }: ExportComisionesParams) {
    const mesFinSafe = String(mesFin || "");
    const { start, end } = rangeUltimos3Meses(mesFinSafe);
    const meses = listaMeses3(mesFinSafe);

    const pedidos = await ReportsRepository.fetchPedidosConVentasEnRango({
      start,
      end,
      sucursalIds,
    });

    // acumulador (sucursal|mes) -> suma utilidad
    const acc = new Map<string, { id_sucursal: string; mes: string; comision_bs: number }>();

    for (const p of pedidos as any[]) {
      const fecha = p.hora_entrega_real || p.fecha_pedido; // ✅ fallback
      if (!fecha) continue;

      const mes = moment.tz(fecha, TZ).format("YYYY-MM");

      const ventas = Array.isArray(p.venta) ? p.venta : [];
      for (const v of ventas) {
        const utilidad = typeof v?.utilidad === "number" ? v.utilidad : 0;

        // ✅ preferimos sucursal real de la venta; fallback a sucursal/lugar_origen del pedido
        const sucId = String(
          p.sucursal?._id || p.sucursal ||
          p.lugar_origen?._id || p.lugar_origen ||
          ""
        );

        if (!sucId) continue;

        const key = `${sucId}|${mes}`;
        const got = acc.get(key) || { id_sucursal: sucId, mes, comision_bs: 0 };
        got.comision_bs += utilidad;
        acc.set(key, got);
      }
    }

    const data = Array.from(acc.values()).map((r) => ({
      ...r,
      comision_bs: +r.comision_bs.toFixed(2),
    }));

    // ---- Pivot: sucursal -> { mes -> comision } ----
    const sucursales = (sucursalIds?.length
      ? [...sucursalIds] 
      : Array.from(new Set(data.map(d => d.id_sucursal)))
    ).sort();


    const map = new Map<string, Map<string, number>>();
    for (const s of sucursales) map.set(s, new Map(meses.map((m) => [m, 0])));

    for (const r of data) {
      if (!map.has(r.id_sucursal)) map.set(r.id_sucursal, new Map(meses.map((mm) => [mm, 0])));
      if (meses.includes(r.mes)) map.get(r.id_sucursal)!.set(r.mes, r.comision_bs);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    // ===== Hoja 1: Pivot =====
    const ws = wb.addWorksheet("Comisiones_Por_Sucursal");
    const header = ["Id Sucursal", ...meses, "Total Sucursal"];
    ws.addRow(header);
    ws.getRow(1).font = { bold: true };

    let totalGeneral = 0;

    for (const suc of sucursales) {
      const byMes = map.get(suc)!;
      const vals = meses.map((m) => byMes.get(m) || 0);
      const totalSuc = vals.reduce((a, b) => a + b, 0);
      totalGeneral += totalSuc;

      ws.addRow([suc, ...vals.map((v) => +v.toFixed(2)), +totalSuc.toFixed(2)]);
    }

    const totalsPorMes = meses.map((m) => {
      let sum = 0;
      for (const suc of sucursales) sum += map.get(suc)!.get(m) || 0;
      return +sum.toFixed(2);
    });

    ws.addRow(["TOTAL GENERAL", ...totalsPorMes, +totalGeneral.toFixed(2)]);
    ws.getRow(ws.rowCount).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 22));

    // ===== Hoja 2: Detalle =====
    const ws2 = wb.addWorksheet("Detalle");
    ws2.columns = [
      { header: "Mes", key: "mes", width: 12 },
      { header: "Id Sucursal", key: "id_sucursal", width: 26 },
      { header: "Comision Bs", key: "comision_bs", width: 14 },
    ];
    ws2.getRow(1).font = { bold: true };
    data.forEach((r) => ws2.addRow(r));

    const filename = `comisiones_3m_hasta_${mesFin}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);

    return { filePath, filename };
  },
  async exportIngresosFlujo4MesesXlsx({ mesFin }: ExportIngresos3MParams) {
    const mesFinSafe = String(mesFin || "");
    const { start, end } = rangeUltimos4Meses(mesFinSafe);
    const meses = listaMeses4(mesFinSafe); // ["2025-10","2025-11","2025-12"]

    const docs = await ReportsRepository.fetchIngresosFlujoEnRango({
      start,
      end,
    });

    // ===== 1) Armar detalle con mes =====
    const detalle = (docs as any[]).map((d) => {
    const mes = moment.utc(d.fecha).format("YYYY-MM");
      return {
        mes,
        fecha: d.fecha,
        categoria: d.categoria || "",
        concepto: d.concepto || "",
        monto_bs: typeof d.monto === "number" ? +d.monto.toFixed(2) : 0,
        esDeuda: !!d.esDeuda,
        id_vendedor: d.id_vendedor ? String(d.id_vendedor) : "",
        id_trabajador: d.id_trabajador ? String(d.id_trabajador) : "",
      };
    }).filter(r => meses.includes(r.mes)); 

    // ===== 2) Pivot por mes =====
    const accMes = new Map<string, number>();
    for (const m of meses) accMes.set(m, 0);

    for (const r of detalle) {
      accMes.set(r.mes, (accMes.get(r.mes) || 0) + (r.monto_bs || 0));
    }

    const rowPivot = {
      ...Object.fromEntries(meses.map((m) => [m, +(accMes.get(m) || 0).toFixed(2)])),
      total_4m_bs: +meses.reduce((s, m) => s + (accMes.get(m) || 0), 0).toFixed(2),
    };
    // ===== 3) Excel =====
    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    // Hoja 1: Resumen
    const ws = wb.addWorksheet("Ingresos_4M");
    ws.columns = [
      ...meses.map((m) => ({ header: m, key: m, width: 16 })),
      { header: "Total 4M", key: "total_4m_bs", width: 16 },
    ];
    ws.addRow(rowPivot);
    ws.getRow(1).font = { bold: true };

    // Hoja 2: Detalle
    const ws2 = wb.addWorksheet("Detalle");
    ws2.columns = [
      { header: "Mes", key: "mes", width: 10 },
      { header: "Fecha", key: "fecha", width: 22 },
      { header: "Categoria", key: "categoria", width: 16 },
      { header: "Concepto", key: "concepto", width: 40 },
      { header: "Monto Bs", key: "monto_bs", width: 12 },
      { header: "EsDeuda", key: "esDeuda", width: 10 },
      { header: "Id Vendedor", key: "id_vendedor", width: 26 },
      { header: "Id Trabajador", key: "id_trabajador", width: 26 },
    ];
    ws2.getRow(1).font = { bold: true };
    detalle.forEach((r) => ws2.addRow(r));

    const filename = `ingresos_flujo_3m_hasta_${mesFin}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);

    return { filePath, filename };
  },


async exportClientesActivosXlsx({ mesFin }: ExportClientesActivosParams) {
  const mesFinSafe = String(mesFin || "");
  const meses = listaMeses3(mesFinSafe);
  const { start, end } = rangeUltimos3Meses(mesFinSafe);

  // 1) Vendedores activos (por vigencia) + sucursales activas
  const vendedores = await ReportsRepository.fetchVendedoresActivosConPlanes({
    hoy: moment.tz(TZ).startOf("day").toDate(),
  });

  // 2) Ventas 3M por vendedor (según pedidos) en ese rango
  const ventas3m = await ReportsRepository.fetchVentas3MPorVendedor({
    start,
    end,
  });
  // ventas3m: [{ id_vendedor, mes, monto_bs }]

  const ventasMap = new Map<string, Map<string, number>>();
  for (const v of ventas3m as any[]) {
    const vid = String(v.id_vendedor);
    const mes = String(v.mes);
    const monto = typeof v.monto_bs === "number" ? v.monto_bs : 0;

    if (!ventasMap.has(vid)) ventasMap.set(vid, new Map(meses.map(m => [m, 0])));
    if (meses.includes(mes)) ventasMap.get(vid)!.set(mes, (ventasMap.get(vid)!.get(mes) || 0) + monto);
  }

  // 3) Armar columnas dinámicas por sucursal (una fila por vendedor)
  //    Estructura: SucursalName:Alquiler / Exhibicion / Delivery / EntregaSimple / Activo
  const sucursalesSet = new Set<string>();
  for (const ven of vendedores as any[]) {
    for (const ps of (ven.pago_sucursales || [])) {
      if (ps?.sucursalName) sucursalesSet.add(String(ps.sucursalName));
    }
  }
  const sucursales = Array.from(sucursalesSet).sort();

  // 4) Rows detalle
  const rows: any[] = (vendedores as any[]).map((ven) => {
    const id = String(ven._id);
    const nombreCompleto = `${ven.nombre || ""} ${ven.apellido || ""}`.trim();

    const byMes = ventasMap.get(id) || new Map(meses.map(m => [m, 0]));
    const total3m = meses.reduce((s, m) => s + (byMes.get(m) || 0), 0);

    // index sucursalName -> pago_sucursal
    const psMap = new Map<string, any>();
    for (const ps of (ven.pago_sucursales || [])) {
      if (!ps?.sucursalName) continue;
      psMap.set(String(ps.sucursalName), ps);
    }

    const planesCols: Record<string, any> = {};
    for (const s of sucursales) {
      const ps = psMap.get(s);
      planesCols[`${s} - Activo`] = !!ps?.activo;
      planesCols[`${s} - Alquiler`] = safeNum(ps?.alquiler);
      planesCols[`${s} - Exhibicion`] = safeNum(ps?.exhibicion);
      planesCols[`${s} - Delivery`] = safeNum(ps?.delivery);
      planesCols[`${s} - EntregaSimple`] = safeNum(ps?.entrega_simple);
    }

    return {
      id_vendedor: id,
      vendedor: nombreCompleto,
      mail: ven.mail || "",
      telefono: ven.telefono || "",
      fecha_vigencia: ven.fecha_vigencia || null,
      comision_porcentual: safeNum(ven.comision_porcentual),
      comision_fija: safeNum(ven.comision_fija),

      ...Object.fromEntries(meses.map(m => [m, +((byMes.get(m) || 0).toFixed(2))])),
      total_3m_bs: +total3m.toFixed(2),

      ...planesCols,
    };
  });

  // 5) Hoja Resumen (totales por mes + conteo vendedores activos)
  const resumen = {
    vendedores_activos: rows.length,
    ...Object.fromEntries(meses.map(m => [m, +rows.reduce((s, r) => s + safeNum(r[m]), 0).toFixed(2)])),
    total_3m_bs: +rows.reduce((s, r) => s + safeNum(r.total_3m_bs), 0).toFixed(2),
  };

  // 6) Excel
  const wb = new ExcelJS.Workbook();
  wb.creator = "TuPunto Reports";
  wb.created = new Date();

  const wsR = wb.addWorksheet("Resumen");
  wsR.columns = Object.keys(resumen).map((k) => ({ header: k, key: k, width: 22 }));
  wsR.addRow(resumen);
  wsR.getRow(1).font = { bold: true };

  const ws = wb.addWorksheet("Detalle_Vendedores");
  if (rows.length) {
    ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 22 }));
    ws.getRow(1).font = { bold: true };
    rows.forEach(r => ws.addRow(r));
  }

  const filename = `clientes_activos_${meses[0]}_a_${meses[2]}.xlsx`;
  const outDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, filename);

  await wb.xlsx.writeFile(filePath);
  return { filePath, filename };
},
async exportVentasVendedores4mXlsx() {
  const { start, end } = rangeOctToToday();

  // 1) Trae detalle ya enriquecido (con vendedorNombre, productoNombre)
  const detalle = await ReportsRepository.fetchVentasDetalleEnRango({ start, end });

  // 2) Armar resumen por vendedor:
  //    - total_bs = sum(cantidad*precio_unitario)
  //    - unidades = sum(cantidad)
  //    - top_producto_id = producto con mayor cantidad (en empate, mayor monto)
  // 2) resumen por vendedor, PIVOT por mes (4 columnas por mes) + TOTAL
const mesesOrdenados = Array.from(
  new Set((detalle as any[]).map(r => moment.tz(r.fecha, TZ).format("YYYY-MM")))
).sort(); // ej: ["2025-10","2025-11","2025-12","2026-01"]

type AccVendedor = {
  id_vendedor: string;
  vendedor: string;

  // mes -> acumulados
  porMes: Map<string, {
    monto: number;
    unidades: number;
    prodCount: Map<string, number>; // productoId -> unidades
    prodName: Map<string, string>;  // productoId -> nombre
  }>;

  // total global
  totalMonto: number;
  totalUnidades: number;
  totalProdCount: Map<string, number>;
  totalProdName: Map<string, string>;
};

const acc = new Map<string, AccVendedor>();

for (const r of detalle as any[]) {
  const vid = String(r.id_vendedor || "");
  if (!vid) continue;

  const mes = moment.tz(r.fecha, TZ).format("YYYY-MM");
  const monto = safeNum(r.total_bs);
  const unidades = safeNum(r.cantidad);

  const pid = String(r.id_producto || "");
  const pname = String(r.producto || "");

  const got = acc.get(vid) || {
    id_vendedor: vid,
    vendedor: r.vendedor || vid,
    porMes: new Map(),

    totalMonto: 0,
    totalUnidades: 0,
    totalProdCount: new Map(),
    totalProdName: new Map(),
  };

  // --- por mes ---
  if (!got.porMes.has(mes)) {
    got.porMes.set(mes, { monto: 0, unidades: 0, prodCount: new Map(), prodName: new Map() });
  }
  const m = got.porMes.get(mes)!;
  m.monto += monto;
  m.unidades += unidades;

  if (pid) {
    m.prodCount.set(pid, (m.prodCount.get(pid) || 0) + unidades);
    if (pname) m.prodName.set(pid, pname);
  }

  // --- total global ---
  got.totalMonto += monto;
  got.totalUnidades += unidades;

  if (pid) {
    got.totalProdCount.set(pid, (got.totalProdCount.get(pid) || 0) + unidades);
    if (pname) got.totalProdName.set(pid, pname);
  }

  acc.set(vid, got);
}

function topProducto(prodCount: Map<string, number>, prodName: Map<string, string>) {
  let topId = "";
  let topUnits = -1;
  for (const [pid, u] of prodCount.entries()) {
    if (u > topUnits) { topUnits = u; topId = pid; }
  }
  return {
    id: topId || "",
    nombre: topId ? (prodName.get(topId) || "") : "",
  };
}

// armar filas (una fila por vendedor) con columnas dinámicas por mes
const resumen = Array.from(acc.values()).map((v) => {
  const row: any = {
    id_vendedor: v.id_vendedor,
    vendedor: v.vendedor,
  };

  // columnas por mes
  for (const mes of mesesOrdenados) {
    const mm = v.porMes.get(mes) || { monto: 0, unidades: 0, prodCount: new Map(), prodName: new Map() };
    const top = topProducto(mm.prodCount, mm.prodName);

    row[`${mes} - Total Ventas (Bs)`] = +mm.monto.toFixed(2);
    row[`${mes} - Total Unidades`] = mm.unidades;
    row[`${mes} - Top Producto Id`] = top.id;
    row[`${mes} - Top Producto`] = top.nombre;
  }

  // TOTAL (todo el rango)
  const topT = topProducto(v.totalProdCount, v.totalProdName);
  row[`TOTAL - Total Ventas (Bs)`] = +v.totalMonto.toFixed(2);
  row[`TOTAL - Total Unidades`] = v.totalUnidades;
  row[`TOTAL - Top Producto Id`] = topT.id;
  row[`TOTAL - Top Producto`] = topT.nombre;

  return row;
}).sort((a, b) => (b[`TOTAL - Total Ventas (Bs)`] || 0) - (a[`TOTAL - Total Ventas (Bs)`] || 0));

  // 3) Excel
  const wb = new ExcelJS.Workbook();
  wb.creator = "TuPunto Reports";
  wb.created = new Date();

  // Hoja 1: Resumen
  // Hoja 1: Resumen (ordenado)
const ws1 = wb.addWorksheet("Resumen");

if (resumen.length) {
  const headers: string[] = ["id_vendedor", "vendedor"];

  for (const mes of mesesOrdenados) {
    headers.push(
      `${mes} - Total Ventas (Bs)`,
      `${mes} - Total Unidades`,
      `${mes} - Top Producto Id`,
      `${mes} - Top Producto`,
    );
  }

  headers.push(
    `TOTAL - Total Ventas (Bs)`,
    `TOTAL - Total Unidades`,
    `TOTAL - Top Producto Id`,
    `TOTAL - Top Producto`,
  );

  ws1.addRow(headers);
  ws1.getRow(1).font = { bold: true };

  for (const r of resumen) {
    ws1.addRow(headers.map(h => (r as any)[h] ?? ""));
  }

  ws1.columns.forEach((c) => (c.width = 24));
}

  // Hoja 2: Detalle
  const ws2 = wb.addWorksheet("Detalle");
  ws2.columns = [
    { header: "Fecha", key: "fecha", width: 22 },
    { header: "Id Venta", key: "id_venta", width: 26 },
    { header: "Id Vendedor", key: "id_vendedor", width: 26 },
    { header: "Vendedor", key: "vendedor", width: 30 },
    { header: "Id Producto", key: "id_producto", width: 26 },
    { header: "Producto", key: "producto", width: 35 },
    { header: "Nombre Variante", key: "nombre_variante", width: 30 },
    { header: "Cantidad", key: "cantidad", width: 10 },
    { header: "Precio Unitario", key: "precio_unitario", width: 14 },
    { header: "Total (Bs)", key: "total_bs", width: 12 },
    { header: "Id Sucursal", key: "id_sucursal", width: 26 },
  ];
  ws2.getRow(1).font = { bold: true };
  (detalle as any[]).forEach((r) => ws2.addRow(r));

  const filename = `ventas_vendedores_oct_dic_y_ene_hasta_hoy.xlsx`;
  const outDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, filename);
  await wb.xlsx.writeFile(filePath);

  return { filePath, filename };
},

  async exportComisionesMesesXlsx(params: ExportComisionesParams) {
    const data = await this.getComisionesPorMeses(params);
    const meses = data.meses;
    const sucursales = Array.from(new Set(data.rows.map((r) => `${r.id_sucursal}|||${r.sucursal}`))).sort();
    const map = new Map<string, Map<string, number>>();

    for (const suc of sucursales) map.set(suc, new Map(meses.map((m) => [m, 0])));
    for (const row of data.rows) {
      const key = `${row.id_sucursal}|||${row.sucursal}`;
      if (!map.has(key)) map.set(key, new Map(meses.map((m) => [m, 0])));
      map.get(key)!.set(row.mes, safeNum(row.comision_bs));
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const ws = wb.addWorksheet("Comisiones_Por_Sucursal");
    ws.addRow(["Id Sucursal", "Sucursal", ...meses, "Total Sucursal"]);
    ws.getRow(1).font = { bold: true };

    let totalGeneral = 0;
    for (const suc of sucursales) {
      const [idSucursal, sucursal] = suc.split("|||");
      const vals = meses.map((m) => map.get(suc)?.get(m) || 0);
      const totalSuc = vals.reduce((a, b) => a + b, 0);
      totalGeneral += totalSuc;
      ws.addRow([idSucursal, sucursal, ...vals.map((v) => +v.toFixed(2)), +totalSuc.toFixed(2)]);
    }

    const totalsPorMes = meses.map((m) =>
      +sucursales.reduce((sum, suc) => sum + (map.get(suc)?.get(m) || 0), 0).toFixed(2),
    );
    ws.addRow(["TOTAL GENERAL", "", ...totalsPorMes, +totalGeneral.toFixed(2)]);
    ws.getRow(ws.rowCount).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 22));

    const ws2 = wb.addWorksheet("Detalle");
    if (data.rows.length) {
      const headers = Object.keys(data.rows[0]);
      ws2.addRow(headers);
      ws2.getRow(1).font = { bold: true };
      data.rows.forEach((r) => ws2.addRow(headers.map((h) => (r as any)[h])));
      ws2.columns.forEach((c) => (c.width = 20));
    }

    const nombreMeses = meses.length <= 1 ? meses[0] || "sin_mes" : `${meses[0]}_a_${meses[meses.length - 1]}`;
    const filename = `comisiones_${nombreMeses}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);
    return { filePath, filename };
  },

  async exportIngresosMesesXlsx(params: ExportIngresos3MParams) {
    const data = await this.getIngresosPorMeses(params);
    const meses = data.meses;

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const ws = wb.addWorksheet("Ingresos");
    ws.columns = [
      ...meses.map((m) => ({ header: m, key: m, width: 16 })),
      { header: "Total", key: "total_bs", width: 16 },
    ];
    ws.addRow({
      ...Object.fromEntries(data.totalesPorMes.map((r) => [r.mes, r.monto_bs])),
      total_bs: data.totalGlobal.monto_bs,
    });
    ws.getRow(1).font = { bold: true };

    const ws2 = wb.addWorksheet("Detalle");
    if (data.detalle.length) {
      const headers = Object.keys(data.detalle[0]);
      ws2.addRow(headers);
      ws2.getRow(1).font = { bold: true };
      data.detalle.forEach((r) => ws2.addRow(headers.map((h) => (r as any)[h])));
      ws2.columns.forEach((c) => (c.width = 20));
    }

    const nombreMeses = meses.length <= 1 ? meses[0] || "sin_mes" : `${meses[0]}_a_${meses[meses.length - 1]}`;
    const filename = `ingresos_flujo_${nombreMeses}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);
    return { filePath, filename };
  },

  async exportClientesActivosMesesXlsx(params: ExportClientesActivosParams) {
    const data = await this.getClientesActivosServicio(params);
    const meses = data.meses;

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const wsR = wb.addWorksheet("Resumen");
    wsR.columns = Object.keys(data.resumen).map((k) => ({ header: k, key: k, width: 22 }));
    wsR.addRow(data.resumen);
    wsR.getRow(1).font = { bold: true };

    const ws = wb.addWorksheet("Detalle_Clientes");
    if (data.rows.length) {
      ws.columns = Object.keys(data.rows[0]).map((k) => ({ header: k, key: k, width: 22 }));
      ws.getRow(1).font = { bold: true };
      data.rows.forEach((r) => ws.addRow(r));
    }

    const nombreMeses = meses.length <= 1 ? meses[0] || "sin_mes" : `${meses[0]}_a_${meses[meses.length - 1]}`;
    const filename = `clientes_activos_${nombreMeses}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);
    return { filePath, filename };
  },

  async exportVentasVendedoresMesesXlsx(params: ExportVentasVendedoresParams = {}) {
    const data = await this.getVentasVendedoresPorMeses(params);
    const meses = data.meses;

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const ws1 = wb.addWorksheet("Resumen");
    if (data.resumen.length) {
      const headers: string[] = ["id_vendedor", "vendedor"];
      for (const mesRow of meses) {
        headers.push(
          `${mesRow} - Total Ventas (Bs)`,
          `${mesRow} - Total Unidades`,
          `${mesRow} - Top Producto Id`,
          `${mesRow} - Top Producto`,
        );
      }
      headers.push(
        "TOTAL - Total Ventas (Bs)",
        "TOTAL - Total Unidades",
        "TOTAL - Top Producto Id",
        "TOTAL - Top Producto",
      );
      ws1.addRow(headers);
      ws1.getRow(1).font = { bold: true };
      data.resumen.forEach((r) => ws1.addRow(headers.map((h) => (r as any)[h] ?? "")));
      ws1.columns.forEach((c) => (c.width = 24));
    }

    const ws2 = wb.addWorksheet("Detalle");
    if (data.detalle.length) {
      const headers = Object.keys(data.detalle[0]);
      ws2.addRow(headers);
      ws2.getRow(1).font = { bold: true };
      data.detalle.forEach((r) => ws2.addRow(headers.map((h) => (r as any)[h])));
      ws2.columns.forEach((c) => (c.width = 20));
    }

    const nombreMeses = meses.length <= 1 ? meses[0] || "sin_mes" : `${meses[0]}_a_${meses[meses.length - 1]}`;
    const filename = `ventas_vendedores_${nombreMeses}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);
    return { filePath, filename };
  },

async getVentasQr({ mes, meses, sucursalIds }: Params) {
  const mesesSeleccionados = normalizeMeses(mes, meses);
  const { start, end } = rangeMeses(mesesSeleccionados);
  const mesSet = new Set(mesesSeleccionados);

  const pedidos = await ReportsRepository.fetchPedidosQrEnRango({
    start,
    end,
    sucursalIds,
  });

  // Map sucursalId -> nombre
  const sucMap = new Map<string, string>();

  // ===== DETALLE (por item de venta) =====
  const detalle: any[] = [];
  for (const p of pedidos as any[]) {
    const fechaBase = p.hora_entrega_real || p.fecha_pedido;
    const mesPedido = fechaBase ? moment.tz(fechaBase, TZ).format("YYYY-MM") : "";
    if (!mesPedido || !mesSet.has(mesPedido)) continue;

    const { id: sucursalId, nombre: sucursalNombre } = getSucursalFromPedido(p);
    if (sucursalId) sucMap.set(sucursalId, sucursalNombre);

    const subtotalQr = safeNum(p.subtotal_qr);
    const cargoDelivery = safeNum(p.cargo_delivery);
    const totalCobradoQr = subtotalQr + cargoDelivery;

    const ventas = Array.isArray(p.venta) ? p.venta : [];
    for (const v of ventas) {
      const cantidad = safeNum(v?.cantidad);
      const precio = safeNum(v?.precio_unitario);
      const totalLinea = +(cantidad * precio).toFixed(2);

      const prodId = v?.producto?._id ? String(v.producto._id) : (v?.producto ? String(v.producto) : "");
      const prodNom = v?.producto?.nombre_producto || v?.nombre_variante || "Producto";

      // sucursal preferida: venta.sucursal si existe, sino la del pedido
      const sIdRaw = typeof v.sucursal === "string" ? v.sucursal : (v.sucursal?._id ?? sucursalId);
      const sId = String(sIdRaw || "");
      const sNom =
        typeof v.sucursal === "string"
          ? (sucMap.get(sId) || sucursalNombre)
          : (v.sucursal?.nombre || sucursalNombre);

      detalle.push({
        mes: mesPedido,
        fecha: fechaBase,
        id_pedido: String(p._id),
        id_sucursal: sId || sucursalId || "",
        sucursal: sNom || sucursalNombre || "",
        cliente: p.cliente || "",
        telefono_cliente: p.telefono_cliente || "",

        subtotal_qr_bs: +subtotalQr.toFixed(2),
        cargo_delivery_bs: +cargoDelivery.toFixed(2),
        total_qr_bs: +totalCobradoQr.toFixed(2),

        id_venta: v?._id ? String(v._id) : "",
        id_producto: prodId,
        producto: prodNom,
        nombre_variante: v?.nombre_variante || "",
        cantidad,
        precio_unitario: +precio.toFixed(2),
        total_linea_bs: totalLinea,

        id_vendedor: v?.vendedor ? String(v.vendedor._id || v.vendedor) : "",
        vendedor:
          v?.vendedor?.nombre && v?.vendedor?.apellido
            ? `${v.vendedor.nombre} ${v.vendedor.apellido}`
            : "",
      });
    }
  }

  // ===== TOTALES por MES + SUCURSAL =====
  // clave: mes|sucursalId
  const accMesSuc = new Map<string, { mes: string; id_sucursal: string; sucursal: string; pedidos: number; unidades: number; total_qr_bs: number }>();

  // para contar pedidos sin duplicar por cada item: usamos set por (mes|sucursal|pedido)
  const seenPedido = new Set<string>();

  for (const r of detalle) {
    const key = `${r.mes}|${r.id_sucursal}`;
    const got = accMesSuc.get(key) || {
      mes: r.mes,
      id_sucursal: r.id_sucursal,
      sucursal: r.sucursal,
      pedidos: 0,
      unidades: 0,
      total_qr_bs: 0,
    };

    // pedidos (sin duplicar)
    const pedKey = `${r.mes}|${r.id_sucursal}|${r.id_pedido}`;
    if (!seenPedido.has(pedKey)) {
      seenPedido.add(pedKey);
      got.pedidos += 1;
      // total_qr_bs es por pedido, pero viene repetido en cada item => sumamos UNA vez
      got.total_qr_bs += safeNum(r.total_qr_bs);
    }

    got.unidades += safeNum(r.cantidad);

    accMesSuc.set(key, got);
  }

  const totalesPorMesYSucursal = Array.from(accMesSuc.values())
    .map(x => ({ ...x, total_qr_bs: +x.total_qr_bs.toFixed(2) }))
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.sucursal.localeCompare(b.sucursal));

  // ===== Totales por MES (global) =====
  const accMes = new Map<string, { mes: string; pedidos: number; unidades: number; total_qr_bs: number }>();
  for (const r of totalesPorMesYSucursal) {
    const got = accMes.get(r.mes) || { mes: r.mes, pedidos: 0, unidades: 0, total_qr_bs: 0 };
    got.pedidos += r.pedidos;
    got.unidades += r.unidades;
    got.total_qr_bs += r.total_qr_bs;
    accMes.set(r.mes, got);
  }

  const totalesPorMes = Array.from(accMes.values())
    .map(x => ({ ...x, total_qr_bs: +x.total_qr_bs.toFixed(2) }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // ===== Global =====
  const totalGlobal = {
    pedidos: totalesPorMes.reduce((s, r) => s + safeNum(r.pedidos), 0),
    unidades: totalesPorMes.reduce((s, r) => s + safeNum(r.unidades), 0),
    total_qr_bs: +totalesPorMes.reduce((s, r) => s + safeNum(r.total_qr_bs), 0).toFixed(2),
  };

  return {
    meses: mesesSeleccionados,
    detalle,                 // (items)
    totalesPorMesYSucursal,  // pivot (mes+sucursal)
    totalesPorMes,           // pivot (mes)
    totalGlobal,
  };
},
async getEntregasSimplesResumen(params: { sellerIds?: string[]; meses?: string[] } = {}) {
  const meses = normalizeMeses(undefined, Array.isArray(params.meses) ? params.meses : undefined);
  const sellerIds =
    Array.isArray(params.sellerIds) && params.sellerIds.length
      ? Array.from(new Set(params.sellerIds.map((id) => String(id).trim()).filter(Boolean)))
      : undefined;

  const rowsRaw = (await ReportsRepository.fetchEntregasSimplesPorVendedorYMes({
    sellerIds,
    meses,
  })) as Array<Record<string, any>>;

  const rows = rowsRaw.map((row) => {
    const fechaMoment = row?.fecha_pedido ? moment.tz(row.fecha_pedido, TZ) : null;
    return {
      id_paquete: String(row.id_paquete || ""),
      id_vendedor: String(row.id_vendedor || ""),
      vendedor: String(row.vendedor || row.vendedor_cargado || "").trim() || "Vendedor",
      sucursal: String(row.sucursal || "").trim() || "Sin sucursal",
      mes: String(row.mes || ""),
      fecha: fechaMoment?.isValid() ? fechaMoment.format("YYYY-MM-DD") : "",
      hora: fechaMoment?.isValid() ? fechaMoment.format("HH:mm") : "",
      numero_paquete: safeNum(row.numero_paquete),
      comprador: String(row.comprador || ""),
      telefono_comprador: String(row.telefono_comprador || ""),
      descripcion_paquete: String(row.descripcion_paquete || ""),
      tamano: String(row.package_size || "estandar"),
      precio_paquete_bs: +safeNum(row.precio_paquete).toFixed(2),
      deuda_vendedor_bs: +safeNum(row.amortizacion_vendedor).toFixed(2),
      deuda_comprador_bs: +safeNum(row.deuda_comprador).toFixed(2),
      esta_pagado: String(row.esta_pagado || "no"),
      metodo_pago: String(row.metodo_pago || ""),
      estado_registro: String(row.estado_pedido || "En Espera"),
    };
  });

  const totalesPorMesMap = new Map<string, any>();
  const totalesPorVendedorMap = new Map<string, any>();
  const totalesPorMetodoMap = new Map<string, any>();

  for (const row of rows) {
    const mesKey = row.mes || "sin-mes";
    const currentMes = totalesPorMesMap.get(mesKey) || {
      mes: mesKey,
      paquetes: 0,
      pagados: 0,
      precio_paquete_bs: 0,
      deuda_vendedor_bs: 0,
      deuda_comprador_bs: 0,
    };
    currentMes.paquetes += 1;
    currentMes.pagados += row.esta_pagado === "si" ? 1 : 0;
    currentMes.precio_paquete_bs += safeNum(row.precio_paquete_bs);
    currentMes.deuda_vendedor_bs += safeNum(row.deuda_vendedor_bs);
    currentMes.deuda_comprador_bs += safeNum(row.deuda_comprador_bs);
    totalesPorMesMap.set(mesKey, currentMes);

    const sellerKey = row.id_vendedor || row.vendedor;
    const currentSeller = totalesPorVendedorMap.get(sellerKey) || {
      id_vendedor: row.id_vendedor,
      vendedor: row.vendedor,
      paquetes: 0,
      pagados: 0,
      precio_paquete_bs: 0,
      deuda_vendedor_bs: 0,
      deuda_comprador_bs: 0,
    };
    currentSeller.paquetes += 1;
    currentSeller.pagados += row.esta_pagado === "si" ? 1 : 0;
    currentSeller.precio_paquete_bs += safeNum(row.precio_paquete_bs);
    currentSeller.deuda_vendedor_bs += safeNum(row.deuda_vendedor_bs);
    currentSeller.deuda_comprador_bs += safeNum(row.deuda_comprador_bs);
    totalesPorVendedorMap.set(sellerKey, currentSeller);

    const metodoKey =
      row.esta_pagado === "si"
        ? row.metodo_pago === "qr"
          ? "QR"
          : row.metodo_pago === "efectivo"
            ? "Efectivo"
            : "Pagado sin metodo"
        : "No pagado";
    const currentMetodo = totalesPorMetodoMap.get(metodoKey) || {
      metodo_pago: metodoKey,
      paquetes: 0,
      monto_bs: 0,
    };
    currentMetodo.paquetes += 1;
    currentMetodo.monto_bs += safeNum(row.precio_paquete_bs);
    totalesPorMetodoMap.set(metodoKey, currentMetodo);
  }

  const roundSummaryRow = <T extends Record<string, any>>(row: T) => ({
    ...row,
    precio_paquete_bs: +safeNum(row.precio_paquete_bs).toFixed(2),
    deuda_vendedor_bs: +safeNum(row.deuda_vendedor_bs).toFixed(2),
    deuda_comprador_bs: +safeNum(row.deuda_comprador_bs).toFixed(2),
  });

  const totalesPorMes = meses.map((mes) =>
    roundSummaryRow(
      totalesPorMesMap.get(mes) || {
        mes,
        paquetes: 0,
        pagados: 0,
        precio_paquete_bs: 0,
        deuda_vendedor_bs: 0,
        deuda_comprador_bs: 0,
      },
    ),
  );

  const totalesPorVendedor = Array.from(totalesPorVendedorMap.values())
    .map((row) => roundSummaryRow(row))
    .sort((a, b) => b.paquetes - a.paquetes || a.vendedor.localeCompare(b.vendedor));

  const totalesPorMetodoPago = Array.from(totalesPorMetodoMap.values())
    .map((row) => ({ ...row, monto_bs: +safeNum(row.monto_bs).toFixed(2) }))
    .sort((a, b) => b.paquetes - a.paquetes || a.metodo_pago.localeCompare(b.metodo_pago));

  return {
    filtros: {
      meses,
      sellerIds: sellerIds || [],
    },
    criterio: {
      incluido: 'Registros del modulo "Paquetes" del nuevo servicio',
      nota: "Como el servicio nuevo aun no maneja un estado final de entrega, el reporte considera como realizadas las cargas registradas en el periodo.",
    },
    rows,
    totalesPorMes,
    totalesPorVendedor,
    totalesPorMetodoPago,
    totalGeneral: {
      paquetes: rows.length,
      pagados: rows.filter((row) => row.esta_pagado === "si").length,
      precio_paquete_bs: +rows.reduce((sum, row) => sum + safeNum(row.precio_paquete_bs), 0).toFixed(2),
      deuda_vendedor_bs: +rows.reduce((sum, row) => sum + safeNum(row.deuda_vendedor_bs), 0).toFixed(2),
      deuda_comprador_bs: +rows.reduce((sum, row) => sum + safeNum(row.deuda_comprador_bs), 0).toFixed(2),
    },
  };
},
async exportEntregasSimplesResumenXlsx(params: { sellerIds?: string[]; meses?: string[] } = {}) {
  const data = await this.getEntregasSimplesResumen(params);
  const wb = new ExcelJS.Workbook();
  wb.creator = "TuPunto Reports";
  wb.created = new Date();

  const wsResumen = wb.addWorksheet("Resumen");
  wsResumen.addRow([
    "Paquetes",
    "Pagados",
    "Precio paquete Bs",
    "Deuda vendedor Bs",
    "Deuda comprador Bs",
  ]);
  wsResumen.getRow(1).font = { bold: true };
  wsResumen.addRow([
    data.totalGeneral.paquetes,
    data.totalGeneral.pagados,
    data.totalGeneral.precio_paquete_bs,
    data.totalGeneral.deuda_vendedor_bs,
    data.totalGeneral.deuda_comprador_bs,
  ]);
  wsResumen.addRow([]);

  if (data.totalesPorMes.length) {
    const headersMes = Object.keys(data.totalesPorMes[0]);
    wsResumen.addRow(headersMes);
    wsResumen.getRow(wsResumen.rowCount).font = { bold: true };
    data.totalesPorMes.forEach((row) => wsResumen.addRow(headersMes.map((header) => (row as any)[header])));
    wsResumen.addRow([]);
  }

  if (data.totalesPorVendedor.length) {
    const headersSeller = Object.keys(data.totalesPorVendedor[0]);
    wsResumen.addRow(headersSeller);
    wsResumen.getRow(wsResumen.rowCount).font = { bold: true };
    data.totalesPorVendedor.forEach((row) =>
      wsResumen.addRow(headersSeller.map((header) => (row as any)[header])),
    );
    wsResumen.addRow([]);
  }

  if (data.totalesPorMetodoPago.length) {
    const headersMetodo = Object.keys(data.totalesPorMetodoPago[0]);
    wsResumen.addRow(headersMetodo);
    wsResumen.getRow(wsResumen.rowCount).font = { bold: true };
    data.totalesPorMetodoPago.forEach((row) =>
      wsResumen.addRow(headersMetodo.map((header) => (row as any)[header])),
    );
  }
  wsResumen.columns.forEach((column) => (column.width = 22));

  const wsDetalle = wb.addWorksheet("Detalle");
  if (data.rows.length) {
    const headersDetalle = Object.keys(data.rows[0]);
    wsDetalle.addRow(headersDetalle);
    wsDetalle.getRow(1).font = { bold: true };
    data.rows.forEach((row) => wsDetalle.addRow(headersDetalle.map((header) => (row as any)[header])));
    wsDetalle.columns.forEach((column) => (column.width = 22));
  }

  const nombreMeses =
    data.filtros.meses.length <= 1
      ? data.filtros.meses[0] || "sin_mes"
      : `${data.filtros.meses[0]}_a_${data.filtros.meses[data.filtros.meses.length - 1]}`;
  const filename = `entregas_nuevo_servicio_${nombreMeses}.xlsx`;
  const outDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, filename);
  await wb.xlsx.writeFile(filePath);
  return { filePath, filename };
},
async getVentasTemporalesPorVendedor(params: TemporarySellerSalesParams) {
  const sellerId = String(params?.sellerId || "").trim();
  if (!Types.ObjectId.isValid(sellerId)) {
    throw new Error("sellerId inválido");
  }

  const [sellerInfo, rawRows] = await Promise.all([
    ReportsRepository.fetchSellerDisplayInfo(sellerId),
    ReportsRepository.fetchVentasTemporalesPorVendedor({ sellerId }),
  ]);

  if (!sellerInfo) {
    throw new Error("Vendedor no encontrado");
  }

  const detalle = (rawRows as Array<Record<string, any>>).map((row) => {
    const fechaBase = row.fecha_pedido || row.hora_entrega_acordada || row.hora_entrega_real;
    const fechaMoment = fechaBase ? moment.tz(fechaBase, TZ) : null;
    const variante = buildVariantDisplayName({
      producto: row.producto,
      nombreVariante: row.nombre_variante,
      variantes: row.variantes,
    });
    const cantidad = safeNum(row.cantidad);
    const precioUnitario = safeNum(row.precio_unitario);
    const subtotal = safeNum(row.subtotal_bs || cantidad * precioUnitario);
    const utilidad = safeNum(row.utilidad_bs);

    return {
      id_venta: String(row.id_venta || ""),
      id_pedido: String(row.id_pedido || ""),
      id_producto: String(row.id_producto || ""),
      id_vendedor: String(row.id_vendedor || sellerInfo.id_vendedor),
      vendedor: String(row.vendedor || sellerInfo.vendedor),
      fecha: fechaMoment?.isValid() ? fechaMoment.format("YYYY-MM-DD") : "",
      hora: fechaMoment?.isValid() ? fechaMoment.format("HH:mm") : "",
      fecha_pedido: row.fecha_pedido || null,
      hora_entrega_acordada: row.hora_entrega_acordada || null,
      hora_entrega_real: row.hora_entrega_real || null,
      estado_pedido: String(row.estado_pedido || ""),
      tipo_de_pago: String(row.tipo_de_pago || ""),
      cliente: String(row.cliente || ""),
      telefono_cliente: String(row.telefono_cliente || ""),
      sucursal: String(row.sucursal || ""),
      id_sucursal: String(row.id_sucursal || ""),
      lugar_entrega: String(row.lugar_entrega || ""),
      producto: String(row.producto || row.nombre_variante || "Producto temporal"),
      variante,
      producto_variante:
        variante && variante !== "Temporal"
          ? `${String(row.producto || row.nombre_variante || "Producto temporal")} - ${variante}`
          : String(row.producto || row.nombre_variante || "Producto temporal"),
      cantidad,
      precio_unitario_bs: +precioUnitario.toFixed(2),
      subtotal_bs: +subtotal.toFixed(2),
      utilidad_bs: +utilidad.toFixed(2),
      observaciones: String(row.observaciones || ""),
    };
  });

  const resumenMap = new Map<
    string,
    {
      producto: string;
      variante: string;
      producto_variante: string;
      cantidad_total: number;
      ventas: number;
      pedidos: Set<string>;
      total_vendido_bs: number;
      utilidad_total_bs: number;
    }
  >();

  for (const row of detalle) {
    const key = `${normalizeText(row.producto)}|||${normalizeText(row.variante)}`;
    const current = resumenMap.get(key) || {
      producto: row.producto,
      variante: row.variante,
      producto_variante: row.producto_variante,
      cantidad_total: 0,
      ventas: 0,
      pedidos: new Set<string>(),
      total_vendido_bs: 0,
      utilidad_total_bs: 0,
    };

    current.cantidad_total += safeNum(row.cantidad);
    current.ventas += 1;
    if (row.id_pedido) current.pedidos.add(row.id_pedido);
    current.total_vendido_bs += safeNum(row.subtotal_bs);
    current.utilidad_total_bs += safeNum(row.utilidad_bs);
    resumenMap.set(key, current);
  }

  const resumenPorProducto = Array.from(resumenMap.values())
    .map((row) => ({
      producto: row.producto,
      variante: row.variante,
      producto_variante: row.producto_variante,
      cantidad_total: row.cantidad_total,
      ventas: row.ventas,
      pedidos: row.pedidos.size,
      total_vendido_bs: +row.total_vendido_bs.toFixed(2),
      utilidad_total_bs: +row.utilidad_total_bs.toFixed(2),
    }))
    .sort((a, b) => b.cantidad_total - a.cantidad_total || b.total_vendido_bs - a.total_vendido_bs);

  return {
    filtros: { sellerId },
    seller: sellerInfo,
    criterio: {
      incluido: "Solo ventas cuyo producto asociado es temporal (Producto.esTemporal = true).",
      nota: "Cada fila del detalle representa una venta registrada; se muestran fecha, hora, producto, variante y cantidades.",
    },
    detalle,
    resumenPorProducto,
    totalGeneral: {
      ventas: detalle.length,
      pedidos: new Set(detalle.map((row) => row.id_pedido).filter(Boolean)).size,
      cantidad_total: detalle.reduce((sum, row) => sum + safeNum(row.cantidad), 0),
      total_vendido_bs: +detalle.reduce((sum, row) => sum + safeNum(row.subtotal_bs), 0).toFixed(2),
      utilidad_total_bs: +detalle.reduce((sum, row) => sum + safeNum(row.utilidad_bs), 0).toFixed(2),
    },
  };
},
async exportVentasTemporalesPorVendedorXlsx(params: TemporarySellerSalesParams) {
  const data = await this.getVentasTemporalesPorVendedor(params);
  const wb = new ExcelJS.Workbook();
  wb.creator = "TuPunto Reports";
  wb.created = new Date();

  const wsResumen = wb.addWorksheet("Resumen");
  wsResumen.addRow([
    "Vendedor",
    "Id Vendedor",
    "Ventas",
    "Pedidos",
    "Cantidad Total",
    "Total Vendido Bs",
    "Utilidad Total Bs",
  ]);
  wsResumen.getRow(1).font = { bold: true };
  wsResumen.addRow([
    data?.seller?.vendedor || "",
    data?.seller?.id_vendedor || "",
    data?.totalGeneral?.ventas || 0,
    data?.totalGeneral?.pedidos || 0,
    data?.totalGeneral?.cantidad_total || 0,
    data?.totalGeneral?.total_vendido_bs || 0,
    data?.totalGeneral?.utilidad_total_bs || 0,
  ]);
  wsResumen.addRow([]);

  if (data.resumenPorProducto.length) {
    const headersResumenProducto = Object.keys(data.resumenPorProducto[0]);
    wsResumen.addRow(headersResumenProducto);
    wsResumen.getRow(wsResumen.rowCount).font = { bold: true };
    data.resumenPorProducto.forEach((row) =>
      wsResumen.addRow(headersResumenProducto.map((header) => (row as any)[header])),
    );
  }
  wsResumen.columns.forEach((column) => (column.width = 22));

  const wsDetalle = wb.addWorksheet("Detalle");
  if (data.detalle.length) {
    const headersDetalle = Object.keys(data.detalle[0]);
    wsDetalle.addRow(headersDetalle);
    wsDetalle.getRow(1).font = { bold: true };
    data.detalle.forEach((row) =>
      wsDetalle.addRow(headersDetalle.map((header) => (row as any)[header])),
    );
    wsDetalle.columns.forEach((column) => (column.width = 22));
  }

  const safeSellerLabel = normalizeText(data?.seller?.vendedor || data?.seller?.id_vendedor || "vendedor")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "vendedor";
  const filename = `ventas_temporales_${safeSellerLabel}.xlsx`;
  const outDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, filename);
  await wb.xlsx.writeFile(filePath);
  return { filePath, filename };
},
async exportVentasQrXlsx({ meses, sucursalIds }: VentasQrParams) {
  // OJO: getVentasQr espera (mes, meses, sucursalIds) con Params
  const data = await this.getVentasQr({ meses, sucursalIds } as any);

  const wb = new ExcelJS.Workbook();
  wb.creator = "TuPunto Reports";
  wb.created = new Date();

  // ✅ Hoja 1: Resumen por Mes y Sucursal
  const ws1 = wb.addWorksheet("Resumen_Mes_Sucursal");
  const rows1 = data.totalesPorMesYSucursal as Array<{
    mes: string;
    id_sucursal: string;
    sucursal: string;
    pedidos: number;
    unidades: number;
    total_qr_bs: number;
  }>;

  if (rows1.length) {
    const headers = Object.keys(rows1[0]);
    ws1.addRow(headers);
    ws1.getRow(1).font = { bold: true };
    rows1.forEach((r) => ws1.addRow(headers.map((h) => (r as any)[h])));
    ws1.columns.forEach((c) => (c.width = 22));
  }

  // ✅ Hoja 2: Totales por Mes (global)
  const ws2 = wb.addWorksheet("Totales_Por_Mes");
  const rows2 = data.totalesPorMes as Array<{
    mes: string;
    pedidos: number;
    unidades: number;
    total_qr_bs: number;
  }>;

  if (rows2.length) {
    const headers = Object.keys(rows2[0]);
    ws2.addRow(headers);
    ws2.getRow(1).font = { bold: true };
    rows2.forEach((r) => ws2.addRow(headers.map((h) => (r as any)[h])));

    ws2.addRow([]);
    ws2.addRow([
      "TOTAL_GLOBAL",
      data.totalGlobal.pedidos,
      data.totalGlobal.unidades,
      data.totalGlobal.total_qr_bs,
    ]);
    ws2.getRow(ws2.rowCount).font = { bold: true };
    ws2.columns.forEach((c) => (c.width = 22));
  }

  // ✅ Hoja 3: Detalle (por item)
  const ws3 = wb.addWorksheet("Detalle_QR");
  const rows3 = data.detalle as any[];

  if (rows3.length) {
    const headers = Object.keys(rows3[0]);
    ws3.addRow(headers);
    ws3.getRow(1).font = { bold: true };
    rows3.forEach((r: any) => ws3.addRow(headers.map((h) => r[h])));
    ws3.columns.forEach((c) => (c.width = 24));
  }

  const filename =
    data.meses.length === 1
      ? `ventas_qr_${data.meses[0]}.xlsx`
      : `ventas_qr_${data.meses[0]}_a_${data.meses[data.meses.length - 1]}.xlsx`;

  const outDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, filename);

  await wb.xlsx.writeFile(filePath);
  return { filePath, filename };
},

};

