import { format } from 'date-fns';
import { IIngreso } from '../entities/IIngreso';
import { IngresoModel } from '../entities/implements/IngresoSchema';
import { Types } from 'mongoose';
import { IIngresoDocument } from '../entities/documents/IIngresoDocument';

export const findBySellerId = async (sellerId: Types.ObjectId): Promise<IIngreso[]> => {
  return await IngresoModel.find({ vendedor: sellerId }).populate('producto');
};

export const findByProductId = async (productId: Types.ObjectId): Promise<any[]> => {
  const entries = await IngresoModel.find({ producto: productId })
    .populate('producto', 'id_producto nombre_producto')
    .populate('vendedor', 'id_vendedor marca nombre apellido');
  return entries.map(entry => {
    const formattedDate = format(new Date(entry.fecha_ingreso), 'dd/MM/yyyy HH:mm:ss');
    return {
      ...entry.toObject(),
      key: `${entry._id}-${formattedDate}`
    };
  });
};

export const deleteEntriesByIds = async (entriesIds: Types.ObjectId[]): Promise<any> => {
  return await IngresoModel.deleteMany({ _id: { $in: entriesIds } });
};

export const deleteProductEntries = async (
    entryData: IIngresoDocument[]
  ): Promise<Types.ObjectId[]> => {
    const ids = entryData.map(entry => entry._id);
    await IngresoModel.deleteMany({ _id: { $in: ids } });
    return ids;
  };

export const findById = async (entryId: Types.ObjectId): Promise<IIngreso | null> => {
  return await IngresoModel.findById(entryId);
};

export const updateEntryById = async (newData: Partial<IIngreso>, entryId: Types.ObjectId): Promise<IIngreso | null> => {
  return await IngresoModel.findByIdAndUpdate(entryId, newData, { new: true });
};

export const updateProductEntries = async (entryData: Partial<IIngreso & { _id: Types.ObjectId }>[]): Promise<IIngreso[]> => {
  const updated: IIngreso[] = [];

  for (const data of entryData) {
    const entry = await IngresoModel.findByIdAndUpdate(data._id, { cantidad_ingreso: data.cantidad_ingreso }, { new: true });
    if (entry) updated.push(entry);
  }

  return updated;
};

export const getEntriesByIds = async (entriesIds: Types.ObjectId[]): Promise<IIngreso[]> => {
  if (!entriesIds || entriesIds.length === 0) return [];
  return await IngresoModel.find({ _id: { $in: entriesIds } });
};

export const createEntry = async (entryData: IIngreso): Promise<IIngreso> => {
  const newEntry = new IngresoModel(entryData);
  return await newEntry.save();
};
