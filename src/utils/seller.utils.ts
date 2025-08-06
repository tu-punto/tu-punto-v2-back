import { IVendedorDocument } from "../entities/documents/IVendedorDocument";
import { IVentaDocument } from "../entities/documents/IVentaDocument";
import { IFinanceFlux } from "../entities/IFinanceFlux";
import { IVendedor } from "../entities/IVendedor";
import { IVenta } from "../entities/IVenta";
import { FinanceFluxService } from "../services/financeFlux.service";
import { SaleService } from "../services/sale.service";
import { SellerService } from "../services/seller.service";

export interface PagoSucursal {
  alquiler?: number;
  exhibicion?: number;
  delivery?: number;
  entrega_simple?: number;
}

export const calcSucursalSubtotal = (p: PagoSucursal): number =>
  (p.alquiler ?? 0) +
  (p.exhibicion ?? 0) +
  (p.delivery ?? 0) +
  (p.entrega_simple ?? 0);

export const calcSellerDebt = (sellerLike: {
  pago_sucursales: PagoSucursal[];
}): number =>
  sellerLike.pago_sucursales.reduce(
    (tot, p) => tot + calcSucursalSubtotal(p),
    0
  );

export const calcPagoMensual = (seller: {
  pago_sucursales: PagoSucursal[];
}): number =>
  seller.pago_sucursales.reduce(
    (tot, p) =>
      tot +
      Number(p.alquiler ?? 0) +
      Number(p.exhibicion ?? 0) +
      Number(p.delivery ?? 0) +
      Number(p.entrega_simple ?? 0),
    0
  );

export const calcPagoPendiente = (sales: any, debts: IFinanceFlux[]) => {
  const pedidosProcesados = new Set();
  const saldoPendiente = sales.reduce((acc: number, sale: any) => {
    if (
      sale.deposito_realizado ||
      sale.pedido.estado_pedido === "En Espera"
    ) {
      return acc;
    }
    const subtotal = sale.cantidad * sale.precio_unitario;

    let subtotalDeuda = 0;

    if (sale.pedido.pagado_al_vendedor) {
      subtotalDeuda = -sale.utilidad;
    } else {
      subtotalDeuda = subtotal - sale.utilidad;
    }

    if (!pedidosProcesados.has(sale.pedido._id)) {
      subtotalDeuda -=
        sale.pedido.adelanto_cliente + sale.pedido.cargo_delivery;
      pedidosProcesados.add(sale.pedido._id);
    }

    return acc + subtotalDeuda;
  }, 0);

  const deuda = debts.reduce((acc, debt) => {
    if (debt.esDeuda) {
      return acc + debt.monto;
    }
    return acc;
  }, 0);

  return {
    saldo_pendiente: saldoPendiente,
    deuda: deuda,
    pago_pendiente: saldoPendiente - deuda,
  };
};
