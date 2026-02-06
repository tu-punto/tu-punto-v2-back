// src/services/reports.service.ts
import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";
import moment from "moment-timezone";
import { ReportsRepository } from "../repositories/reports.repository";

const TZ = "America/La_Paz";

type Params = {
  mes?: string; // YYYY-MM
  meses?: string[]; // YYYY-MM[]
  sucursalIds?: string[];
  modoTop?: "clientes" | "vendedores";
  reportes?: string[];
  columnas?: Record<string, string[]>;
};

type ExportStockParams = { idSucursal: string };

type ExportComisionesParams = {
  mesFin: string; // YYYY-MM
  sucursalIds?: string[];
};

type StockRow = {
  producto: string;
  variante: string;
  id_vendedor: string;
  vendedor: string;
  stock: number;
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
  return typeof n === "number" && !isNaN(n) ? n : 0;
}
type ExportIngresos3MParams = {
  mesFin: string; 
  incluirDeuda?: boolean; 
};

type ExportClientesActivosParams = { mesFin: string };
function rangeOctToToday() {
  const hoy = moment.tz(TZ).endOf("day").toDate();
  const start = moment.tz("2025-10-01 00:00:00", TZ).toDate(); // Oct 1, 2025
  return { start, end: hoy };
};


export const ReportsService = {
  async getOperacionMensual({ mes, meses, sucursalIds, modoTop = "clientes" }: Params) {
    const mesesSeleccionados = normalizeMeses(mes, meses);
    const { start, end } = rangeMeses(mesesSeleccionados);
    const mesSet = new Set(mesesSeleccionados);
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
      productoNombre: string;
      productoCategoria?: string;
      mes: string;
      cantidad: number;
      precioUnit: number;
      vendedorId?: string;
      vendedorNombre?: string;
    };

    const ventas: VentaLike[] = [];
    const pedidosFlat: any[] = [];
    const clientesPorPedido: { sucursalId: string; clave: string }[] = [];

    for (const p of pedidos as any[]) {
      const fechaBase = p.hora_entrega_real || p.fecha_pedido;
      const mesPedido = fechaBase ? moment.tz(fechaBase, TZ).format("YYYY-MM") : "";
      if (!mesPedido || !mesSet.has(mesPedido)) continue;

      const { id: sucursalId, nombre: sucursalNombre } = getSucursalFromPedido(p);
      pushSucursal(sucursalId, sucursalNombre);

      // totales por pedido
      const totalCobrado =
        safeNum(p.subtotal_qr) + safeNum(p.subtotal_efectivo) + safeNum(p.cargo_delivery);

      pedidosFlat.push({
        sucursalId,
        sucursalNombre,
        fecha: fechaBase,
        mes: mesPedido,
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
          const baseNombre = v?.producto?.nombre_producto || v?.nombre_variante || "Producto";
          const nombreCompleto =
            v?.producto?.nombre_producto && v?.nombre_variante
              ? `${v.producto.nombre_producto} - ${v.nombre_variante}`
              : baseNombre;

          ventas.push({
            sucursalId: sId,
            sucursalNombre: sNom,
            productoId: v?.producto?._id ? String(v.producto._id) : (v?.producto ? String(v.producto) : undefined),
            productoNombre: nombreCompleto,
            productoCategoria: categoriaNombre || undefined,
            mes: mesPedido,
            cantidad,
            precioUnit: precio,
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
            vendedorId: t?.id_vendedor ? String(t.id_vendedor) : undefined,
            vendedorNombre: undefined,
          });
        }
      }
    }

    // ------------- 1) Top 10 productos por sucursal -------------
    const topProductosPorSucursal: any[] = [];
    {
      const acc = new Map<
        string,
        { sucursalId: string; productoId?: string; productoNombre: string; productoCategoria?: string; unidades: number; monto: number }
      >();

      for (const v of ventas) {
        const productoKey = v.productoId ? `id:${v.productoId}` : `nom:${v.productoNombre}`;
        const key = `${v.sucursalId}|${productoKey}`;
        const got =
          acc.get(key) || {
            sucursalId: v.sucursalId,
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
        const arr = porSuc.get(row.sucursalId) || [];
        arr.push(row);
        porSuc.set(row.sucursalId, arr);
      }

      for (const [sucId, arr] of porSuc.entries()) {
        arr.sort((a, b) => (b.unidades - a.unidades) || (b.monto - a.monto));
        const top = arr.slice(0, 10).map((r, i) => ({
          id_sucursal: sucId,
          sucursal: sucMap.get(sucId) || "",
          categoria: r.productoCategoria || "",
          id_producto: r.productoId || null,
          nombre_producto: r.productoNombre,
          unidades: r.unidades,
          monto_bs: +r.monto.toFixed(2),
          rank: i + 1,
        }));
        topProductosPorSucursal.push(...top);
      }

      topProductosPorSucursal.sort(
        (a, b) => a.id_sucursal.localeCompare(b.id_sucursal) || (a.rank - b.rank),
      );
    }

    // ------------- 2) Top 10 (clientes o vendedores) GLOBAL -------------
    let topGlobal: any[] = [];
    if (modoTop === "vendedores") {
      const acc = new Map<string, { vendedorId: string; vendedor: string; monto: number }>();

      for (const v of ventas) {
        if (!v.vendedorId) continue;
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
    {
      const acc = new Map<string, { sucursalId: string; sum: number; sumPos: number; n: number; nPos: number }>();

      for (const p of pedidosFlat) {
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
        const esEntrega = safeNum(p.cargoDelivery) > 0 || safeNum(p.costoDelivery) > 0;
        if (!esEntrega) continue;
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
    {
      const acc = new Map<string, number>(); // sucursalId|hora

      for (const p of pedidosFlat) {
        const base = p.fecha ? moment.tz(p.fecha, TZ) : null;
        if (!base) continue;
        const dow = base.isoWeekday(); // 1=Lunes ... 7=Domingo
        if (dow < 1 || dow > 6) continue; // L–S
        const hora = base.hour();
        const key = `${p.sucursalId}|${hora}`;
        acc.set(key, (acc.get(key) || 0) + 1);
      }

      for (const [sucId, sucNombre] of sucMap.entries()) {
        for (let h = 0; h < 24; h++) {
          const key = `${sucId}|${h}`;
          const count = acc.get(key) || 0;
          clientesPorHoraMensual.push({
            id_sucursal: sucId,
            sucursal: sucNombre,
            hora: h,
            clientes_atendidos: count,
          });
        }
      }

      clientesPorHoraMensual.sort((a, b) => a.sucursal.localeCompare(b.sucursal) || (a.hora - b.hora));
    }

    // ------------- 5) Ticket promedio por sucursal y global -------------
    let ticketPromedioPorSucursal: any[] = [];
    let ticketPromedioGlobal: any = {};
    {
      const acc = new Map<string, { sum: number; n: number }>();
      let sumG = 0;
      let nG = 0;

      for (const p of pedidosFlat) {
        const total = p.totalCobrado;
        const got = acc.get(p.sucursalId) || { sum: 0, n: 0 };
        got.sum += total;
        got.n += 1;
        acc.set(p.sucursalId, got);
        sumG += total;
        nG += 1;
      }

      for (const [sId, a] of acc.entries()) {
        ticketPromedioPorSucursal.push({
          id_sucursal: sId,
          sucursal: sucMap.get(sId) || "",
          ticket_promedio_bs: +(a.sum / (a.n || 1)).toFixed(2),
        });
      }

      ticketPromedioPorSucursal.sort((a, b) => a.sucursal.localeCompare(b.sucursal));
      ticketPromedioGlobal = {
        pedidos: nG,
        ticket_promedio_bs: +(sumG / (nG || 1)).toFixed(2),
      };
    }

    // ------------- 6) Clientes activos (por sucursal y global) -------------
    let clientesActivosPorSucursal: any[] = [];
    let clientesActivosGlobal: any = {};
    {
      const porSuc = new Map<string, Set<string>>();
      const global = new Set<string>();

      for (const c of clientesPorPedido) {
        if (!c.clave) continue;
        global.add(c.clave);
        const set = porSuc.get(c.sucursalId) || new Set<string>();
        set.add(c.clave);
        porSuc.set(c.sucursalId, set);
      }

      for (const [sId, set] of porSuc.entries()) {
        clientesActivosPorSucursal.push({
          id_sucursal: sId,
          sucursal: sucMap.get(sId) || "",
          clientes_activos: set.size,
        });
      }

      clientesActivosPorSucursal.sort((a, b) => a.sucursal.localeCompare(b.sucursal));
      clientesActivosGlobal = { clientes_activos: global.size };
    }

    // ------------- 7) Monto vendido (mensual y por sucursal) -------------
    const ventasMensualPorSucursal: any[] = [];
    {
      const acc = new Map<string, { sucursalId: string; mes: string; monto: number; ventas: number }>();

      for (const v of ventas) {
        const k = `${v.sucursalId}|${v.mes}`;
        const got = acc.get(k) || { sucursalId: v.sucursalId, mes: v.mes, monto: 0, ventas: 0 };
        got.monto += v.cantidad * v.precioUnit;
        got.ventas += 1;
        acc.set(k, got);
      }

      for (const a of acc.values()) {
        ventasMensualPorSucursal.push({
          mes: a.mes,
          id_sucursal: a.sucursalId,
          sucursal: sucMap.get(a.sucursalId) || "",
          ventas: a.ventas,
          monto_bs: +a.monto.toFixed(2),
        });
      }

      ventasMensualPorSucursal.sort((a, b) => a.sucursal.localeCompare(b.sucursal));
    }

    return {
      meses: mesesSeleccionados,
      topProductosPorSucursal,
      topGlobal,
      deliveryPromedioPorSucursal,
      costoEntregaPromedioPorSucursal,
      costoEntregaPromedioGlobal,
      clientesPorHoraMensual,
      ticketPromedioPorSucursal,
      ticketPromedioGlobal,
      clientesActivosPorSucursal,
      clientesActivosGlobal,
      ventasMensualPorSucursal,
    };
  },

  async exportOperacionMensualXlsx(params: Params) {
    const data = await this.getOperacionMensual(params);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const reportesSet = params.reportes && params.reportes.length ? new Set(params.reportes) : null;
    if (reportesSet?.has("ticketPromedioPorSucursal")) reportesSet.add("ticketPromedioGlobal");
    if (reportesSet?.has("clientesActivosPorSucursal")) reportesSet.add("clientesActivosGlobal");
    if (reportesSet?.has("costoEntregaPromedioPorSucursal")) reportesSet.add("costoEntregaPromedioGlobal");
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
    addSheet("Costo_Entrega_Promedio", "costoEntregaPromedioPorSucursal", data.costoEntregaPromedioPorSucursal);
    addSheet("Costo_Entrega_Global", "costoEntregaPromedioGlobal", [data.costoEntregaPromedioGlobal]);
    addSheet("Clientes_por_Hora_(Mes)", "clientesPorHoraMensual", data.clientesPorHoraMensual);
    addSheet("Ticket_Promedio_Por_Sucursal", "ticketPromedioPorSucursal", data.ticketPromedioPorSucursal);
    addSheet("Ticket_Promedio_Global", "ticketPromedioGlobal", [data.ticketPromedioGlobal]);
    addSheet("Clientes_Activos_Por_Sucursal", "clientesActivosPorSucursal", data.clientesActivosPorSucursal);
    addSheet("Clientes_Activos_Global", "clientesActivosGlobal", [data.clientesActivosGlobal]);
    addSheet("Ventas_Mensual_Por_Sucursal", "ventasMensualPorSucursal", data.ventasMensualPorSucursal);

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

  async exportComisiones3MesesXlsx({ mesFin, sucursalIds }: ExportComisionesParams) {
    const { start, end } = rangeUltimos3Meses(mesFin);
    const meses = listaMeses3(mesFin);

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
    const { start, end } = rangeUltimos4Meses(mesFin);
    const meses = listaMeses4(mesFin); // ["2025-10","2025-11","2025-12"]

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
  const meses = listaMeses3(mesFin);
  const { start, end } = rangeUltimos3Meses(mesFin);

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


};
