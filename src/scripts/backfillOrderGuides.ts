import mongoose from "mongoose";
import connectToMongoDB from "../config/mongoConnection";
import { PedidoModel } from "../entities/implements/PedidoSchema";
import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { OrderGuideService } from "../services/orderGuide.service";

type BackfillCandidate = {
  kind: "pedido" | "external";
  _id: mongoose.Types.ObjectId;
  fecha_pedido?: Date;
  createdAt?: Date;
  order: any;
};

const missingGuideFilter = {
  $or: [
    { numero_guia: { $exists: false } },
    { numero_guia: null },
    { numero_guia: "" },
  ],
};

const run = async () => {
  try {
    await connectToMongoDB();

    const [pedidos, externalSales] = await Promise.all([
      PedidoModel.find({
        ...missingGuideFilter,
        simple_package_order: true,
      }).lean(),
      VentaExternaModel.find({
        ...missingGuideFilter,
        service_origin: { $ne: "simple_package" },
      }).lean(),
    ]);

    const candidates: BackfillCandidate[] = [
      ...pedidos.map((order: any) => ({
        kind: "pedido" as const,
        _id: order._id,
        fecha_pedido: order.fecha_pedido,
        order,
      })),
      ...externalSales.map((order: any) => ({
        kind: "external" as const,
        _id: order._id,
        fecha_pedido: order.fecha_pedido,
        order,
      })),
    ].sort((a, b) => {
      const aTime = new Date(a.fecha_pedido || a._id.getTimestamp()).getTime();
      const bTime = new Date(b.fecha_pedido || b._id.getTimestamp()).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return String(a._id).localeCompare(String(b._id));
    });

    let pedidosUpdated = 0;
    let externalUpdated = 0;

    for (const candidate of candidates) {
      const guideUpdate = await OrderGuideService.buildMissingGuideUpdate(candidate.order);

      if (candidate.kind === "pedido") {
        await PedidoModel.updateOne(
          { _id: candidate._id, ...missingGuideFilter },
          { $set: guideUpdate }
        );
        pedidosUpdated += 1;
      } else {
        await VentaExternaModel.updateOne(
          { _id: candidate._id, ...missingGuideFilter },
          { $set: guideUpdate }
        );
        externalUpdated += 1;
      }
    }

    console.log(
      `[order-guide-backfill] processed=${candidates.length} pedidos=${pedidosUpdated} external=${externalUpdated}`
    );
  } catch (error) {
    console.error("[order-guide-backfill] failed", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

void run();
