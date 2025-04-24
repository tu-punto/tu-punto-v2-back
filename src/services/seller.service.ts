import { SellerRepository } from "../repositories/seller.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { calcPagoMensual, calcSellerDebt } from "../utils";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { Types } from "mongoose";

const saveFlux = async (flux: IFlujoFinanciero) =>
  await FinanceFluxRepository.registerFinanceFlux(flux);


const getAllSellers = async () => {
  const sellers = await SellerRepository.findAll();
  return sellers.map((seller) => ({
    ...seller,
    pago_mensual: calcPagoMensual(seller),
  }));
}

const getSeller = async (sellerId: string) => {
  const seller = await SellerRepository.findById(parseInt(sellerId));
  return { ...seller, pago_mensual: calcPagoMensual(seller!) };
}


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
    vendedor: new Types.ObjectId(nuevo.id_vendedor),
  });

  return nuevo;
};

const updateSeller = async (sellerId: string, data: any & { esDeuda?: boolean }) => {
  const vendedor = await SellerRepository.findById(sellerId);
  if (!vendedor) throw new Error(`Seller with id ${sellerId} doesn't exist`);

  let deudaFinal = vendedor.deuda ?? 0;
  let montoNuevo = 0;

  if (data.pago_sucursales) {
    montoNuevo = calcSellerDebt(data);
    deudaFinal = data.esDeuda ? deudaFinal + montoNuevo : deudaFinal;
    data.deuda = deudaFinal;
  }

  const actualizado = await SellerRepository.updateSeller(sellerId, data);

  if (montoNuevo > 0 && actualizado) {
    await saveFlux({
      tipo: "INGRESO",
      categoria: "RENOVACION",
      concepto: `Renovación vendedor ${actualizado.nombre}`,
      monto: montoNuevo,
      fecha: new Date(),
      esDeuda: data.esDeuda ?? true,
      vendedor: new Types.ObjectId(actualizado!.id_vendedor),
    });
  }

  return actualizado;
};

export const SellerService = {
  getAllSellers,
  getSeller,
  registerSeller,
  updateSeller,
};
