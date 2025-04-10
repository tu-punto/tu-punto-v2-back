import { IEfectivoDiario } from "../entities/IEfectivoDiario";
import { EfectivoDiarioModel } from "../entities/implements/EfectivoDiarioSchema";

const findAll = async (): Promise<IEfectivoDiario[]> => {
  return await EfectivoDiarioModel.find().lean();
};


const registerDailyEffective = async (
  dailyEffective: IEfectivoDiario
): Promise<IEfectivoDiario> => {
  const newDailyEffective = new EfectivoDiarioModel(dailyEffective);
  return await newDailyEffective.save();
};

const getDailyEffectiveById = async (id: string): Promise<IEfectivoDiario | null> => {
  return await EfectivoDiarioModel.findById(id).lean();
};

const updateDailyEffective = async (
  id: any,
  newData: Partial<IEfectivoDiario>
): Promise<IEfectivoDiario | null> => {
  
  return await EfectivoDiarioModel.findByIdAndUpdate(id, newData, {
    new: true,
  }).lean();
};


export const DailyEffectiveRepository = {
  findAll,
  registerDailyEffective,
  getDailyEffectiveById,
  updateDailyEffective,
};

