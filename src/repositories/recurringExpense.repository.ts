import { RecurringExpenseModel } from "../entities/implements/RecurringExpenseSchema";
import { IRecurringExpense } from "../entities/IRecurringExpense";

const recurringExpensePopulate = [{ path: "id_sucursal", select: "nombre" }];

const findAll = async () => {
  return await RecurringExpenseModel.find({ activo: true })
    .populate(recurringExpensePopulate)
    .sort({ createdAt: 1, _id: 1 })
    .exec();
};

const findById = async (id: string) => {
  return await RecurringExpenseModel.findOne({ _id: id, activo: true })
    .populate(recurringExpensePopulate)
    .exec();
};

const create = async (payload: IRecurringExpense) => {
  const created = await RecurringExpenseModel.create(payload);
  return await RecurringExpenseModel.findById(created._id)
    .populate(recurringExpensePopulate)
    .exec();
};

const updateById = async (id: string, payload: Partial<IRecurringExpense>) => {
  return await RecurringExpenseModel.findOneAndUpdate(
    { _id: id, activo: true },
    payload,
    { new: true }
  )
    .populate(recurringExpensePopulate)
    .exec();
};

const deleteById = async (id: string) => {
  return await RecurringExpenseModel.findByIdAndUpdate(
    id,
    { activo: false },
    { new: true }
  ).exec();
};

export const RecurringExpenseRepository = {
  findAll,
  findById,
  create,
  updateById,
  deleteById,
};
