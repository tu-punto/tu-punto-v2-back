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
    .lean();
};

const findPriceByRoute = async (originBranchId: string, destinationBranchId: string) => {
  if (!Types.ObjectId.isValid(originBranchId) || !Types.ObjectId.isValid(destinationBranchId)) {
    return null;
  }

  return await SimplePackageBranchPriceModel.findOne({
    origen_sucursal: new Types.ObjectId(originBranchId),
    destino_sucursal: new Types.ObjectId(destinationBranchId),
  })
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" })
    .lean();
};

const upsertBranchPrice = async (originBranchId: string, destinationBranchId: string, precio: number) => {
  return await SimplePackageBranchPriceModel.findOneAndUpdate(
    {
      origen_sucursal: new Types.ObjectId(originBranchId),
      destino_sucursal: new Types.ObjectId(destinationBranchId),
    },
    {
      origen_sucursal: new Types.ObjectId(originBranchId),
      destino_sucursal: new Types.ObjectId(destinationBranchId),
      precio,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" });
};

export const SimplePackageBranchPriceRepository = {
  listBranchPrices,
  findPriceByRoute,
  upsertBranchPrice,
};
