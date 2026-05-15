import { Types } from "mongoose";
import moment from "moment-timezone";
import { VentaExternaModel } from "../entities/implements/VentaExternaSchema";
import { IVentaExterna } from "../entities/IVentaExterna";
import { IVentaExternaDocument } from "../entities/documents/IVentaExternaDocument";

const SIMPLE_PACKAGE_FILTER = { service_origin: "simple_package" };

const getSimplePackageByID = async (id: string): Promise<IVentaExternaDocument | null> => {
  if (!Types.ObjectId.isValid(id)) return null;
  return await VentaExternaModel.findOne({
    _id: new Types.ObjectId(id),
    ...SIMPLE_PACKAGE_FILTER,
  }).populate("sucursal");
};

const getSimplePackagesByIDs = async (ids: string[]): Promise<IVentaExternaDocument[]> => {
  const validIds = (ids || [])
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  if (!validIds.length) return [];

  return await VentaExternaModel.find({
    _id: { $in: validIds },
    ...SIMPLE_PACKAGE_FILTER,
  })
    .populate({ path: "sucursal", select: "_id nombre" })
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" });
};

const getSimplePackagesList = async (params: {
  sellerId?: string;
  originBranchId?: string;
  from?: Date;
  to?: Date;
}) => {
  const match: any = { ...SIMPLE_PACKAGE_FILTER, is_external: { $ne: true } };

  if (params.sellerId && Types.ObjectId.isValid(params.sellerId)) {
    match.id_vendedor = new Types.ObjectId(params.sellerId);
  }

  if (params.originBranchId && Types.ObjectId.isValid(params.originBranchId)) {
    match.origen_sucursal = new Types.ObjectId(params.originBranchId);
  }

  if (params.from || params.to) {
    match.fecha_pedido = {};
    if (params.from) match.fecha_pedido.$gte = params.from;
    if (params.to) match.fecha_pedido.$lte = params.to;
  }

  return await VentaExternaModel.find(match)
    .sort({ fecha_pedido: -1, numero_paquete: 1 })
    .populate({ path: "sucursal", select: "_id nombre" })
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" })
    .lean();
};

const getNextPackageNumberForSeller = async (sellerId: string) => {
  if (!Types.ObjectId.isValid(sellerId)) return 1;

  const lastRow = await VentaExternaModel.findOne({
    ...SIMPLE_PACKAGE_FILTER,
    id_vendedor: new Types.ObjectId(sellerId),
  })
    .sort({ numero_paquete: -1 })
    .select("numero_paquete")
    .lean();

  return Number(lastRow?.numero_paquete || 0) + 1;
};

const countSimplePackagesForSellerInCurrentMonth = async (sellerId: string) => {
  if (!Types.ObjectId.isValid(sellerId)) return 0;

  const now = moment().tz("America/La_Paz");
  const monthStart = now.clone().startOf("month").toDate();
  const nextMonthStart = now.clone().add(1, "month").startOf("month").toDate();

  return await VentaExternaModel.countDocuments({
    ...SIMPLE_PACKAGE_FILTER,
    id_vendedor: new Types.ObjectId(sellerId),
    fecha_pedido: {
      $gte: monthStart,
      $lt: nextMonthStart,
    },
  });
};

const registerSimplePackages = async (rows: IVentaExterna[]): Promise<IVentaExternaDocument[]> => {
  if (!rows.length) return [];
  const created = await VentaExternaModel.insertMany(rows);
  return created as IVentaExternaDocument[];
};

const updateSimplePackageByID = async (
  id: string,
  payload: Partial<IVentaExterna>
): Promise<IVentaExternaDocument | null> => {
  if (!Types.ObjectId.isValid(id)) return null;
  return await VentaExternaModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(id),
      ...SIMPLE_PACKAGE_FILTER,
    },
    payload,
    { new: true }
  )
    .populate("sucursal")
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" });
};

const deleteSimplePackageByID = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) return null;
  return await VentaExternaModel.findOneAndDelete({
    _id: new Types.ObjectId(id),
    ...SIMPLE_PACKAGE_FILTER,
  });
};

const getUploadedSimplePackageSellers = async (originBranchId?: string) => {
  const match: any = { ...SIMPLE_PACKAGE_FILTER, is_external: { $ne: true } };
  if (originBranchId && Types.ObjectId.isValid(originBranchId)) {
    match.origen_sucursal = new Types.ObjectId(originBranchId);
  }

  return await VentaExternaModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$id_vendedor",
        vendedor: { $first: "$vendedor" },
        carnet_vendedor: { $first: "$carnet_vendedor" },
        telefono_vendedor: { $first: "$telefono_vendedor" },
        total_paquetes: { $sum: 1 },
        ultimo_pedido: { $max: "$fecha_pedido" },
      },
    },
    {
      $lookup: {
        from: "Vendedor",
        localField: "_id",
        foreignField: "_id",
        as: "seller",
      },
    },
    { $unwind: { path: "$seller", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        nombre_vendedor: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$seller.nombre", ""] },
                " ",
                { $ifNull: ["$seller.apellido", ""] },
              ],
            },
          },
        },
        marca_vendedor: { $trim: { input: { $ifNull: ["$seller.marca", ""] } } },
      },
    },
    {
      $addFields: {
        vendedor: {
          $cond: [
            { $and: [{ $ne: ["$marca_vendedor", ""] }, { $ne: ["$nombre_vendedor", ""] }] },
            { $concat: ["$marca_vendedor", " - ", "$nombre_vendedor"] },
            {
              $cond: [
                { $ne: ["$nombre_vendedor", ""] },
                "$nombre_vendedor",
                {
                  $cond: [
                    { $ne: ["$marca_vendedor", ""] },
                    "$marca_vendedor",
                    "$vendedor",
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    { $project: { seller: 0, nombre_vendedor: 0, marca_vendedor: 0 } },
    { $match: { _id: { $ne: null } } },
    { $sort: { vendedor: 1 } },
  ]);
};

const getSellerAccountingSimplePackages = async (sellerId: string) => {
  if (!Types.ObjectId.isValid(sellerId)) return [];

  return await VentaExternaModel.find({
    ...SIMPLE_PACKAGE_FILTER,
    id_vendedor: new Types.ObjectId(sellerId),
    is_external: true,
    seller_balance_applied: true,
  })
    .sort({ fecha_pedido: -1, numero_paquete: 1 })
    .populate({ path: "origen_sucursal", select: "_id nombre" })
    .populate({ path: "destino_sucursal", select: "_id nombre" })
    .lean();
};

const markSellerAccountingSimplePackagesDeposited = async (sellerId: string) => {
  if (!Types.ObjectId.isValid(sellerId)) return { modifiedCount: 0 };

  return await VentaExternaModel.updateMany(
    {
      ...SIMPLE_PACKAGE_FILTER,
      id_vendedor: new Types.ObjectId(sellerId),
      is_external: true,
      seller_balance_applied: true,
      deposito_realizado: { $ne: true },
    },
    {
      $set: { deposito_realizado: true },
    }
  );
};

export const SimplePackageRepository = {
  getSimplePackageByID,
  getSimplePackagesByIDs,
  getSimplePackagesList,
  getNextPackageNumberForSeller,
  countSimplePackagesForSellerInCurrentMonth,
  registerSimplePackages,
  updateSimplePackageByID,
  deleteSimplePackageByID,
  getUploadedSimplePackageSellers,
  getSellerAccountingSimplePackages,
  markSellerAccountingSimplePackagesDeposited,
};
