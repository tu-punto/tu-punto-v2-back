import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SellerService } from "./seller.service";
import { FinanceFluxService } from "./financeFlux.service";
import { SucursalsService } from "./sucursals.service";
import { uploadPdfToAws } from "./bucket.service";
import { PaymentProofService } from "./paymentProof.service";
import { SimplePackageService } from "./simplePackage.service";
import { SaleService } from "./sale.service";

const getPdfImageFormat = (contentType: string, url: string) => {
  const normalizedContentType = contentType.toLowerCase();
  const normalizedUrl = url.toLowerCase();

  if (normalizedContentType.includes("jpeg") || normalizedContentType.includes("jpg")) return "JPEG";
  if (normalizedContentType.includes("png")) return "PNG";
  if (normalizedContentType.includes("webp")) return "WEBP";
  if (normalizedUrl.endsWith(".jpg") || normalizedUrl.endsWith(".jpeg")) return "JPEG";
  if (normalizedUrl.endsWith(".webp")) return "WEBP";
  return "PNG";
};

const loadImageAsDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen ${url}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
    format: getPdfImageFormat(contentType, url),
  };
};

const appendSellerQrToPdf = async (doc: jsPDF, seller: any, startY: number) => {
  const qrUrl = String(seller?.qr_pago_url || "").trim();
  if (!qrUrl) return;

  try {
    const { dataUrl, format } = await loadImageAsDataUrl(qrUrl);
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const qrSize = 70;
    const requiredHeight = 18 + qrSize;
    let y = startY;

    if (y + requiredHeight > pageHeight - 10) {
      doc.addPage();
      y = 15;
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("QR DE PAGO DEL VENDEDOR", 10, y);
    doc.addImage(dataUrl, format, (pageWidth - qrSize) / 2, y + 8, qrSize, qrSize);
  } catch (error) {
    console.error("No se pudo agregar el QR al comprobante de pago:", error);
  }
};

const paymentMethodLabelMap: Record<"efectivo" | "qr", string> = {
  efectivo: "Efectivo",
  qr: "QR",
};

const formatBs = (value: number) => `Bs. ${Number(value || 0).toFixed(2)}`;

const drawStruckOriginalPrice = (
  doc: jsPDF,
  hookData: any,
  currentPrice: number,
  originalPrice: number
) => {
  if (!(originalPrice > currentPrice)) return;

  const originalText = formatBs(originalPrice);
  const x = hookData.cell.x + hookData.cell.padding("left");
  const y = hookData.cell.y + hookData.cell.padding("top") + 10;
  const originalWidth = doc.getTextWidth(originalText);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(originalText, x, y);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.4);
  doc.line(x, y - 2, x + originalWidth, y - 2);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
};

const generateSellerPdfBuffer = async (
  sellerId: any,
  paymentMethod: "efectivo" | "qr"
): Promise<Buffer> => {
  const sucursales = await SucursalsService.getAllSucursals();
  const deudas = await FinanceFluxService.getSellerInfoById(sellerId);
  const filteredDeudas = deudas.filter((deuda) => deuda.esDeuda);
  const [sales, simplePackageRows] = await Promise.all([
    SaleService.getProductsBySellerId(sellerId),
    SimplePackageService.getSellerAccountingSimplePackages(String(sellerId)),
  ]);
  const seller = await SellerService.getSeller(sellerId);

  const simplePackagePedidoIds = new Set(
    simplePackageRows
      .map((row: any) => String(row?.pedido_ref?._id || row?.pedido_ref || row?._id || "").trim())
      .filter(Boolean)
  );

  const filteredSales = sales.filter((sale) => {
    const status = String(sale?.id_pedido?.estado_pedido || "").trim().toLowerCase();
    const pedidoId = String(sale?.id_pedido?._id || sale?.id_pedido || "").trim();
    return (
      !sale.deposito_realizado &&
      (status === "entregado" || status === "interno") &&
      sale?.id_pedido?.simple_package_order !== true &&
      !simplePackagePedidoIds.has(pedidoId)
    );
  });

  const simplePackageSales = simplePackageRows.map((row: any) => ({
    nombre_variante: row.descripcion_paquete || "Paquete simple",
    precio_unitario: Number(row.saldo_por_paquete ?? 0),
    precio_original: Number(row.saldo_por_paquete ?? 0),
    cantidad: 1,
    utilidad: 0,
    id_sucursal: (row?.origen_sucursal as any)?._id || row?.origen_sucursal || row?.sucursal,
    deposito_realizado: !!row.deposito_realizado,
    fecha_pedido: row.fecha_pedido,
    id_pedido: {
      _id: `simple-${row._id}`,
      estado_pedido: row.estado_pedido || "Entregado",
      pagado_al_vendedor: false,
      adelanto_cliente: 0,
      cargo_delivery: 0,
      fecha_pedido: row.fecha_pedido,
    },
  }));

  const allSales = [...filteredSales, ...simplePackageSales];
  const pedidos = Array.from(new Set(allSales.map((sale) => sale.id_pedido)));
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.width;
  const title = "COMPROBANTE DE PAGO";
  const titleWidth = doc.getTextWidth(title);
  const titleX = (pageWidth - titleWidth) / 2;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, titleX, 10);

  const salesTableData = allSales.map((sale: any) => {
    const foundSucursal = sucursales.find(
      (sucursal) => sale.id_sucursal.toString() === sucursal._id.toString()
    );

    return {
      fecha: new Date(sale.fecha_pedido).toLocaleDateString("es-BO"),
      producto: sale.nombre_variante,
      sucursal: foundSucursal?.nombre || "Sucursal desconocida",
      precio_unitario: Number(sale.precio_unitario || 0),
      precio_original: Number(sale.precio_original ?? sale.precio_unitario),
      ocultar_precio: false,
      cantidad: sale.cantidad,
      subtotal: !sale.id_pedido.pagado_al_vendedor
        ? formatBs(sale.cantidad * sale.precio_unitario)
        : "Bs. 0",
      subtotal_comision: !sale.id_pedido.pagado_al_vendedor
        ? formatBs(sale.cantidad * sale.precio_unitario - sale.utilidad)
        : `Bs. -${sale.utilidad.toFixed(2)}`,
    };
  });

  const totalVentas = allSales.reduce((acc: number, sale: any) => {
    if (!sale.id_pedido.pagado_al_vendedor) {
      return acc + sale.cantidad * sale.precio_unitario;
    }
    return acc;
  }, 0);

  const totalVentasComision = allSales.reduce((acc: number, sale: any) => {
    if (!sale.id_pedido.pagado_al_vendedor) {
      return acc + sale.cantidad * sale.precio_unitario - sale.utilidad;
    }
    return acc - sale.utilidad;
  }, 0);

  salesTableData.push({
    fecha: "TOTAL VENTAS",
    producto: "",
    sucursal: "",
    precio_unitario: 0,
    precio_original: 0,
    ocultar_precio: true,
    cantidad: "",
    subtotal: formatBs(totalVentas),
    subtotal_comision: formatBs(totalVentasComision),
  });

  autoTable(doc, {
    startY: 20,
    head: [[
      "FECHA",
      "PRODUCTO",
      "SUCURSAL",
      "PRECIO",
      "CANTIDAD",
      "SUBTOTAL",
      "SUBTOTAL - COMISION",
    ]],
    columns: [
      { header: "FECHA", dataKey: "fecha" },
      { header: "PRODUCTO", dataKey: "producto" },
      { header: "SUCURSAL", dataKey: "sucursal" },
      { header: "PRECIO", dataKey: "precio_unitario" },
      { header: "CANTIDAD", dataKey: "cantidad" },
      { header: "SUBTOTAL", dataKey: "subtotal" },
      { header: "SUBTOTAL - COMISION", dataKey: "subtotal_comision" },
    ],
    body: salesTableData,
    didParseCell: (hookData) => {
      if (hookData.section !== "body") return;
      if (hookData.column.dataKey !== "precio_unitario") return;

      const row = hookData.row.raw as any;
      if (row?.ocultar_precio) {
        hookData.cell.text = [""];
        return;
      }

      hookData.cell.text = [formatBs(Number(row.precio_unitario || 0))];
      if (Number(row?.precio_original || 0) > Number(row?.precio_unitario || 0)) {
        hookData.cell.styles.minCellHeight = Math.max(Number(hookData.cell.styles.minCellHeight || 0), 14);
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section !== "body") return;
      if (hookData.column.dataKey !== "precio_unitario") return;

      const row = hookData.row.raw as any;
      const currentPrice = Number(row?.precio_unitario || 0);
      const originalPrice = Number(row?.precio_original || 0);
      drawStruckOriginalPrice(doc, hookData, currentPrice, originalPrice);
    },
    styles: { fontSize: 10 },
  });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ADELANTOS PAGADOS AL VENDEDOR", 10, (doc as any).lastAutoTable.finalY + 10);

  const adelantosTableData = pedidos
    .filter((pedido: any) => pedido.adelanto_cliente > 0)
    .map((pedido: any) => [
      new Date(pedido.fecha_pedido).toLocaleDateString("es-BO"),
      pedido.adelanto_cliente.toFixed(2),
    ]);

  const totalAdelantos = pedidos.reduce(
    (acc: number, pedido: any) => acc + Number(pedido.adelanto_cliente || 0),
    0
  );

  adelantosTableData.push([
    "TOTAL ADELANTOS",
    totalAdelantos > 0 ? `Bs. -${totalAdelantos}` : `Bs. ${totalAdelantos}`,
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["FECHA", "MONTO ADELANTO AL VENDEDOR"]],
    body: adelantosTableData,
    styles: { fontSize: 10 },
  });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text("DELIVERYS PAGADOS POR EL VENDEDOR", 10, (doc as any).lastAutoTable.finalY + 10);

  const deliverysTableData = pedidos
    .filter((pedido: any) => pedido.cargo_delivery > 0)
    .map((pedido: any) => [
      new Date(pedido.fecha_pedido).toLocaleDateString("es-BO"),
      pedido.cargo_delivery.toFixed(2),
    ]);

  const totalDeliverys = pedidos.reduce(
    (acc: number, pedido: any) => acc + Number(pedido.cargo_delivery || 0),
    0
  );

  deliverysTableData.push([
    "TOTAL DELIVERYS",
    totalDeliverys > 0 ? `Bs. -${totalDeliverys}` : `Bs. ${totalDeliverys}`,
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["FECHA", "MONTO COBRADO POR DELIVERY"]],
    body: deliverysTableData,
    styles: { fontSize: 10 },
  });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text("DEUDAS DESCONTADAS", 10, (doc as any).lastAutoTable.finalY + 10);

  const mensualidadesTableData = filteredDeudas.map((deuda: any) => [
    new Date(deuda.fecha).toLocaleDateString("es-BO"),
    deuda.clase_cobro === "RECUPERACION" ? "Recuperacion" : "Servicio",
    deuda.concepto,
    deuda.monto.toFixed(2),
  ]);

  const totalMensualidades = filteredDeudas.reduce(
    (acc: number, deuda: any) => acc + Number(deuda.monto || 0),
    0
  );

  mensualidadesTableData.push([
    "TOTAL DEUDAS",
    "",
    "",
    totalMensualidades > 0 ? `Bs. -${totalMensualidades}` : `Bs. ${totalMensualidades}`,
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["FECHA", "TIPO", "CONCEPTO", "MONTO"]],
    body: mensualidadesTableData,
    styles: { fontSize: 10 },
  });

  const montoPagado = totalVentasComision - totalAdelantos - totalDeliverys - totalMensualidades;
  const amountY = (doc as any).lastAutoTable.finalY + 20;
  doc.text(`MONTO PAGADO: Bs. ${montoPagado}`, 10, amountY);
  doc.text(`METODO DE PAGO AL VENDEDOR: ${paymentMethodLabelMap[paymentMethod]}`, 10, amountY + 8);

  await appendSellerQrToPdf(doc, seller, amountY + 23);

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `comprobante_pago_${seller?.nombre}_${seller?.apellido}_${new Date().toISOString()}.pdf`;
  const pdfUrl = await uploadPdfToAws(pdfBuffer, filename);

  const savedUrl = await PaymentProofService.createComprobante({
    vendedor: sellerId,
    comprobante_entrada_pdf: pdfUrl.url,
    metodo_pago: paymentMethod,
    monto_pagado: montoPagado,
    total_ventas: totalVentasComision,
    total_adelantos: totalAdelantos,
    total_deliverys: totalDeliverys,
    total_mensualidades: totalMensualidades,
  });
  console.log("Comprobante de pago guardado con URL:", savedUrl);

  return pdfBuffer;
};

export const SellerPdfService = {
  generateSellerPdfBuffer,
};
