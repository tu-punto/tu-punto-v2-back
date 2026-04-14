import { SellerRepository } from "../repositories/seller.repository";
import { ProductRepository } from "../repositories/product.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import {
  calcPagoMensual,
  calcSellerDebt,
  canAccessSellerProductInfoByCommission,
  hasConfiguredCommissionService,
  hasConfiguredSimplePackageService,
  hasCommissionServiceEnabled,
  hasSimplePackageServiceEnabled,
} from "../utils";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { Types } from "mongoose";
import { SellerPdfService } from "../services/sellerPdf.service"; // Importar el servicio de generación de PDF
import dayjs from "dayjs";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { SaleService } from "./sale.service";
import { calcPagoPendiente } from "../utils/seller.utils";
import { IVendedorDocument } from "../entities/documents/IVendedorDocument";
import { FinanceFluxService } from "./financeFlux.service";
import { IFinanceFlux } from "../entities/IFinanceFlux";
import { PaymentProofService } from "./paymentProof.service";
import { getSellerLifecycleStatus } from "../helpers/sellerAccess";
import { SimplePackageService } from "./simplePackage.service";
const saveFlux = async (flux: IFlujoFinanciero) =>
  await FinanceFluxRepository.registerFinanceFlux(flux);

type SellerListFilters = {
  sellerId?: string;
  q?: string;
  status?: "activo" | "debe_renovar" | "ya_no_es_cliente";
  pendingPayment?: "con_deuda" | "sin_deuda";
};

const matchesSellerFullName = (sellerData: any, q?: string) => {
  const normalizedQuery = String(q || "").trim().toLowerCase();
  if (!normalizedQuery) return true;

  const fullName = `${sellerData?.nombre || ""} ${sellerData?.apellido || ""}`.trim().toLowerCase();
  return fullName.includes(normalizedQuery);
};

const getAllSellers = async (params?: SellerListFilters) => {
  const sellersWithData = await SellerRepository.findWithDebtsAndSales({
    sellerId: params?.sellerId,
    q: params?.q,
    status: params?.status,
  });

  const processedSellers = sellersWithData.map((sellerData: any) => {
    const metrics = calcPagoPendiente(
      sellerData.sales,
      sellerData.debts as IFinanceFlux[]
    );
    const pagoMensual = calcPagoMensual(sellerData);

    return {
      ...sellerData,
      ...metrics,
      pago_mensual: pagoMensual,
    };
  });

  return processedSellers.filter((sellerData: any) => {
    if (!matchesSellerFullName(sellerData, params?.q)) {
      return false;
    }

    if (params?.status) {
      const lifecycleStatus = getSellerLifecycleStatus(sellerData?.fecha_vigencia);
      if (lifecycleStatus !== params.status) {
        return false;
      }
    }

    if (params?.pendingPayment === "con_deuda") {
      return Number(sellerData?.pago_pendiente ?? 0) !== 0;
    }

    if (params?.pendingPayment === "sin_deuda") {
      return Number(sellerData?.pago_pendiente ?? 0) === 0;
    }

    return true;
  });
};

const getAllSellersBasic = async (params?: {
  sucursalId?: string;
  sellerId?: string;
  onlyProductInfoAccess?: boolean;
  onlySimplePackageAccess?: boolean;
  includeProductInfoStatus?: boolean;
  onlyActiveOrRenewal?: boolean;
}) => {
  const sellers = await SellerRepository.findAllBasic(params);
  const sellersWithProductInfoAccess = !params?.onlyProductInfoAccess
    ? sellers
    : sellers.filter((seller: any) =>
        canAccessSellerProductInfoByCommission({
          comision_porcentual: Number(seller?.comision_porcentual ?? 0),
          comision_fija: Number(seller?.comision_fija ?? 0),
          fecha_vigencia: seller?.fecha_vigencia,
        })
      );

  const sellersWithSimplePackageAccess = !params?.onlySimplePackageAccess
    ? sellersWithProductInfoAccess
    : sellersWithProductInfoAccess.filter((seller: any) => {
        const status = getSellerLifecycleStatus(seller?.fecha_vigencia);
        if (status !== "activo" && status !== "debe_renovar") return false;

        const payments = Array.isArray(seller?.pago_sucursales) ? seller.pago_sucursales : [];
        return payments.some((payment: any) => {
          const branchId = String(payment?.id_sucursal?._id || payment?.id_sucursal || "");
          if (payment?.activo === false) return false;
          const hasSimpleService = Number(payment?.entrega_simple ?? 0) > 0;
          if (!hasSimpleService) return false;
          if (!params?.sucursalId) return true;
          return String(branchId) === String(params.sucursalId);
        });
      });

  const filteredSellers = !params?.onlyActiveOrRenewal
    ? sellersWithSimplePackageAccess
    : sellersWithSimplePackageAccess.filter((seller: any) => {
        const status = getSellerLifecycleStatus(seller?.fecha_vigencia);
        return status === "activo" || status === "debe_renovar";
      });

  if (!params?.includeProductInfoStatus) {
    return filteredSellers;
  }

  const sellerIds = filteredSellers.map((seller: any) => String(seller?._id || "")).filter(Boolean);
  const statusRows = await ProductRepository.findSellerProductInfoStatusBySellerIds(sellerIds);
  const statusBySellerId = new Map(
    statusRows.map((row) => [row.sellerId, row])
  );

  return filteredSellers.map((seller: any) => {
    const sellerId = String(seller?._id || "");
    const summary = statusBySellerId.get(sellerId) || {
      sellerId,
      totalVariants: 0,
      emptyCount: 0,
      partialCount: 0,
      completeCount: 0,
      productInfoStatus: "empty" as const,
    };

    return {
      ...seller,
      product_info_status: summary.productInfoStatus,
      product_info_summary: summary,
    };
  });
};

const normalizeSellerServiceValues = (seller: any) => {
  const hasCommissionService = hasConfiguredCommissionService({
    pago_sucursales: Array.isArray(seller?.pago_sucursales) ? seller.pago_sucursales : [],
  });
  const hasSimplePackageService = hasConfiguredSimplePackageService({
    pago_sucursales: Array.isArray(seller?.pago_sucursales) ? seller.pago_sucursales : [],
  });
  const amortizacion = hasSimplePackageService ? Number(seller?.amortizacion ?? 0) : 0;
  const precioPaquete = hasSimplePackageService ? Number(seller?.precio_paquete ?? 0) : 0;

  if (hasSimplePackageService && amortizacion > precioPaquete) {
    throw new Error("La amortizacion no puede ser mayor al precio por paquete");
  }

  return {
    ...seller,
    comision_porcentual: hasCommissionService ? Number(seller?.comision_porcentual ?? 0) : 0,
    comision_fija: hasCommissionService ? Number(seller?.comision_fija ?? 0) : 0,
    amortizacion,
    precio_paquete: precioPaquete,
  };
};

const getSeller = async (sellerId: string) => {
  const seller = await SellerRepository.findById(sellerId);
  if (!seller) {
    console.error(`Seller with id ${sellerId} not found`);
    return null;
  }
  const sales = await SaleService.getRawSalesBySellerId(sellerId);
  const fluxes = await FinanceFluxService.getSellerInfoById(sellerId);
  const debts = fluxes.filter((f) => f.esDeuda);
  const metrics = calcPagoPendiente(sales, debts as IFinanceFlux[]);

  return { ...seller, pago_mensual: calcPagoMensual(seller), ...metrics };
};

const registerSeller = async (seller: any & { esDeuda: boolean }) => {
  const normalizedSeller = normalizeSellerServiceValues(seller);
  const montoTotal = calcSellerDebt(seller);
  const deuda = normalizedSeller.esDeuda ? montoTotal : 0;

  const nuevo = await SellerRepository.registerSeller({ ...normalizedSeller, deuda });

  await saveFlux({
    tipo: "INGRESO",
    categoria: "SERVICIO",
    concepto: `Alta hasta el ${dayjs(new Date(nuevo.fecha_vigencia)).format(
      "DD/MM/YYYY"
    )}`,
    monto: montoTotal,
    fecha: new Date(),
    esDeuda: normalizedSeller.esDeuda,
    id_vendedor: new Types.ObjectId(nuevo._id),
  });

  return nuevo;
};

const updateSeller = async (id: string, data: any) => {
  return await SellerRepository.updateSeller(id, normalizeSellerServiceValues(data.newData));
};
const syncSellerProductBranches = async (
  sellerId: string,
  nuevasSucursales: any[]
) => {
  const productos = await ProductoModel.find({ id_vendedor: sellerId });

  if (!productos.length) return; // No hay productos, no hay que hacer nada

  for (const producto of productos) {
    const sucursalesExistentes = (producto.sucursales || []).map((s) =>
      s.id_sucursal.toString()
    );
    const sucursalReferencia = producto.sucursales?.[0];

    if (!sucursalReferencia) continue; // nada que clonar

    for (const nuevaSucursal of nuevasSucursales) {
      const nuevaId = nuevaSucursal.id_sucursal.toString();

      if (sucursalesExistentes.includes(nuevaId)) continue; // ya existe, skip

      const nuevasCombinaciones = (sucursalReferencia.combinaciones || []).map(
        (c) => ({
          variantes: c.variantes,
          stock: 0,
          precio: c.precio, // podrías poner 0 si querés obligar a definirlo por sucursal
        })
      );

      producto.sucursales.push({
        id_sucursal: nuevaSucursal.id_sucursal,
        combinaciones: nuevasCombinaciones,
      });
    }

    await producto.save(); // guardar cambios en producto
  }
};
const canRemoveSucursalFromSeller = async (
  sellerId: string,
  idSucursal: string
): Promise<boolean> => {
  const productos = await ProductoModel.find({ id_vendedor: sellerId });

  for (const producto of productos) {
    const sucursal = producto.sucursales?.find(
      (s) => s.id_sucursal.toString() === idSucursal
    );
    if (!sucursal) continue;

    const tieneStock = sucursal.combinaciones?.some((c) => c.stock > 0);
    if (tieneStock) return false;
  }

  return true;
};
const handleSucursalRemovals = async (
  sellerId: string,
  anteriores: any[],
  actuales: any[]
) => {
  const eliminadas = anteriores.filter(
    (prev) =>
      !actuales.some(
        (curr: any) =>
          curr.id_sucursal.toString() === prev.id_sucursal.toString()
      )
  );

  const sucursalesConStock: string[] = [];

  for (const sucursal of eliminadas) {
    const idSucursal = sucursal.id_sucursal.toString();
    const puedeEliminar = await canRemoveSucursalFromSeller(
      sellerId,
      idSucursal
    );

    if (!puedeEliminar) {
      sucursalesConStock.push(sucursal.sucursalName || "Sucursal sin nombre");
    }
  }

  if (sucursalesConStock.length > 0) {
    throw {
      status: 400,
      msg: `No se pueden eliminar las siguientes sucursales porque aún tienen productos con stock: ${sucursalesConStock.join(
        ", "
      )}`,
    };
  }

  for (const sucursal of eliminadas) {
    const idSucursal = sucursal.id_sucursal.toString();
    await ProductoModel.updateMany(
      { id_vendedor: sellerId },
      { $pull: { sucursales: { id_sucursal: idSucursal } } }
    );
  }
};

const renewSeller = async (id: string, data: any & { esDeuda?: boolean }) => {
  const vendedor = await SellerRepository.findById(id);
  if (!vendedor) throw new Error(`Seller with id ${id} doesn't exist`);

  let nuevaDeuda = vendedor.deuda ?? 0;
  let montoNuevo = 0;

  if (data.pago_sucursales) {
    montoNuevo = calcSellerDebt(data);
    nuevaDeuda = data.esDeuda ? nuevaDeuda + montoNuevo : nuevaDeuda;
    data.deuda = nuevaDeuda;
  }

  await handleSucursalRemovals(
    id,
    vendedor.pago_sucursales || [],
    data.pago_sucursales || []
  );

  const actualizado = await SellerRepository.updateSeller(id, data);

  if (montoNuevo > 0 && actualizado) {
    await saveFlux({
      tipo: "INGRESO",
      categoria: "SERVICIO",
      concepto: `Renovación hasta el ${dayjs(
        new Date(actualizado.fecha_vigencia)
      ).format("DD/MM/YYYY")}`,
      monto: montoNuevo,
      fecha: new Date(),
      esDeuda: data.esDeuda ?? true,
      id_vendedor: actualizado._id,
    });
  }
  if (data.pago_sucursales?.length) {
    const nuevasSucursales = data.pago_sucursales.filter((s: any) => {
      return !vendedor.pago_sucursales?.some(
        (ps: any) => ps.id_sucursal.toString() === s.id_sucursal.toString()
      );
    });

    if (nuevasSucursales.length > 0) {
      await syncSellerProductBranches(id, nuevasSucursales);
    }
  }

  return actualizado;
};

const paySellerDebt = async (id: string, payAll: boolean) => {
  const seller = await SellerRepository.findById(id);
  if (!seller) return null;

  const update: Partial<typeof seller> = { saldo_pendiente: 0 };
  if (payAll) update.deuda = 0;

  if (payAll) {
    await FinanceFluxRepository.markFinanceFluxAsPaid(id);
  }
  await SellerRepository.markSalesAsDeposited(id);
  await SimplePackageService.markSellerAccountingSimplePackagesDeposited(id);

  const updatedSeller = await SellerRepository.updateSeller(id, update);
  if (!updateSeller) {
    return;
    throw new Error(`Error al actualizar las deudas del vendedor ${id}`);
  }

  console.log(`Deuda pagada para el vendedor ${updatedSeller!.nombre}`);
  return updatedSeller;
};

const getSellerDebts = async (sellerId: string) => {
  const sellerDebts = await SellerRepository.findDebtsBySeller(sellerId);
  return sellerDebts;
};

const updateSellerSaldo = async (sellerId: any, addSaldo: number) => {
  const seller = await SellerRepository.findById(sellerId);
  if (!seller) throw new Error(`Seller with id ${sellerId} not found`);
  const newSaldo = (seller.saldo_pendiente || 0) + addSaldo;
  return await SellerRepository.updateSeller(sellerId, {
    saldo_pendiente: newSaldo,
  });
};

const getServicesSummary = async () => {
  const sellers = await SellerRepository.findAll();

  const resumen: Record<string, Record<string, number>> = {};

  // Comparación por día (evita que un vendedor “caduque” por la hora)
  const today = dayjs().startOf("day");

  for (const seller of sellers) {
    // ✅ NUEVO: validar vigencia del vendedor
    const vigencia = seller.fecha_vigencia ? dayjs(seller.fecha_vigencia).endOf("day") : null;

    // Si no tiene fecha_vigencia o ya venció, no cuenta en el resumen
    if (!vigencia || vigencia.isBefore(today)) continue;

    for (const pago of seller.pago_sucursales || []) {
      const start = pago.fecha_ingreso ? dayjs(pago.fecha_ingreso).startOf("day") : null;
      const end = pago.fecha_salida ? dayjs(pago.fecha_salida).endOf("day") : null;

      const fueraDeRango =
        (start && start.isAfter(today)) ||
        (end && end.isBefore(today));

      if (pago.activo === false || fueraDeRango) continue;

      const sucursal = pago.sucursalName || "Sin sucursal";

      if (!resumen[sucursal]) {
        resumen[sucursal] = {
          Almacenamiento: 0,
          Exhibición: 0,
          "Entregas Simples": 0,
          Delivery: 0,
          TOTAL: 0,
        };
      }

      const montoAlmacenamiento = pago.alquiler || 0;
      const montoExhibicion = pago.exhibicion || 0;
      const montoEntrega = pago.entrega_simple || 0;
      const montoDelivery = pago.delivery || 0;

      resumen[sucursal].Almacenamiento += montoAlmacenamiento;
      resumen[sucursal].Exhibición += montoExhibicion;
      resumen[sucursal]["Entregas Simples"] += montoEntrega;
      resumen[sucursal].Delivery += montoDelivery;

      const totalSucursal =
        montoAlmacenamiento + montoExhibicion + montoEntrega + montoDelivery;

      resumen[sucursal].TOTAL += totalSucursal;

      if (!resumen.TOTAL) {
        resumen.TOTAL = {
          Almacenamiento: 0,
          Exhibición: 0,
          "Entregas Simples": 0,
          Delivery: 0,
          TOTAL: 0,
        };
      }

      resumen.TOTAL.Almacenamiento += montoAlmacenamiento;
      resumen.TOTAL.Exhibición += montoExhibicion;
      resumen.TOTAL["Entregas Simples"] += montoEntrega;
      resumen.TOTAL.Delivery += montoDelivery;
      resumen.TOTAL.TOTAL += totalSucursal;
    }
  }

  return resumen;
};

const getClientsStatusList = async () => {
  const sellers = await SellerRepository.findAllForClientStatus();
  const today = dayjs().startOf("day");

  const rows: any[] = [];

  for (const seller of sellers as any[]) {
    const vigencia = seller.fecha_vigencia
      ? dayjs(seller.fecha_vigencia).endOf("day")
      : null;
    const vendedorActivo = !!vigencia && !vigencia.isBefore(today);

    const pagos = Array.isArray(seller.pago_sucursales) ? seller.pago_sucursales : [];

    for (const pago of pagos) {
      const start = pago?.fecha_ingreso ? dayjs(pago.fecha_ingreso).startOf("day") : null;
      const end = pago?.fecha_salida ? dayjs(pago.fecha_salida).endOf("day") : null;

      const fueraDeRango =
        (start && start.isAfter(today)) ||
        (end && end.isBefore(today));

      const activoSucursal = vendedorActivo && pago?.activo !== false && !fueraDeRango;

      rows.push({
        id_vendedor: String(seller._id || ""),
        vendedor: `${seller.nombre || ""} ${seller.apellido || ""}`.trim(),
        mail: seller.mail || "",
        telefono: seller.telefono || "",
        fecha_vigencia: seller.fecha_vigencia || null,
        id_sucursal: pago?.id_sucursal ? String(pago.id_sucursal) : "",
        sucursal: pago?.sucursalName || "",
        fecha_ingreso: pago?.fecha_ingreso || null,
        fecha_salida: pago?.fecha_salida || null,
        activo: !!activoSucursal,
      });
    }
  }

  return rows;
};


const getSellerPaymentProofs = async (sellerId: string) => {
  try {
    const comprobantes =
      PaymentProofService.getComprobantesByVendedor(sellerId);

    return comprobantes;
  } catch (error) {
    console.error("Error en getSellerPaymentProofs:", error);
    throw error;
  }
};

export const SellerService = {
  getAllSellers,
  getAllSellersBasic,
  getSeller,
  registerSeller,
  updateSeller,
  renewSeller,
  paySellerDebt,
  getSellerDebts,
  updateSellerSaldo,
  getServicesSummary,
  getClientsStatusList,
  getSellerPaymentProofs,
};
