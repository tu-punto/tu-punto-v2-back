import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SaleService } from "./sale.service";
import { SellerService } from "./seller.service";
import { FinanceFluxService } from "./financeFlux.service";
import { SucursalsService } from "./sucursals.service";

const generateSellerPdfBuffer = async (sellerId: any): Promise<Buffer> => {
  const sucursales = await SucursalsService.getAllSucursals();
  const deudas = await FinanceFluxService.getSellerInfoById(sellerId);
  const filteredDeudas = deudas.filter((deuda) => deuda.esDeuda);
  const sales = await SaleService.getProductsBySellerId(sellerId);
  const filteredSales = sales.filter((sale) => !sale.deposito_realizado);
  const pedidos = Array.from(
    new Set(filteredSales.map((sale) => sale.id_pedido))
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
  const salesTableData = filteredSales.map((sale: any) => {
    const foundSucursal = sucursales.find(
      (sucursal) => sale.id_sucursal.toString() === sucursal._id.toString()
    );

    return [
      new Date(sale.fecha_pedido).toLocaleDateString("es-BO"),
      sale.nombre_variante,
      foundSucursal?.nombre || "Sucursal desconocida",
      sale.precio_unitario,
      sale.cantidad,
      `Bs. ${sale.cantidad * sale.precio_unitario}`,
      `Bs. ${(sale.cantidad * sale.precio_unitario - sale.utilidad).toFixed(
        2
      )}`,
    ];
  });

  const totalVentas = filteredSales.reduce(
    (acc: number, sale: any) => acc + sale.cantidad * sale.precio_unitario,
    0
  );

  const totalVentasComision = filteredSales.reduce(
    (acc: number, sale: any) =>
      acc + sale.cantidad * sale.precio_unitario - sale.utilidad,
    0
  );

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
      pedido.adelanto_cliente,
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
      pedido.cargo_delivery,
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

  // Tabla de mensualidades
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    "MENSUALIDADES DESCONTADAS",
    10,
    (doc as any).lastAutoTable.finalY + 10
  );

  const mensualidadesTableData = filteredDeudas.map((deuda) => [
    new Date(deuda.fecha).toLocaleDateString("es-BO"),
    deuda.concepto,
    deuda.monto.toFixed(2),
  ]);

  const totalMensualidades = filteredDeudas.reduce(
    (acc, deuda) => acc + deuda.monto,
    0
  );

  mensualidadesTableData.push([
    "TOTAL MENSUALIDADES",
    "",
    totalMensualidades > 0
      ? `Bs. -${totalMensualidades}`
      : `Bs. ${totalMensualidades}`,
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["FECHA", "CONCEPTO", "MONTO"]],
    body: mensualidadesTableData,
    styles: { fontSize: 10 },
  });

  const montoPagado =
    totalVentasComision - totalAdelantos - totalDeliverys - totalMensualidades;

  doc.text(
    `MONTO PAGADO: Bs. ${montoPagado}`,
    10,
    (doc as any).lastAutoTable.finalY + 20
  );

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return pdfBuffer;
};

export const SellerPdfService = {
  generateSellerPdfBuffer,
};
