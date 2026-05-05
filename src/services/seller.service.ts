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
import moment from "moment-timezone";
import { ProductoModel } from "../entities/implements/ProductoSchema";
import { UserModel } from "../entities/implements/UserSchema";
import { SaleService } from "./sale.service";
import { calcPagoPendiente } from "../utils/seller.utils";
import { IVendedorDocument } from "../entities/documents/IVendedorDocument";
import { FinanceFluxService } from "./financeFlux.service";
import { IFinanceFlux } from "../entities/IFinanceFlux";
import { PaymentProofService } from "./paymentProof.service";
import { getSellerLifecycleStatus } from "../helpers/sellerAccess";
import { SimplePackageService } from "./simplePackage.service";
import { uploadFileToAws } from "./bucket.service";
import { hashPassword } from "../helpers/auth";
const saveFlux = async (flux: IFlujoFinanciero) =>
  await FinanceFluxRepository.registerFinanceFlux(flux);

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDiscountPercent = (value: unknown) =>
  Math.min(100, Math.max(0, toNumber(value)));

const applyDiscount = (amount: number, discountPercent: number) =>
  Number((amount * (1 - discountPercent / 100)).toFixed(2));

const getRawId = (value: any) => String(value?._id || value || "").trim();

const buildServiceIncomeDetail = (pagoSucursales: any[] = [], discountPercent = 0) =>
  pagoSucursales
    .filter((pago) => pago?.activo !== false)
    .map((pago) => {
      const sucursalId = getRawId(pago?.id_sucursal);
      const alquiler = applyDiscount(toNumber(pago?.alquiler), discountPercent);
      const exhibicion = applyDiscount(toNumber(pago?.exhibicion), discountPercent);
      const entregaSimple = applyDiscount(toNumber(pago?.entrega_simple), discountPercent);
      const delivery = applyDiscount(toNumber(pago?.delivery), discountPercent);
      const total = alquiler + exhibicion + entregaSimple + delivery;

      return {
        id_sucursal: Types.ObjectId.isValid(sucursalId)
          ? new Types.ObjectId(sucursalId)
          : undefined,
        sucursalName: String(pago?.sucursalName || ""),
        alquiler,
        exhibicion,
        entrega_simple: entregaSimple,
        delivery,
        total,
      };
    })
    .filter((detail) => detail.total > 0);

const buildServiceIncomeFlux = ({
  pagoSucursales,
  baseAmount,
  discountPercent,
  concept,
  date,
  esDeuda,
  sellerId,
}: {
  pagoSucursales: any[];
  baseAmount: number;
  discountPercent: number;
  concept: string;
  date: Date;
  esDeuda: boolean;
  sellerId: any;
}): IFlujoFinanciero => {
  const detail = buildServiceIncomeDetail(pagoSucursales, discountPercent);

  return {
    tipo: "INGRESO",
    categoria: "SERVICIO",
    concepto: concept,
    monto: Number(detail.reduce((sum, item) => sum + item.total, 0).toFixed(2)),
    fecha: date,
    esDeuda,
    id_vendedor: new Types.ObjectId(String(sellerId)),
    detalle_servicios: detail,
    descuento_porcentaje: discountPercent,
    monto_sin_descuento: baseAmount,
  };
};

type SellerListFilters = {
  sellerId?: string;
  q?: string;
  status?: "activo" | "debe_renovar" | "ya_no_es_cliente" | "declinando_servicio";
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
      const lifecycleStatus = getSellerLifecycleStatus(
        sellerData?.fecha_vigencia,
        sellerData?.declinacion_servicio_fecha
      );
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

const PAYMENT_TZ = "America/La_Paz";

const getAssignedPaymentDate = (date = new Date()) => {
  const base = moment.tz(date, PAYMENT_TZ).startOf("day");
  const day = base.date();
  const assignAtLocalNoon = (paymentDay: number) =>
    base.clone().date(paymentDay).hour(12).minute(0).second(0).millisecond(0).toDate();

  if (day <= 7) return assignAtLocalNoon(8);
  if (day <= 17) return assignAtLocalNoon(18);
  if (day <= 27) return assignAtLocalNoon(28);
  return base.clone().add(1, "month").date(8).hour(12).minute(0).second(0).millisecond(0).toDate();
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

const buildInitialSellerPassword = (seller: any) => {
  const carnet = String(seller?.carnet || "").trim();
  if (carnet.length >= 6) return carnet;

  const telefono = String(seller?.telefono || "").trim();
  if (telefono.length >= 6) return telefono;

  return "123456";
};

const createOrLinkSellerUser = async (seller: any) => {
  const email = String(seller?.mail || "").trim().toLowerCase();
  if (!email) {
    throw new Error("El vendedor debe tener un mail para crear su usuario");
  }

  const existingUser = await UserModel.findOne({ email });
  const sellerId = new Types.ObjectId(seller._id);

  if (existingUser) {
    if (String(existingUser.role || "").toLowerCase() !== "seller") {
      throw new Error("Ya existe un usuario con ese mail y no es vendedor");
    }

    if (existingUser.vendedor && String(existingUser.vendedor) !== String(seller._id)) {
      throw new Error("Ya existe un usuario vendedor con ese mail asociado a otro vendedor");
    }

    existingUser.vendedor = sellerId;
    await existingUser.save();
    await SellerRepository.updateSeller(seller._id, { user: existingUser._id } as any);
    return existingUser;
  }

  const password = await hashPassword(buildInitialSellerPassword(seller));
  const user = await UserModel.create({
    email,
    password,
    role: "seller",
    vendedor: sellerId,
  });
  await SellerRepository.updateSeller(seller._id, { user: user._id } as any);
  return user;
};

const registerSeller = async (seller: any & { esDeuda: boolean }) => {
  const normalizedSeller = normalizeSellerServiceValues(seller);
  const montoTotal = calcSellerDebt(normalizedSeller);
  const discountPercent = normalizeDiscountPercent(normalizedSeller.descuento_porcentaje);
  const montoConDescuento = buildServiceIncomeDetail(
    normalizedSeller.pago_sucursales,
    discountPercent
  ).reduce((sum, item) => sum + item.total, 0);
  const deuda = normalizedSeller.esDeuda ? montoConDescuento : 0;
  const email = String(normalizedSeller?.mail || "").trim().toLowerCase();
  if (!email) {
    throw new Error("El vendedor debe tener un mail para crear su usuario");
  }

  const existingUser = await UserModel.findOne({ email }).lean();
  if (existingUser && String(existingUser.role || "").toLowerCase() !== "seller") {
    throw new Error("Ya existe un usuario con ese mail y no es vendedor");
  }
  if (existingUser?.vendedor) {
    throw new Error("Ya existe un usuario vendedor con ese mail");
  }

  const nuevo = await SellerRepository.registerSeller({ ...normalizedSeller, mail: email, deuda });
  await createOrLinkSellerUser(nuevo);

  await saveFlux(
    buildServiceIncomeFlux({
      pagoSucursales: normalizedSeller.pago_sucursales,
      baseAmount: montoTotal,
      discountPercent,
      concept: `Alta hasta el ${dayjs(new Date(nuevo.fecha_vigencia)).format(
        "DD/MM/YYYY"
      )}`,
      date: new Date(),
      esDeuda: normalizedSeller.esDeuda,
      sellerId: nuevo._id,
    })
  );

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
      detalle_servicios: buildServiceIncomeDetail(data.pago_sucursales),
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

const renewSellerWithMonths = async (id: string, data: any & { esDeuda?: boolean }) => {
  const vendedor = await SellerRepository.findById(id);
  if (!vendedor) throw new Error(`Seller with id ${id} doesn't exist`);

  const sellerStatus = getSellerLifecycleStatus(
    vendedor.fecha_vigencia,
    (vendedor as any).declinacion_servicio_fecha
  );
  if (sellerStatus === "ya_no_es_cliente") {
    const error: any = new Error("No se puede renovar un vendedor que ya no es cliente");
    error.status = 400;
    throw error;
  }

  let nuevaDeuda = vendedor.deuda ?? 0;
  let montoNuevo = 0;
  const monthsToRenew = Math.max(1, Math.floor(toNumber(data.meses_renovacion || 1)));
  const discountPercent = normalizeDiscountPercent(data.descuento_porcentaje);

  if (data.pago_sucursales) {
    montoNuevo = calcSellerDebt(data);
    const discountedMonthlyAmount = buildServiceIncomeDetail(
      data.pago_sucursales,
      discountPercent
    ).reduce((sum, item) => sum + item.total, 0);
    nuevaDeuda = data.esDeuda
      ? nuevaDeuda + discountedMonthlyAmount * monthsToRenew
      : nuevaDeuda;
    data.deuda = nuevaDeuda;
  }

  await handleSucursalRemovals(
    id,
    vendedor.pago_sucursales || [],
    data.pago_sucursales || []
  );

  const renewalStart = dayjs(vendedor.fecha_vigencia).startOf("day");
  const finalVigencia = renewalStart.add(monthsToRenew, "month").toDate();
  const updateData = {
    ...data,
    fecha_vigencia: finalVigencia,
  };
  delete (updateData as any).meses_renovacion;
  delete (updateData as any).descuento_porcentaje;

  const actualizado = await SellerRepository.updateSeller(id, {
    $set: updateData,
    $unset: {
      declinacion_servicio_fecha: "",
      declinacion_servicio_fecha_limite_retiro: "",
    },
  } as any);

  if (montoNuevo > 0 && actualizado) {
    for (let i = 0; i < monthsToRenew; i++) {
      const periodStart = renewalStart.add(i, "month");
      const periodEnd = renewalStart.add(i + 1, "month");
      await saveFlux(
        buildServiceIncomeFlux({
          pagoSucursales: data.pago_sucursales,
          baseAmount: montoNuevo,
          discountPercent,
          concept: `Renovación hasta el ${periodEnd.format("DD/MM/YYYY")}`,
          date: periodStart.toDate(),
          esDeuda: data.esDeuda ?? true,
          sellerId: actualizado._id,
        })
      );
    }
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

const autoRenewSellers = async () => {
  const sellers = await SellerRepository.findAll();
  const today = dayjs().startOf("day");
  const results = {
    renewed: 0,
    skipped: 0,
    errors: [] as { sellerId: string; error: string }[],
  };

  for (const seller of sellers as any[]) {
    const sellerId = String((seller as any)?._id || "");
    const vigencia = seller?.fecha_vigencia ? dayjs(seller.fecha_vigencia).startOf("day") : null;

    if (!sellerId || !vigencia?.isValid() || vigencia.isAfter(today)) {
      results.skipped += 1;
      continue;
    }

    if ((seller as any).declinacion_servicio_fecha) {
      results.skipped += 1;
      continue;
    }

    try {
      const status = getSellerLifecycleStatus(
        seller.fecha_vigencia,
        (seller as any).declinacion_servicio_fecha
      );
      if (status !== "debe_renovar") {
        results.skipped += 1;
        continue;
      }

      await renewSellerWithMonths(sellerId, {
        pago_sucursales: Array.isArray(seller.pago_sucursales) ? seller.pago_sucursales : [],
        esDeuda: true,
        meses_renovacion: 1,
        descuento_porcentaje: 0,
      });
      results.renewed += 1;
    } catch (error: any) {
      results.errors.push({
        sellerId,
        error: error?.message || "Error renovando vendedor",
      });
    }
  }

  return results;
};

let autoRenewalSchedulerStarted = false;

const startAutoRenewalScheduler = () => {
  if (autoRenewalSchedulerStarted) return;
  autoRenewalSchedulerStarted = true;

  const run = async () => {
    try {
      const result = await autoRenewSellers();
      if (result.renewed > 0 || result.errors.length > 0) {
        console.log("[seller-auto-renewal]", result);
      }
    } catch (error) {
      console.error("[seller-auto-renewal] Error:", error);
    }
  };

  run();
  setInterval(run, 24 * 60 * 60 * 1000);
};

const paySellerDebt = async (id: string, payAll: boolean) => {
  const seller = await SellerRepository.findById(id);
  if (!seller) return null;

  const update: any = {
    $set: {
      saldo_pendiente: 0,
    },
    $unset: {
      fecha_solicitud_pago: "",
      fecha_pago_asignada: "",
    },
  };
  if (payAll) update.$set.deuda = 0;

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

const requestSellerPayment = async (
  id: string,
  file?: Express.Multer.File
) => {
  const seller = await SellerRepository.findById(id);
  if (!seller) {
    const error: any = new Error("Vendedor no encontrado");
    error.status = 404;
    throw error;
  }

  const currentQrUrl = String((seller as any).qr_pago_url || "").trim();
  if (!file && !currentQrUrl) {
    const error: any = new Error("Debes cargar un QR para solicitar el cobro");
    error.status = 400;
    throw error;
  }

  const update: any = {
    fecha_solicitud_pago: new Date(),
    fecha_pago_asignada: getAssignedPaymentDate(),
  };

  if (file) {
    const safeOriginalName = String(file.originalname || "qr-pago.png")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-80);
    const key = `seller-payment-qr/${id}/${Date.now()}-${safeOriginalName}`;
    update.qr_pago_url = await uploadFileToAws(
      file.buffer,
      key,
      file.mimetype || "image/png"
    );
    update.qr_pago_key = key;
  }

  const updatedSeller = await SellerRepository.updateSeller(id, update);
  return {
    seller: updatedSeller,
    fecha_pago_asignada: update.fecha_pago_asignada,
  };
};

const declineSellerService = async (id: string) => {
  const seller = await SellerRepository.findById(id);
  if (!seller) {
    const error: any = new Error("Vendedor no encontrado");
    error.status = 404;
    throw error;
  }

  if ((seller as any).declinacion_servicio_fecha) {
    return seller;
  }

  const vigencia = dayjs(seller.fecha_vigencia).endOf("day");
  if (!vigencia.isValid()) {
    const error: any = new Error("El vendedor no tiene una fecha de vigencia valida");
    error.status = 400;
    throw error;
  }

  const today = dayjs().startOf("day");
  const deadline = vigencia.subtract(5, "day").endOf("day");
  if (today.isAfter(deadline)) {
    const error: any = new Error("La declinacion solo esta habilitada hasta 5 dias antes de la vigencia");
    error.status = 400;
    throw error;
  }

  return await SellerRepository.updateSeller(id, {
    declinacion_servicio_fecha: new Date(),
    declinacion_servicio_fecha_limite_retiro: vigencia.add(5, "day").toDate(),
  } as any);
};

const cancelSellerServiceDecline = async (id: string) => {
  const seller = await SellerRepository.findById(id);
  if (!seller) {
    const error: any = new Error("Vendedor no encontrado");
    error.status = 404;
    throw error;
  }

  return await SellerRepository.updateSeller(id, {
    $unset: {
      declinacion_servicio_fecha: "",
      declinacion_servicio_fecha_limite_retiro: "",
    },
  } as any);
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
  renewSeller: renewSellerWithMonths,
  autoRenewSellers,
  startAutoRenewalScheduler,
  paySellerDebt,
  requestSellerPayment,
  declineSellerService,
  cancelSellerServiceDecline,
  getSellerDebts,
  updateSellerSaldo,
  getServicesSummary,
  getClientsStatusList,
  getSellerPaymentProofs,
};
