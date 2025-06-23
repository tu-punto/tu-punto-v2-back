import { SellerRepository } from "../repositories/seller.repository";
import { FinanceFluxRepository } from "../repositories/financeFlux.repository";
import { calcPagoMensual, calcSellerDebt } from "../utils";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { Types } from "mongoose";
import { SellerPdfService } from "../services/sellerPdf.service"; // Importar el servicio de generación de PDF
import { ProductoModel } from "../entities/implements/ProductoSchema";
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
const syncSellerProductBranches = async (sellerId: string, nuevasSucursales: any[]) => {
  const productos = await ProductoModel.find({ id_vendedor: sellerId });

  if (!productos.length) return; // No hay productos, no hay que hacer nada

  for (const producto of productos) {
    const sucursalesExistentes = (producto.sucursales || []).map(s => s.id_sucursal.toString());
    const sucursalReferencia = producto.sucursales?.[0];

    if (!sucursalReferencia) continue; // nada que clonar

    for (const nuevaSucursal of nuevasSucursales) {
      const nuevaId = nuevaSucursal.id_sucursal.toString();

      if (sucursalesExistentes.includes(nuevaId)) continue; // ya existe, skip

      const nuevasCombinaciones = (sucursalReferencia.combinaciones || []).map(c => ({
        variantes: c.variantes,
        stock: 0,
        precio: c.precio, // podrías poner 0 si querés obligar a definirlo por sucursal
      }));

      producto.sucursales.push({
        id_sucursal: nuevaSucursal.id_sucursal,
        combinaciones: nuevasCombinaciones,
      });
    }

    await producto.save(); // guardar cambios en producto
  }
};
const canRemoveSucursalFromSeller = async (sellerId: string, idSucursal: string): Promise<boolean> => {
  const productos = await ProductoModel.find({ id_vendedor: sellerId });

  for (const producto of productos) {
    const sucursal = producto.sucursales?.find(s => s.id_sucursal.toString() === idSucursal);
    if (!sucursal) continue;

    const tieneStock = sucursal.combinaciones?.some(c => c.stock > 0);
    if (tieneStock) return false;
  }

  return true;
};
const handleSucursalRemovals = async (
  sellerId: string,
  anteriores: any[],
  actuales: any[]
) => {
  const eliminadas = anteriores.filter(prev =>
    !actuales.some((curr: any) =>
      curr.id_sucursal.toString() === prev.id_sucursal.toString()
    )
  );

  const sucursalesConStock: string[] = [];

  for (const sucursal of eliminadas) {
    const idSucursal = sucursal.id_sucursal.toString();
    const puedeEliminar = await canRemoveSucursalFromSeller(sellerId, idSucursal);

    if (!puedeEliminar) {
      sucursalesConStock.push(sucursal.sucursalName || "Sucursal sin nombre");
    }
  }

  if (sucursalesConStock.length > 0) {
    throw {
      status: 400,
      msg: `No se pueden eliminar las siguientes sucursales porque aún tienen productos con stock: ${sucursalesConStock.join(", ")}`
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
  
  await handleSucursalRemovals(id, vendedor.pago_sucursales || [], data.pago_sucursales || []);

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
  if (data.pago_sucursales?.length) {
  const nuevasSucursales = data.pago_sucursales.filter((s: any) => {
    return !vendedor.pago_sucursales?.some((ps: any) =>
      ps.id_sucursal.toString() === s.id_sucursal.toString()
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
