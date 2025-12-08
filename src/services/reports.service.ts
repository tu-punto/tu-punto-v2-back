import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";
import moment from "moment-timezone";
import { ReportsRepository } from "../repositories/reports.repository";

const TZ = "America/La_Paz";

type Params = {
  mes: string;                    // "YYYY-MM"
  sucursalIds?: string[];
  modoTop?: "clientes" | "vendedores";
};

function monthRange(mes: string) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error("mes debe ser 'YYYY-MM'");
  const start = moment.tz(`${mes}-01 00:00:00`, TZ).toDate();
  const end = moment(start).add(1, "month").toDate();
  return { start, end };
}

function getSucursalFromPedido(p:any) {
  // preferimos pedido.sucursal; fallback lugar_origen
  const id = (p.sucursal?._id || p.sucursal) || (p.lugar_origen?._id || p.lugar_origen);
  const nombre = (p.sucursal?.nombre) || (p.lugar_origen?.nombre) || "Sin Sucursal";
  return { id: String(id || ""), nombre };
}

function safeNum(n:any) { return (typeof n === "number" && !isNaN(n)) ? n : 0; }

export const ReportsService = {
  async getOperacionMensual({ mes, sucursalIds, modoTop = "clientes" }: Params) {
    const { start, end } = monthRange(mes);
    const pedidos = await ReportsRepository.fetchPedidosMensual({ start, end, sucursalIds });

    // Catálogos auxiliares
    const sucMap = new Map<string, string>(); // id -> nombre
    const pushSucursal = (id:string, nombre:string) => { if (id) sucMap.set(id, nombre); };

    // ------------- Preparación de colecciones base -------------
    type VentaLike = {
      sucursalId: string;
      sucursalNombre: string;
      productoId?: string;   // undefined en temporales
      productoNombre: string;
      cantidad: number;
      precioUnit: number;
      vendedorId?: string;
      vendedorNombre?: string;
    };

    const ventas: VentaLike[] = [];          // ventas “normales” + temporales
    const pedidosFlat: any[] = [];           // para métricas por pedido
    const clientesPorPedido: { sucursalId: string; clave: string; }[] = [];

    for (const p of pedidos) {
      const { id: sucursalId, nombre: sucursalNombre } = getSucursalFromPedido(p);
      pushSucursal(sucursalId, sucursalNombre);

      // totales por pedido
      const totalCobrado = safeNum(p.subtotal_qr) + safeNum(p.subtotal_efectivo) + safeNum(p.cargo_delivery);
      pedidosFlat.push({
        sucursalId, sucursalNombre,
        fecha: p.hora_entrega_real || p.fecha_pedido,
        totalCobrado,
        costoDelivery: safeNum(p.costo_delivery),
      });

      // clave cliente (teléfono o nombre)
      const claveCliente = p.telefono_cliente || p.cliente || "";
      if (claveCliente) clientesPorPedido.push({ sucursalId, clave: String(claveCliente) });

      // ventas normales (array Venta poblada)
      if (Array.isArray(p.venta)) {
        for (const vRaw of p.venta as any[]) {
          // guardia runtime
          if (!(vRaw && typeof vRaw === "object" && "cantidad" in vRaw && "precio_unitario" in vRaw)) continue;

          const v = vRaw as {
            cantidad: number; precio_unitario: number; nombre_variante?: string;
            sucursal?: any; producto?: any; vendedor?: any;
          };

          const cantidad = safeNum(v.cantidad);
          const precio   = safeNum(v.precio_unitario);
          if (!cantidad || !precio) continue;

          const sIdRaw = typeof v.sucursal === "string" ? v.sucursal : (v.sucursal?._id ?? sucursalId);
          const sId = String(sIdRaw); 
          const sNom = (typeof v.sucursal === "string")
            ? (sucMap.get(sId) || sucursalNombre)
            : (v.sucursal?.nombre || sucursalNombre);

          const prodId = typeof v.producto === "string" ? v.producto : v.producto?._id;
          const prodName = v.producto?.nombre_producto ?? v.nombre_variante ?? "Producto";
          const vendedorId = typeof v.vendedor === "string" ? v.vendedor : v.vendedor?._id;
          const vendedorNombre = v.vendedor?.nombre && v.vendedor?.apellido ? `${v.vendedor.nombre} ${v.vendedor.apellido}` : undefined;

          ventas.push({
            sucursalId: sId,
            sucursalNombre: sNom,
            productoId: v?.producto?._id ? String(v.producto._id) : (v?.producto ? String(v.producto) : undefined),
            productoNombre: v?.producto?.nombre_producto || v?.nombre_variante || "Producto",
            cantidad,
            precioUnit: precio,
            vendedorId: v?.vendedor ? String(v.vendedor._id || v.vendedor) : undefined,
            vendedorNombre: v?.vendedor?.nombre && v?.vendedor?.apellido
              ? `${v.vendedor.nombre} ${v.vendedor.apellido}` : undefined,
          });
        }
      }

      // productos temporales (cuentan para top productos / monto; también para top “vendedores” si viene id_vendedor)
      if (Array.isArray(p.productos_temporales)) {
        for (const t of p.productos_temporales) {
          const cantidad = safeNum(t?.cantidad);
          const precio = safeNum(t?.precio_unitario);
          if (!cantidad || !precio) continue;

          ventas.push({
            sucursalId,
            sucursalNombre,
            productoId: undefined,
            productoNombre: `TEMP: ${t.producto}`,
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
      // key = sucursalId|productoKey
      const acc = new Map<string, { sucursalId:string; productoId?:string; productoNombre:string; unidades:number; monto:number; }>();
      for (const v of ventas) {
        const productoKey = v.productoId ? `id:${v.productoId}` : `nom:${v.productoNombre}`;
        const key = `${v.sucursalId}|${productoKey}`;
        const got = acc.get(key) || { sucursalId: v.sucursalId, productoId: v.productoId, productoNombre: v.productoNombre, unidades:0, monto:0 };
        got.unidades += v.cantidad;
        got.monto += v.cantidad * v.precioUnit;
        acc.set(key, got);
      }
      // Rank por sucursal
      const porSuc = new Map<string, any[]>();
      for (const row of acc.values()) {
        const arr = porSuc.get(row.sucursalId) || [];
        arr.push(row);
        porSuc.set(row.sucursalId, arr);
      }
      for (const [sucId, arr] of porSuc.entries()) {
        arr.sort((a,b)=> (b.unidades - a.unidades) || (b.monto - a.monto));
        const top = arr.slice(0,10).map((r, i)=>({
          id_sucursal: sucId,
          sucursal: sucMap.get(sucId) || "",
          id_producto: r.productoId || null,
          nombre_producto: r.productoNombre,
          unidades: r.unidades,
          monto_bs: +r.monto.toFixed(2),
          rank: i+1
        }));
        topProductosPorSucursal.push(...top);
      }
      topProductosPorSucursal.sort((a,b)=> (a.id_sucursal.localeCompare(b.id_sucursal)) || (a.rank-b.rank));
    }

    // ------------- 2) Top 10 (clientes o vendedores) GLOBAL -------------
    let topGlobal: any[] = [];
    if (modoTop === "vendedores") {
      const acc = new Map<string, { vendedorId:string; vendedor:string; pedidos:Set<string>; monto:number }>();
      // sumamos por vendedor (incluye temporales si traen id_vendedor)
      for (const v of ventas) {
        if (!v.vendedorId) continue;
        const k = v.vendedorId;
        const got = acc.get(k) || { vendedorId: k, vendedor: v.vendedorNombre || k, pedidos: new Set(), monto: 0 };
        got.monto += v.cantidad * v.precioUnit;
        acc.set(k, got);
      }
      topGlobal = Array.from(acc.values())
        .map(g => ({ id_vendedor: g.vendedorId, vendedor: g.vendedor, monto_bs: +g.monto.toFixed(2) }))
        .sort((a,b)=> b.monto_bs - a.monto_bs)
        .slice(0,10);
    } else {
      // clientes compradores
      const acc = new Map<string, { cliente:string; pedidos:number; monto:number; tks:number }>();
      for (const p of pedidosFlat) {
        const clave = (p as any).__clienteClave || "";// fallback si se setea luego
      }
      // mejor: recalc a partir de pedidos reales
      const acc2 = new Map<string, { cliente:string; monto:number; pedidos:number }>();
      for (const p of (pedidos as any[])) {
        const clave = p.telefono_cliente || p.cliente || "";
        if (!clave) continue;
        const totalCobrado = safeNum(p.subtotal_qr)+safeNum(p.subtotal_efectivo)+safeNum(p.cargo_delivery);
        const got = acc2.get(clave) || { cliente: p.cliente || String(clave), monto: 0, pedidos: 0 };
        got.monto += totalCobrado;
        got.pedidos += 1;
        acc2.set(clave, got);
      }
      topGlobal = Array.from(acc2.values())
        .map(g => ({
          cliente: g.cliente,
          pedidos: g.pedidos,
          monto_bs: +g.monto.toFixed(2),
          ticket_promedio_bs: +(g.monto / g.pedidos || 0).toFixed(2)
        }))
        .sort((a,b)=> b.monto_bs - a.monto_bs)
        .slice(0,10);
    }

    // ------------- 3) Delivery promedio por sucursal -------------
    const deliveryPromedioPorSucursal: any[] = [];
    {
      const acc = new Map<string, { sucursalId:string; sum:number; sumPos:number; n:number; nPos:number }>();
      for (const p of pedidosFlat) {
        const k = p.sucursalId;
        const got = acc.get(k) || { sucursalId:k, sum:0, sumPos:0, n:0, nPos:0 };
        got.sum += p.costoDelivery;
        got.n += 1;
        if (p.costoDelivery > 0) { got.sumPos += p.costoDelivery; got.nPos += 1; }
        acc.set(k, got);
      }
      for (const a of acc.values()) {
        deliveryPromedioPorSucursal.push({
          id_sucursal: a.sucursalId,
          sucursal: sucMap.get(a.sucursalId) || "",
          envios: a.n,
          promedio_bs: +(a.sum / (a.n || 1)).toFixed(2),
          promedio_sin_ceros_bs: +(a.sumPos / (a.nPos || 1)).toFixed(2)
        });
      }
      deliveryPromedioPorSucursal.sort((a,b)=> a.sucursal.localeCompare(b.sucursal));
    }

    // ------------- 4) Clientes atendidos por hora (L–S) por sucursal -------------
    const clientesPorHoraMensual: any[] = [];
    {
      const acc = new Map<string, number>(); // key = sucursalId|hora
      for (const p of pedidosFlat) {
        const base = p.fecha ? moment.tz(p.fecha, TZ) : null;
        if (!base) continue;
        const dow = base.isoWeekday(); // 1=Lunes ... 7=Domingo
        if (dow < 1 || dow > 6) continue; // L–S
        const hora = base.hour();
        const key = `${p.sucursalId}|${hora}`;
        acc.set(key, (acc.get(key) || 0) + 1);
      }
      // expand 0..23 por sucursal
      for (const [sucId, sucNombre] of sucMap.entries()) {
        for (let h=0; h<24; h++) {
          const key = `${sucId}|${h}`;
          const count = acc.get(key) || 0;
          clientesPorHoraMensual.push({
            id_sucursal: sucId,
            sucursal: sucNombre,
            hora: h,
            clientes_atendidos: count
          });
        }
      }
      clientesPorHoraMensual.sort((a,b)=> a.sucursal.localeCompare(b.sucursal) || (a.hora-b.hora));
    }

    // ------------- 5) Ticket promedio por sucursal y global -------------
    let ticketPromedioPorSucursal:any[] = [], ticketPromedioGlobal:any = {};
    {
      const acc = new Map<string, { sum:number; n:number }>();
      let sumG=0, nG=0;
      for (const p of pedidosFlat) {
        const total = p.totalCobrado;
        const got = acc.get(p.sucursalId) || { sum:0, n:0 };
        got.sum += total; got.n += 1; acc.set(p.sucursalId, got);
        sumG += total; nG += 1;
      }
      for (const [sId, a] of acc.entries()) {
        ticketPromedioPorSucursal.push({
          id_sucursal: sId,
          sucursal: sucMap.get(sId) || "",
          pedidos: a.n,
          ticket_promedio_bs: +(a.sum / (a.n || 1)).toFixed(2)
        });
      }
      ticketPromedioPorSucursal.sort((a,b)=> a.sucursal.localeCompare(b.sucursal));
      ticketPromedioGlobal = {
        pedidos: nG,
        ticket_promedio_bs: +(sumG / (nG || 1)).toFixed(2)
      };
    }

    // ------------- 6) Clientes activos (por sucursal y global) -------------
    let clientesActivosPorSucursal:any[] = [], clientesActivosGlobal:any = {};
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
          clientes_activos: set.size
        });
      }
      clientesActivosPorSucursal.sort((a,b)=> a.sucursal.localeCompare(b.sucursal));
      clientesActivosGlobal = { clientes_activos: global.size };
    }

    // ------------- 7) Monto vendido (mensual y por sucursal) -------------
    const ventasMensualPorSucursal:any[] = [];
    {
      const acc = new Map<string, { monto:number; ventas:number; pedidos:Set<string> }>();
      for (const v of ventas) {
        const k = v.sucursalId;
        const got = acc.get(k) || { monto:0, ventas:0, pedidos:new Set() };
        got.monto += v.cantidad * v.precioUnit;
        got.ventas += 1;
        acc.set(k, got);
      }
      for (const [sId, a] of acc.entries()) {
        ventasMensualPorSucursal.push({
          mes,
          id_sucursal: sId,
          sucursal: sucMap.get(sId) || "",
          ventas: a.ventas,
          pedidos: undefined, // si quisieras contar pedidos únicos, agrega IDs arriba
          monto_bs: +a.monto.toFixed(2)
        });
      }
      ventasMensualPorSucursal.sort((a,b)=> a.sucursal.localeCompare(b.sucursal));
    }

    return {
      mes,
      topProductosPorSucursal,
      topGlobal,
      deliveryPromedioPorSucursal,
      clientesPorHoraMensual,
      ticketPromedioPorSucursal,
      ticketPromedioGlobal,
      clientesActivosPorSucursal,
      clientesActivosGlobal,
      ventasMensualPorSucursal
    };
  },

  async exportOperacionMensualXlsx(params: Params) {
    const data = await this.getOperacionMensual(params);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TuPunto Reports";
    wb.created = new Date();

    const addSheet = (name:string, rows:any[]) => {
      const ws = wb.addWorksheet(name);
      if (!rows.length) return ws;
      const headers = Object.keys(rows[0]);
      ws.addRow(headers);
      rows.forEach(r => ws.addRow(headers.map(h => (r as any)[h])));
      ws.getRow(1).font = { bold: true };
      ws.columns?.forEach(c => { c.width = 20; });
      return ws;
    };

    addSheet("Top10_Productos_por_Sucursal", data.topProductosPorSucursal);
    addSheet("Top10_Global", data.topGlobal);
    addSheet("Delivery_Promedio", data.deliveryPromedioPorSucursal);

    // Pivot Clientes x Hora (una fila por sucursal-hora ya sirve; si quieres pivot real, lo armamos luego)
    addSheet("Clientes_por_Hora_(Mes)", data.clientesPorHoraMensual);

    addSheet("Ticket_Promedio_Por_Sucursal", data.ticketPromedioPorSucursal);
    addSheet("Ticket_Promedio_Global", [data.ticketPromedioGlobal]);
    addSheet("Clientes_Activos_Por_Sucursal", data.clientesActivosPorSucursal);
    addSheet("Clientes_Activos_Global", [data.clientesActivosGlobal]);
    addSheet("Ventas_Mensual_Por_Sucursal", data.ventasMensualPorSucursal);

    const filename = `operacion_mensual_${data.mes}.xlsx`;
    const outDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, filename);
    await wb.xlsx.writeFile(filePath);

    return { filePath, filename };
  }
};
