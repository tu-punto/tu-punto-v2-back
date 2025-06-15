import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SaleService } from "./sale.service";
import { SellerService } from "./seller.service";

const generateSellerPdfBuffer = async (sellerId: any): Promise<Buffer> => {
  const seller = await SellerService.getSeller(sellerId);
  const sales = await SaleService.getProductsBySellerId(sellerId);
  const filteredSales = sales.filter((sale) => !sale.deposito_realizado);
  const doc = new jsPDF();

  // Título del PDF
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Recibo de Pago", 10, 10);

  // Información del vendedor
  doc.setFontSize(12);
  doc.setFont("Helvetica", "normal");
  doc.text(`Nombre: ${seller.nombre}`, 10, 20);
  doc.text(`Teléfono: ${seller.telefono}`, 10, 30);
  doc.text(`Deuda Pagada: Bs. ${seller.deuda}`, 10, 40);
  doc.text(`Saldo Pendiente: Bs. ${seller.saldo_pendiente}`, 10, 50);

  // Informacion de ventas
  const tableData = filteredSales.map((sale: any) => [
    new Date(sale.fecha_pedido).toLocaleDateString("es-BO"),
    sale.nombre_variante,
    sale.cantidad,
    sale.precio_unitario,
    `Bs. ${sale.cantidad * sale.precio_unitario}`,
  ]);

  autoTable(doc, {
    startY: 60,
    head: [["Fecha", "Producto", "Cantidad", "Precio Unitario", "Total"]],
    body: tableData,
    styles: { fontSize: 10 },
  });

  // Generar el PDF como buffer
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return pdfBuffer;
};

export const SellerPdfService = {
  generateSellerPdfBuffer,
};
