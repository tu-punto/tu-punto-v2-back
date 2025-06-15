import { SellerRepository } from "../repositories/seller.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { calcPagoMensual, calcSellerDebt } from "../utils";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { Types } from "mongoose";
import { SellerPdfService } from "../services/sellerPdf.service"; // Importar el servicio de generación de PDF

const saveFlux = async (flux: IFlujoFinanciero) =>
  await FinanceFluxRepository.registerFinanceFlux(flux);

const getAllSellers = async () => {
  const sellers = await SellerRepository.findAll();
  return sellers.map((seller) => ({
    ...seller,
    pago_mensual: calcPagoMensual(seller),
  }));
};

const getSeller = async (sellerId: string) => {
  const seller = await SellerRepository.findById(sellerId);
  return { ...seller, pago_mensual: calcPagoMensual(seller!) };
};

const registerSeller = async (seller: any & { esDeuda: boolean }) => {
  const montoTotal = calcSellerDebt(seller);
  const deuda = seller.esDeuda ? montoTotal : 0;

  const nuevo = await SellerRepository.registerSeller({ ...seller, deuda });

  await saveFlux({
    tipo: "INGRESO",
    categoria: "REGISTRO",
    concepto: `Alta vendedor ${nuevo.nombre}`,
    monto: montoTotal,
    fecha: new Date(),
    esDeuda: seller.esDeuda,
    id_vendedor: new Types.ObjectId(nuevo._id),
  });

  return nuevo;
};

const updateSeller = async (id: string, data: any) => {
  return await SellerRepository.updateSeller(id, data.newData);
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

  const actualizado = await SellerRepository.updateSeller(id, data);

  if (montoNuevo > 0 && actualizado) {
    await saveFlux({
      tipo: "INGRESO",
      categoria: "RENOVACION",
      concepto: `Renovación vendedor ${actualizado.nombre}`,
      monto: montoNuevo,
      fecha: new Date(),
      esDeuda: data.esDeuda ?? true,
      id_vendedor: actualizado._id,
    });
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

  const updatedSeller = await SellerRepository.updateSeller(id, update);
  if (!updateSeller) {
    return
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

export const SellerService = {
  getAllSellers,
  getSeller,
  registerSeller,
  updateSeller,
  renewSeller,
  paySellerDebt,
  getSellerDebts,
  updateSellerSaldo,
};
