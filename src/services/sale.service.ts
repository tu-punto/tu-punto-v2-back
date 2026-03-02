import { format } from "date-fns";
import { Types } from "mongoose";

import { SaleRepository } from "../repositories/sale.repository";
import { SellerService } from "./seller.service";
import { ProductService } from "./product.service";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";
import { variantFingerprint, variantLabel } from "../utils/variantKey";

type VariantRecord = Record<string, string>;

const getAllSales = async () => {
  return await SaleRepository.findAll();
};

const normalizeText = (value: unknown): string => String(value ?? "").trim();

const normalizeLabel = (value: string): string =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toVariantRecord = (variantes: unknown): VariantRecord | null => {
  if (!variantes) return null;

  const entries =
    variantes instanceof Map
      ? Array.from(variantes.entries())
      : Object.entries(variantes as Record<string, unknown>);

  const normalized = entries
    .map(([key, value]) => [normalizeText(key), normalizeText(value)] as [string, string])
    .filter(([key, value]) => key.length > 0 && value.length > 0);

  if (!normalized.length) return null;
  return Object.fromEntries(normalized);
};

const getSaleProductId = (sale: any): string => {
  const raw = sale?.id_producto ?? sale?.producto?._id ?? sale?.producto;
  if (!raw) throw new Error("No se pudo resolver id de producto para ajustar stock.");
  return String(raw);
};

const getSaleSucursalId = (sale: any): string => {
  const raw = sale?.sucursal ?? sale?.id_sucursal;
  if (!raw) throw new Error("No se pudo resolver sucursal para ajustar stock.");
  return String(raw);
};

const getSaleQuantity = (sale: any): number => {
  const qty = Number(sale?.cantidad ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Cantidad invalida para la venta.");
  }
  return qty;
};

const buildVariantLabelCandidates = (
  nombreVariante: string | undefined,
  nombreProducto: string
): string[] => {
  const saleLabel = normalizeLabel(nombreVariante || "");
  if (!saleLabel) return [];

  const productLabel = normalizeLabel(nombreProducto || "");
  const candidates = new Set<string>();

  candidates.add(saleLabel);
  if (productLabel && saleLabel.startsWith(productLabel)) {
    const stripped = saleLabel.slice(productLabel.length).replace(/^[-:/\s]+/, "").trim();
    if (stripped) candidates.add(stripped);
  }

  return Array.from(candidates);
};

const findVariantIndexForSale = (product: any, sale: any): number => {
  const sucursalId = getSaleSucursalId(sale);
  const sucursal = product.sucursales.find((s: any) => s.id_sucursal?.toString() === sucursalId);
  if (!sucursal) {
    throw new Error(
      `Sucursal ${sucursalId} no encontrada en producto ${product.nombre_producto}`
    );
  }

  const variantKey = normalizeText(sale?.variantKey);
  if (variantKey) {
    const indexByKey = sucursal.combinaciones.findIndex(
      (c: any) => normalizeText(c.variantKey) === variantKey
    );
    if (indexByKey >= 0) return indexByKey;
  }

  const variantes = toVariantRecord(sale?.variantes);
  if (variantes) {
    const fingerprint = variantFingerprint(variantes);
    const indexByVariants = sucursal.combinaciones.findIndex(
      (c: any) => variantFingerprint(c.variantes as Record<string, string>) === fingerprint
    );
    if (indexByVariants >= 0) return indexByVariants;
  }

  const labelCandidates = buildVariantLabelCandidates(sale?.nombre_variante, product.nombre_producto);
  if (labelCandidates.length) {
    const indexByLabel = sucursal.combinaciones.findIndex((c: any) => {
      const comboLabel = variantLabel(c.variantes as Record<string, string>);
      const fullLabel = `${product.nombre_producto} - ${comboLabel}`;
      const normalizedCombo = normalizeLabel(comboLabel);
      const normalizedFull = normalizeLabel(fullLabel);

      return labelCandidates.some(
        (candidate) => candidate === normalizedCombo || candidate === normalizedFull
      );
    });
    if (indexByLabel >= 0) return indexByLabel;
  }

  const salePrice = Number(sale?.precio_unitario);
  if (Number.isFinite(salePrice)) {
    const indexesByPrice = sucursal.combinaciones
      .map((c: any, idx: number) => ({ idx, precio: Number(c.precio) }))
      .filter((item: any) => item.precio === salePrice);
    if (indexesByPrice.length === 1) return indexesByPrice[0].idx;
  }

  if (sucursal.combinaciones.length === 1) return 0;
  return -1;
};

const adjustStockForSale = async (sale: any, delta: number) => {
  if (!delta) return;

  const productId = getSaleProductId(sale);
  if (!Types.ObjectId.isValid(productId)) return;

  const product = await ProductService.getProductById(productId);
  if (product.esTemporal) return;

  const sucursalId = getSaleSucursalId(sale);
  const sucursal = product.sucursales.find((s: any) => s.id_sucursal?.toString() === sucursalId);
  if (!sucursal) {
    throw new Error(
      `Sucursal ${sucursalId} no encontrada en producto ${product.nombre_producto}`
    );
  }

  const index = findVariantIndexForSale(product, sale);
  if (index < 0) {
    throw new Error(
      `No se encontro combinacion de variante para ${product.nombre_producto}`
    );
  }

  const currentStock = Number(sucursal.combinaciones[index].stock || 0);
  const nextStock = currentStock + delta;

  if (nextStock < 0) {
    throw new Error("No hay stock suficiente para completar la operacion.");
  }

  sucursal.combinaciones[index].stock = nextStock;
  await (product as any).save();
};

const registerSale = async (sale: any) => {
  const salesArray = Array.isArray(sale) ? sale : [sale];
  const savedSales = [];

  for (const rawSale of salesArray) {
    const cantidad = getSaleQuantity(rawSale);
    const idProducto = getSaleProductId(rawSale);
    const idPedido = rawSale?.id_pedido ?? rawSale?.pedido;
    const idVendedor = rawSale?.id_vendedor ?? rawSale?.vendedor;
    const idSucursal = rawSale?.sucursal ?? rawSale?.id_sucursal;

    if (!idPedido || !idVendedor || !idSucursal) {
      throw new Error("Faltan campos requeridos para registrar la venta.");
    }

    const variantes = toVariantRecord(rawSale?.variantes);

    const saleData: any = {
      ...rawSale,
      cantidad,
      producto: new Types.ObjectId(String(idProducto)),
      pedido: new Types.ObjectId(String(idPedido)),
      vendedor: new Types.ObjectId(String(idVendedor)),
      sucursal: new Types.ObjectId(String(idSucursal)),
      quien_paga_delivery: rawSale.quien_paga_delivery || "comprador",
      nombre_variante: rawSale.nombre_variante || "",
      ...(variantes ? { variantes } : {}),
      ...(rawSale.variantKey ? { variantKey: String(rawSale.variantKey) } : {}),
    };

    await adjustStockForSale(saleData, -cantidad);

    try {
      const saved = await SaleRepository.registerSale(saleData);
      savedSales.push(saved);

      await PedidoModel.findByIdAndUpdate(saleData.pedido, {
        $addToSet: { venta: saved._id },
      });
      await VendedorModel.findByIdAndUpdate(saleData.vendedor, {
        $addToSet: { venta: saved._id },
      });
    } catch (error) {
      await adjustStockForSale(saleData, cantidad);
      throw error;
    }
  }

  return savedSales;
};

const registerMultipleSales = async (sales: any[]) => {
  const savedSales = [];
  for (const sale of sales) {
    const savedList = await SaleService.registerSale(sale);
    for (const saved of savedList) {
      savedSales.push(saved);
    }
  }
  return savedSales;
};

const getSalesByShippingId = async (pedidoId: string) => {
  const sales = await SaleRepository.findByPedidoId(pedidoId);
  const pedido = await PedidoModel.findById(pedidoId);

  if (!pedido) throw new Error("No existe el pedido");

  const ventas = sales.map((sale) => ({
    key: sale.producto._id,
    producto: sale.producto.nombre_producto,
    nombre_variante: sale.nombre_variante,
    precio_unitario: sale.precio_unitario,
    cantidad: sale.cantidad,
    utilidad: sale.utilidad,
    id_venta: sale._id,
    id_vendedor: sale.producto.id_vendedor,
    id_pedido: pedidoId,
    id_producto: sale.producto._id,
    id_sucursal: sale.sucursal,
  }));

  const temporales = (pedido.productos_temporales || []).map((prod, i) => ({
    key: `temp-${i}`,
    producto: prod.producto,
    cantidad: prod.cantidad,
    precio_unitario: prod.precio_unitario,
    utilidad: prod.utilidad,
    id_vendedor: prod.id_vendedor,
    esTemporal: true,
  }));

  return [...ventas, ...temporales];
};

const getProductDetailsByProductId = async (productId: number) => {
  const sales = await SaleRepository.findByProductId(productId);

  if (sales.length === 0) throw new Error("No existen ventas con ese ID de producto");

  const products = sales.map((sale) => {
    const formattedDate = format(new Date(sale.pedido.fecha_pedido), "dd/MM/yyyy:HH:mm:ss");

    return {
      key: `${sale.producto._id}-${formattedDate}`,
      producto: sale.producto.nombre_producto,
      precio_unitario: sale.precio_unitario,
      cantidad: sale.cantidad,
      utilidad: sale.utilidad,
      id_venta: sale._id,
      id_vendedor: sale.producto.id_vendedor,
      id_pedido: sale.id_pedido,
      id_producto: sale.producto._id,
      id_sucursal: sale.sucursal,
      deposito_realizado: sale.deposito_realizado,
      cliente: sale.pedido.cliente,
      fecha_pedido: sale.pedido.fecha_pedido,
      nombre_vendedor: `${sale.vendedor.nombre} ${sale.vendedor.apellido} - ${sale.vendedor.marca}`,
    };
  });

  return products;
};

const getProductsBySellerId = async (sellerId: string) => {
  const sales = await SaleRepository.findBySellerId(sellerId);
  if (!sales || sales.length === 0) {
    return [];
  }

  const products = sales.map((sale) => {
    let product;
    if (sale.producto) {
      product = {
        key: sale.producto._id,
        producto: sale.producto.nombre_producto,
        id_producto: sale.producto._id,
      };
    }

    const base = {
      nombre_variante: sale.nombre_variante,
      precio_unitario: sale.precio_unitario,
      cantidad: sale.cantidad,
      utilidad: sale.utilidad,
      id_venta: sale._id,
      id_vendedor: sellerId,
      id_pedido: sale.pedido,
      id_sucursal: sale.sucursal,
      deposito_realizado: sale.deposito_realizado,
      cliente: sale.pedido?.cliente ?? null,
      fecha_pedido: sale.pedido?.fecha_pedido ?? null,
    };

    if (product) {
      return { ...product, ...base };
    }

    return {
      product: "No encontrado",
      ...base,
    };
  });

  return products;
};

const updateProducts = async (shippingId: any, prods: any[]) => {
  const sales = await SaleRepository.findByPedidoId(shippingId);
  if (!sales || sales.length === 0) {
    throw new Error(`Shipping with id ${shippingId} doesn't exist`);
  }

  const updated: any[] = [];

  for (const prod of prods) {
    const saleId = String(prod?._id || prod?.id_venta || "");
    if (!saleId) continue;

    const fieldsToUpdate: any = {};
    if ("cantidad" in prod) fieldsToUpdate.cantidad = Number(prod.cantidad);
    if ("precio_unitario" in prod) fieldsToUpdate.precio_unitario = Number(prod.precio_unitario);
    if ("utilidad" in prod) fieldsToUpdate.utilidad = Number(prod.utilidad);
    if ("deposito_realizado" in prod) {
      fieldsToUpdate.deposito_realizado = prod.deposito_realizado;
    }
    if ("quien_paga_delivery" in prod) {
      fieldsToUpdate.quien_paga_delivery = prod.quien_paga_delivery;
    }
    if ("id_producto" in prod) fieldsToUpdate.id_producto = prod.id_producto;

    const updatedSale = await updateSaleById(saleId, fieldsToUpdate);
    if (updatedSale) updated.push(updatedSale);
  }

  return updated;
};

const updateSales = async (sales: any[]) => {
  const updatedSales = [];
  for (const sale of sales) {
    const isSale = await SaleRepository.findById(sale.id_venta);
    if (isSale) {
      const saleUpdate = {
        id_venta: sale.id_venta,
        cantidad: sale.cantidad,
        precio_unitario: sale.precio_unitario,
        utilidad: sale.utilidad,
        deposito_realizado: sale.deposito_realizado,
        ...(sale.id_producto && { id_producto: sale.id_producto }),
      };
      const updatedSale = await SaleRepository.updateSale(saleUpdate as any);
      updatedSales.push(updatedSale);
    } else {
      throw new Error(`No sale found with that saleId ${sale.id_venta}`);
    }
  }
  return updatedSales;
};

const updateSalesOfProducts = async (stockData: any[]) => {
  return await SaleRepository.updateSalesOfProducts(stockData);
};

const deleteProducts = async (shippingId: any, prods: any[]) => {
  const sale = await SaleRepository.findByPedidoId(shippingId);
  if (sale.length === 0) throw new Error(`No sales found for shippingId ${shippingId}`);
  return await SaleRepository.deleteProducts(sale, prods);
};

const deleteSalesByIdsAndPullFromPedido = async (pedidoId: string, ventaIds: string[]) => {
  for (const ventaId of ventaIds) {
    await deleteSaleById(String(ventaId));
  }

  await PedidoModel.findByIdAndUpdate(pedidoId, {
    $pull: { venta: { $in: ventaIds.map((id) => new Types.ObjectId(id)) } },
  });

  return ventaIds;
};

const deleteSalesByIds = async (saleIds: string[]): Promise<any> => {
  for (const saleId of saleIds) {
    await deleteSaleById(String(saleId));
  }
};

const deleteSalesOfProducts = async (stockData: any[]) => {
  const ids = stockData
    .map((item) => String(item?._id || item?.id_venta || ""))
    .filter((id: string) => id.length > 0);

  for (const id of ids) {
    await deleteSaleById(id);
  }

  return ids;
};

const getDataPaymentProof = async (sellerId: number) => {
  const data = await SaleRepository.getDataPaymentProof(sellerId);

  const products = data.map((venta) => ({
    producto: venta.producto.nombre_producto,
    unitario: venta.precio_unitario,
    cantidad: venta.cantidad,
    total: venta.precio_unitario * venta.cantidad,
  }));

  const payments = data
    .filter((venta) => venta.pedido.adelanto_cliente !== 0)
    .map((venta) => ({
      date: venta.pedido.fecha_pedido.toLocaleDateString(),
      client: venta.pedido.adelanto_cliente,
    }));

  return { products, payments };
};

const updateSaleById = async (id: string, fields: any) => {
  const venta = await SaleRepository.findById(id);
  if (!venta) {
    return null;
  }

  const { id_sucursal, cantidad, precio_unitario, utilidad, ...others } = fields;

  const nextCantidad = cantidad !== undefined ? Number(cantidad) : Number(venta.cantidad);
  const nextPrecioUnitario =
    precio_unitario !== undefined ? Number(precio_unitario) : Number(venta.precio_unitario);
  const nextUtilidad = utilidad !== undefined ? Number(utilidad) : Number(venta.utilidad);

  if (!Number.isFinite(nextCantidad) || nextCantidad <= 0) {
    throw new Error("Cantidad invalida para actualizar la venta.");
  }

  const stockAdjustment = Number(venta.cantidad) - nextCantidad;
  await adjustStockForSale(venta, stockAdjustment);

  const oldSubtotal = Number(venta.cantidad) * Number(venta.precio_unitario);
  const newSubtotal = nextCantidad * nextPrecioUnitario;

  let addPendingSaldo = 0;
  if (venta.pedido.pagado_al_vendedor) {
    addPendingSaldo = Number(venta.utilidad) - nextUtilidad;
  } else {
    addPendingSaldo =
      -(oldSubtotal - Number(venta.utilidad)) + (newSubtotal - nextUtilidad);
  }

  const updatedSale = await SaleRepository.updateSale({
    _id: id as any,
    cantidad: nextCantidad,
    precio_unitario: nextPrecioUnitario,
    utilidad: nextUtilidad,
    ...others,
  } as any);

  await SellerService.updateSellerSaldo(venta.vendedor, addPendingSaldo);
  return updatedSale;
};

const deleteSaleById = async (id: string, id_sucursal?: string) => {
  const venta = await SaleRepository.findById(id);
  if (!venta) return null;

  await adjustStockForSale(venta, Number(venta.cantidad));

  const subtotal = Number(venta.cantidad) * Number(venta.precio_unitario);
  const addPendingSaldo = venta.pedido.pagado_al_vendedor
    ? -Number(venta.utilidad)
    : subtotal - Number(venta.utilidad);

  const resSaldo = await SellerService.updateSellerSaldo(venta.vendedor, -addPendingSaldo);
  if (!resSaldo) {
    return null;
  }

  await PedidoModel.findByIdAndUpdate(venta.pedido, {
    $pull: { venta: venta._id },
  });
  await VendedorModel.findByIdAndUpdate(venta.vendedor, {
    $pull: { venta: venta._id },
  });

  const deleted = await SaleRepository.deleteSaleById(id);
  return deleted;
};

const getRawSalesBySellerId = async (sellerId: string) => {
  const sales = await SaleRepository.findBySellerId(sellerId);
  if (!sales || sales.length === 0) {
    return [];
  }
  return sales;
};

export const SaleService = {
  getAllSales,
  registerSale,
  registerMultipleSales,
  getSalesByShippingId,
  getProductDetailsByProductId,
  updateProducts,
  deleteProducts,
  getProductsBySellerId,
  updateSales,
  deleteSalesByIds,
  getDataPaymentProof,
  updateSalesOfProducts,
  deleteSalesOfProducts,
  updateSaleById,
  deleteSaleById,
  deleteSalesByIdsAndPullFromPedido,
  getRawSalesBySellerId,
};
