import { Types } from "mongoose";
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

const getSimplePackagesList = async (params: {
  sellerId?: string;
  from?: Date;
  to?: Date;
}) => {
  const match: any = { ...SIMPLE_PACKAGE_FILTER };

  if (params.sellerId && Types.ObjectId.isValid(params.sellerId)) {
    match.id_vendedor = new Types.ObjectId(params.sellerId);
  }

  if (params.from || params.to) {
    match.fecha_pedido = {};
    if (params.from) match.fecha_pedido.$gte = params.from;
    if (params.to) match.fecha_pedido.$lte = params.to;
  }

  return await VentaExternaModel.find(match)
    .sort({ fecha_pedido: -1, numero_paquete: 1 })
    .populate({ path: "sucursal", select: "_id nombre" })
    .lean();
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
  ).populate("sucursal");
};

const deleteSimplePackageByID = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) return null;
  return await VentaExternaModel.findOneAndDelete({
    _id: new Types.ObjectId(id),
    ...SIMPLE_PACKAGE_FILTER,
  });
};

const getUploadedSimplePackageSellers = async () => {
  return await VentaExternaModel.aggregate([
    { $match: SIMPLE_PACKAGE_FILTER },
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
    { $match: { _id: { $ne: null } } },
    { $sort: { vendedor: 1 } },
  ]);
};

export const SimplePackageRepository = {
  getSimplePackageByID,
  getSimplePackagesList,
  registerSimplePackages,
  updateSimplePackageByID,
  deleteSimplePackageByID,
  getUploadedSimplePackageSellers,
};
