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

export const calcSellerDebt = (sellerLike: { pago_sucursales: PagoSucursal[] }): number =>
    sellerLike.pago_sucursales.reduce((tot, p) => tot + calcSucursalSubtotal(p), 0);


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