import { Types } from "mongoose";
import { FlujoFinancieroModel } from "../entities/implements/FlujoFinancieroSchema";
import { IFlujoFinanciero } from "../entities/IFlujoFinanciero";
import { IFlujoFinancieroDocument } from "../entities/documents/IFlujoFinancieroDocument";

const financeFluxPopulate = [
  { path: "id_vendedor", select: "nombre apellido" },
  { path: "id_trabajador", select: "nombre" },
  { path: "id_sucursal", select: "nombre" },
  { path: "detalle_servicios.id_sucursal", select: "nombre" },
];

const SIMPLE_PACKAGE_INCOME_CONCEPT_REGEX = /^Paquetes?\s+simples?\s+en\s+(efectivo|qr)(\s*\(\d+\))?$/i;

const applyGeneralFinanceFluxVisibilityFilter = (match: any = {}) => {
  match.visible_en_flujo_general = { $ne: false };
  match.$nor = [
    ...(Array.isArray(match.$nor) ? match.$nor : []),
    {
      tipo: "INGRESO",
      categoria: "SERVICIO",
      concepto: { $regex: SIMPLE_PACKAGE_INCOME_CONCEPT_REGEX },
    },
  ];
  return match;
};

const findAll = async (): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find(
    applyGeneralFinanceFluxVisibilityFilter({})
  )
    .populate(financeFluxPopulate)
    .exec();
};

const findByDateRange = async (
  from?: Date,
  to?: Date,
  sucursalIds?: string[]
): Promise<IFlujoFinancieroDocument[]> => {
  if (!from && !to && !sucursalIds?.length) return await findAll();

  const match: any = applyGeneralFinanceFluxVisibilityFilter({});
  if (from || to) {
    match.fecha = {};
    if (from) match.fecha.$gte = from;
    if (to) match.fecha.$lte = to;
  }
  if (sucursalIds?.length) {
    const sucursalObjectIds = sucursalIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    match.$or = [
      {
        id_sucursal: {
          $in: sucursalObjectIds,
        },
      },
      {
        "detalle_servicios.id_sucursal": {
          $in: sucursalObjectIds,
        },
      },
    ];
  }

  return await FlujoFinancieroModel.find(match)
    .populate(financeFluxPopulate)
    .exec();
};

const buildBranchDetailMatch = (sucursalIds?: string[]) => {
  if (!sucursalIds?.length) return {};

  const sucursalObjectIds = sucursalIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  return {
    $or: [
      {
        id_sucursal: {
          $in: sucursalObjectIds,
        },
      },
      {
        "detalle_servicios.id_sucursal": {
          $in: sucursalObjectIds,
        },
      },
    ],
  };
};

const findServiceIncomeByDateRange = async (
  from?: Date,
  to?: Date,
  sucursalIds?: string[]
): Promise<IFlujoFinancieroDocument[]> => {
  const match: any = {
    tipo: "INGRESO",
    categoria: "SERVICIO",
    esDeuda: { $ne: true },
    ...buildBranchDetailMatch(sucursalIds),
  };

  if (from || to) {
    match.fecha = {};
    if (from) match.fecha.$gte = from;
    if (to) match.fecha.$lte = to;
  }

  return await FlujoFinancieroModel.find(match)
    .populate(financeFluxPopulate)
    .exec();
};

const findAllDebts = async (): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find({
    esDeuda: true,
    id_vendedor: { $ne: null },
  })
    .lean()
    .exec();
};

const registerFinanceFlux = async (
  financeFlux: IFlujoFinanciero
): Promise<IFlujoFinancieroDocument> => {
  const newFinanceFlux = new FlujoFinancieroModel(financeFlux);
  return await newFinanceFlux.save();
};

const findWorkerById = async (
  workerId: Types.ObjectId
): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findOne({
    trabajador: workerId,
  })
    .populate("trabajador")
    .exec();
};

const findById = async (
  id: Types.ObjectId
): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findById(id).exec();
};

const updateById = async (
  id: string,
  payload: Partial<IFlujoFinanciero>
): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findByIdAndUpdate(id, payload, {
    new: true,
  }).exec();
};

const findSellerById = async (
  sellerId: Types.ObjectId
): Promise<IFlujoFinancieroDocument | null> => {
  return await FlujoFinancieroModel.findOne({
    where: {
      vendedor: sellerId,
    },
    populate: ["vendedor"],
  }).exec();
};

const findSellerInfoById = async (
  sellerId: Types.ObjectId
): Promise<IFlujoFinancieroDocument[]> => {
  return await FlujoFinancieroModel.find({ id_vendedor: sellerId }).exec();
};

const markFinanceFluxAsPaid = async (sellerId: string): Promise<void> => {
  await FlujoFinancieroModel.updateMany(
    { id_vendedor: sellerId, esDeuda: true },
    { $set: { esDeuda: false } }
  );
};

export const FinanceFluxRepository = {
  findAll,
  findByDateRange,
  findServiceIncomeByDateRange,
  registerFinanceFlux,
  findWorkerById,
  findSellerById,
  findSellerInfoById,
  findById,
  updateById,
  markFinanceFluxAsPaid,
  findAllDebts,
};
