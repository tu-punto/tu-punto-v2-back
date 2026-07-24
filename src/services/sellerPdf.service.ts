import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SaleService } from "./sale.service";
import { SellerService } from "./seller.service";
import { FinanceFluxService } from "./financeFlux.service";
import { SucursalsService } from "./sucursals.service";
import { uploadPdfToAws } from "./bucket.service";
import { ComprobantePagoModel } from "../entities/implements/ComprobantePagoSchema";
import mongoose from "mongoose";
import { PaymentProofService } from "./paymentProof.service";
import { SimplePackageService } from "./simplePackage.service";

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
  qr: "QR"
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
  const filteredSales = sales.filter(
    (sale) => {
      const status = String(sale?.id_pedido?.estado_pedido || "").trim().toLowerCase();
      const pedidoId = String(sale?.id_pedido?._id || sale?.id_pedido || "").trim();
      return (
        !sale.deposito_realizado &&
        (status === "entregado" || status === "interno") &&
        sale?.id_pedido?.simple_package_order !== true &&
        !simplePackagePedidoIds.has(pedidoId)
      );
    }
  );
  const simplePackageSales = simplePackageRows.map((row: any) => ({
    nombre_variante: row.descripcion_paquete || "Paquete simple",
    precio_unitario: Number(row.saldo_por_paquete ?? 0),
    cantidad: 1,
    utilidad: 0,
    id_sucursal:
      (row?.origen_sucursal as any)?._id || row?.origen_sucursal || row?.sucursal,
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
  const pedidos = Array.from(
    new Set(allSales.map((sale) => sale.id_pedido))
  );

  const doc = new jsPDF();

  // Título del PDF centrado
  const pageWidth = doc.internal.pageSize.width;
  const title = "COMPROBANTE DE PAGO";
  const titleWidth = doc.getTextWidth(title);
  const titleX = (pageWidth - titleWidth) / 2;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, titleX, 10);

  // Tabla de ventas
  const salesTableData = allSales.map((sale: any) => {
    const foundSucursal = sucursales.find(
      (sucursal) => sale.id_sucursal.toString() === sucursal._id.toString()
    );

    return [
      new Date(sale.fecha_pedido).toLocaleDateString("es-BO"),
      sale.nombre_variante,
      foundSucursal?.nombre || "Sucursal desconocida",
      sale.precio_unitario,
      sale.cantidad,
      !sale.id_pedido.pagado_al_vendedor
        ? `Bs. ${sale.cantidad * sale.precio_unitario}`
        : "Bs. 0",
      !sale.id_pedido.pagado_al_vendedor
        ? `Bs. ${(sale.cantidad * sale.precio_unitario - sale.utilidad).toFixed(
            2
          )}`
        : `Bs. -${sale.utilidad.toFixed(2)}`,
    ];
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

  salesTableData.push([
    "TOTAL VENTAS",
    "",
    "",
    "",
    "",
    `Bs. ${totalVentas.toFixed(2)}`,
    `Bs. ${totalVentasComision.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 20,
    head: [
      [
        "FECHA",
        "PRODUCTO",
        "SUCURSAL",
        "PRECIO",
        "CANTIDAD",
        "SUBTOTAL",
        "SUBTOTAL - COMISIÓN",
      ],
    ],
    body: salesTableData,
    styles: { fontSize: 10 },
  });

  // Tabla de adelantos
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    "ADELANTOS PAGADOS AL VENDEDOR",
    10,
    (doc as any).lastAutoTable.finalY + 10
  );

  const adelantosTableData = pedidos
    .filter((pedido) => pedido.adelanto_cliente > 0)
    .map((pedido) => [
      new Date(pedido.fecha_pedido).toLocaleDateString("es-BO"),
      pedido.adelanto_cliente.toFixed(2),
    ]);

  const totalAdelantos = pedidos.reduce(
    (acc, pedido) => acc + pedido.adelanto_cliente,
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

  // Tabla de deliverys
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    "DELIVERYS PAGADOS POR EL VENDEDOR",
    10,
    (doc as any).lastAutoTable.finalY + 10
  );

  const deliverysTableData = pedidos
    .filter((pedido) => pedido.cargo_delivery > 0)
    .map((pedido) => [
      new Date(pedido.fecha_pedido).toLocaleDateString("es-BO"),
      pedido.cargo_delivery.toFixed(2),
    ]);

  const totalDeliverys = pedidos.reduce(
    (acc, pedido) => acc + pedido.cargo_delivery,
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

  // Tabla de deudas
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    "DEUDAS DESCONTADAS",
    10,
    (doc as any).lastAutoTable.finalY + 10
  );

  const mensualidadesTableData = filteredDeudas.map((deuda: any) => [
    new Date(deuda.fecha).toLocaleDateString("es-BO"),
    deuda.clase_cobro === "RECUPERACION" ? "Recuperacion" : "Servicio",
    deuda.concepto,
    deuda.monto.toFixed(2),
  ]);

  const totalMensualidades = filteredDeudas.reduce(
    (acc, deuda) => acc + deuda.monto,
    0
  );

  mensualidadesTableData.push([
    "TOTAL DEUDAS",
    "",
    "",
    totalMensualidades > 0
      ? `Bs. -${totalMensualidades}`
      : `Bs. ${totalMensualidades}`,
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["FECHA", "TIPO", "CONCEPTO", "MONTO"]],
    body: mensualidadesTableData,
    styles: { fontSize: 10 },
  });

  const montoPagado =
    totalVentasComision - totalAdelantos - totalDeliverys - totalMensualidades;

  const amountY = (doc as any).lastAutoTable.finalY + 20;
  doc.text(
    `MONTO PAGADO: Bs. ${montoPagado}`,
    10,
    amountY
  );
  doc.text(
    `METODO DE PAGO AL VENDEDOR: ${paymentMethodLabelMap[paymentMethod]}`,
    10,
    amountY + 8
  );

  await appendSellerQrToPdf(doc, seller, amountY + 23);

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  const filename = `comprobante_pago_${seller?.nombre}_${
    seller?.apellido
  }_${new Date().toISOString()}.pdf`;
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
