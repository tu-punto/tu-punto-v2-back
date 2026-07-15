import { Types } from "mongoose";
import { IBoxClosePendingOperation } from "../entities/IBoxClosePendingOperation";
import { BoxClosePendingOperationModel } from "../entities/implements/BoxClosePendingOperationSchema";

const findPendingByBranchAndBusinessDate = async (sucursalId: string, businessDate: string) => {
  if (!Types.ObjectId.isValid(sucursalId)) return [];

  return await BoxClosePendingOperationModel.find({
    id_sucursal: new Types.ObjectId(sucursalId),
    business_date: businessDate,
    applied_at: { $exists: false },
  })
    .sort({ created_at: 1 })
    .lean()
    .exec();
};

const registerPendingOperation = async (payload: Partial<IBoxClosePendingOperation>) => {
  const doc = new BoxClosePendingOperationModel(payload);
  return await doc.save();
};

const markApplied = async (ids: string[], boxCloseId: string) => {
  const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
  if (!validIds.length || !Types.ObjectId.isValid(boxCloseId)) return;

  await BoxClosePendingOperationModel.updateMany(
    { _id: { $in: validIds.map((id) => new Types.ObjectId(id)) } },
    {
      $set: {
        applied_at: new Date(),
        applied_box_close_id: new Types.ObjectId(boxCloseId),
      },
    }
  );
};

const findBySourceKey = async (sourceKey: string) => {
  if (!String(sourceKey || "").trim()) return null;
  return await BoxClosePendingOperationModel.findOne({ source_key: sourceKey }).lean().exec();
};

export const BoxClosePendingOperationRepository = {
  findPendingByBranchAndBusinessDate,
  registerPendingOperation,
  markApplied,
  findBySourceKey,
};
