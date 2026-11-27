import { Types } from "mongoose";
import { SimplePackageBranchPriceModel } from "../entities/implements/SimplePackageBranchPriceSchema";

const listBranchPrices = async (originBranchId?: string) => {
  const match: any = {};
  if (originBranchId && Types.ObjectId.isValid(originBranchId)) {
    match.origen_sucursal = new Types.ObjectId(originBranchId);
  }

  return await SimplePackageBranchPriceModel.find(match)
    .sort({ origen_sucursal: 1, destino_sucursal: 1 })
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" })
    .populate({ path: "destino_paqueteria", select: "_id nombre activo tipo tarifa_fija" })
    .lean();
};

const findPriceByRoute = async (originBranchId: string, destinationBranchId: string) => {
  if (!Types.ObjectId.isValid(originBranchId) || !Types.ObjectId.isValid(destinationBranchId)) {
    return null;
  }

  return await SimplePackageBranchPriceModel.findOne({
    origen_sucursal: new Types.ObjectId(originBranchId),
    destino_sucursal: new Types.ObjectId(destinationBranchId),
    destino_tipo: { $ne: "paqueteria" },
  })
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" })
    .lean();
};

const upsertBranchPrice = async (
  originBranchId: string,
  destinationId: string,
  precio: number,
  destinationType: "sucursal" | "paqueteria" = "sucursal"
) => {
  const destinationObjectId = new Types.ObjectId(destinationId);
  return await SimplePackageBranchPriceModel.findOneAndUpdate(
    {
      origen_sucursal: new Types.ObjectId(originBranchId),
      // destino_sucursal remains the compatibility key for legacy routes and
      // their existing unique index. For courier destinations, its value is
      // the courier id while destino_tipo identifies the real entity type.
      destino_sucursal: destinationObjectId,
    },
    {
      origen_sucursal: new Types.ObjectId(originBranchId),
      destino_sucursal: destinationObjectId,
      destino_tipo: destinationType,
      destino_paqueteria: destinationType === "paqueteria" ? destinationObjectId : undefined,
      precio,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" })
    .populate({ path: "destino_paqueteria", select: "_id nombre activo" });
};

export const SimplePackageBranchPriceRepository = {
  listBranchPrices,
  findPriceByRoute,
  upsertBranchPrice,
};
