import mongoose from "mongoose";
import connectToMongoDB from "../config/mongoConnection";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import {
  calculateLatePickupFee,
  resolveBranchPickupFeeStart,
} from "../utils/latePickupFee";

const APPLY = process.argv.includes("--apply");

const roundCurrency = (value: number): number => +Number(value || 0).toFixed(2);

const idOf = (value: any): string =>
  String(value?._id || value?.id_sucursal || value?.$oid || value || "").trim();

const isDelivered = (row: any) =>
  String(row?.estado_pedido || "").trim() === "Entregado" || row?.delivered === true;

const resolvePickedUpAt = (row: any) => {
  if (row?.public_tracking_frozen === true && row?.public_tracking_frozen_at) {
    return row.public_tracking_frozen_at;
  }
  return row?.hora_entrega_real || row?.seller_withdrawn_at || row?.public_tracking_frozen_at || new Date();
};

const recalculateFee = (row: any, startAt: unknown) =>
  roundCurrency(
    calculateLatePickupFee({
      startAt,
      pickedUpAt: resolvePickedUpAt(row),
    })
  );

const buildDeliveredPaymentPatch = (row: any, delta: number) => {
  if (!isDelivered(row) || delta === 0) return {};

  const paymentType = String(row?.tipo_de_pago || "").trim().toLowerCase();
  const subtotalQr = roundCurrency(Number(row?.subtotal_qr || 0));
  const subtotalEfectivo = roundCurrency(Number(row?.subtotal_efectivo || 0));

  if (paymentType === "1" || paymentType === "transferencia o qr" || paymentType === "qr") {
    return {
      subtotal_qr: roundCurrency(Math.max(0, subtotalQr + delta)),
      subtotal_efectivo: subtotalEfectivo,
    };
  }

  return {
    subtotal_qr: subtotalQr,
    subtotal_efectivo: roundCurrency(Math.max(0, subtotalEfectivo + delta)),
  };
};

const buildExternalDeliveredPatch = (row: any, delta: number) => {
  if (!isDelivered(row) || delta === 0) return {};

  const paymentPatch = buildDeliveredPaymentPatch(row, delta);
  return {
    ...paymentPatch,
    deuda_comprador: roundCurrency(Math.max(0, Number(row?.deuda_comprador || 0) + delta)),
    monto_paga_comprador: roundCurrency(Math.max(0, Number(row?.monto_paga_comprador || 0) + delta)),
    saldo_cobrar: roundCurrency(Math.max(0, Number(row?.saldo_cobrar || 0) + delta)),
  };
};

const getPedidoFeeStart = async (pedido: any) => {
  const originId = idOf(pedido?.lugar_origen);
  let destinationId = idOf(pedido?.sucursal);

  const sourceId = idOf(pedido?.simple_package_source_id);
  if (sourceId) {
    const source = await VentaExternaModel.findById(sourceId).select("destino_sucursal").lean();
    destinationId = idOf((source as any)?.destino_sucursal) || destinationId;
  }

  if (originId && destinationId && originId !== destinationId) {
    return resolveBranchPickupFeeStart(pedido);
  }

  return pedido?.fecha_pedido;
};

const getExternalFeeStart = (row: any) => {
  const originId = idOf(row?.origen_sucursal) || idOf(row?.sucursal);
  const destinationId = idOf(row?.destino_sucursal) || idOf(row?.sucursal);

  if (originId && destinationId && originId !== destinationId) {
    return resolveBranchPickupFeeStart(row);
  }

  return row?.fecha_pedido;
};

const shouldConsiderRow = {
  $or: [
    { late_pickup_fee: { $gt: 0 } },
    { public_tracking_frozen: true, estado_pedido: { $ne: "Entregado" } },
  ],
};

const run = async () => {
  try {
    await connectToMongoDB();

    const [pedidos, externas] = await Promise.all([
      PedidoModel.find({
        $and: [
          shouldConsiderRow,
          {
            $or: [
              { simple_package_order: true },
              { simple_package_source_id: { $exists: true, $ne: null } },
            ],
          },
        ],
      }).lean(),
      VentaExternaModel.find({
        $and: [
          shouldConsiderRow,
          {
            $or: [
              { service_origin: { $exists: false } },
              { service_origin: "external" },
              { service_origin: "simple_package" },
            ],
          },
        ],
      }).lean(),
    ]);

    let pedidoChanged = 0;
    let externalChanged = 0;
    let totalDelta = 0;

    for (const pedido of pedidos as any[]) {
      const previousFee = roundCurrency(Number(pedido?.late_pickup_fee || 0));
      const nextFee = recalculateFee(pedido, await getPedidoFeeStart(pedido));
      const delta = roundCurrency(nextFee - previousFee);
      if (delta === 0) continue;

      const update = {
        late_pickup_fee: nextFee,
        ...buildDeliveredPaymentPatch(pedido, delta),
      };

      if (APPLY) {
        await PedidoModel.updateOne({ _id: pedido._id }, { $set: update });
      }

      pedidoChanged += 1;
      totalDelta = roundCurrency(totalDelta + delta);
    }

    for (const row of externas as any[]) {
      const previousFee = roundCurrency(Number(row?.late_pickup_fee || 0));
      const nextFee = recalculateFee(row, getExternalFeeStart(row));
      const delta = roundCurrency(nextFee - previousFee);
      if (delta === 0) continue;

      const update = {
        late_pickup_fee: nextFee,
        ...buildExternalDeliveredPatch(row, delta),
      };

      if (APPLY) {
        await VentaExternaModel.updateOne({ _id: row._id }, { $set: update });
      }

      externalChanged += 1;
      totalDelta = roundCurrency(totalDelta + delta);
    }

    console.log(
      `[late-pickup-fee-20-days] mode=${APPLY ? "apply" : "dry-run"} pedidos=${pedidoChanged} externas=${externalChanged} total_delta=${totalDelta}`
    );
    if (!APPLY) {
      console.log("[late-pickup-fee-20-days] run with --apply to persist these changes");
    }
  } catch (error) {
    console.error("[late-pickup-fee-20-days] failed", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

void run();
