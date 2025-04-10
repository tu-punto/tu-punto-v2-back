import { IEfectivoDiario } from "../entities/IEfectivoDiario";
import { DailyEffectiveRepository } from "../repositories/dailyEffective.repository";

const getAllDailyEffective = async () => {
  return await DailyEffectiveRepository.findAll();
};

const registerDailyEffective = async (boxClose: any) => {
  return await DailyEffectiveRepository.registerDailyEffective(boxClose);
};

const getDailyEffectiveById = async (id: any) => {
  const dailyEffective = await DailyEffectiveRepository.getDailyEffectiveById(
    id
  );
  if (!dailyEffective)
    throw new Error("Doesn't exist a daily effective with such id");
  return dailyEffective;
};

const updateDailyEffective = async (dailyEffectiveID: any, newData: any) => {
  const dailyEffective = await DailyEffectiveRepository.getDailyEffectiveById(
    dailyEffectiveID
  );
  if (!dailyEffective)
    throw new Error(`dailyEffective with id ${dailyEffectiveID} doesn't exist`);
  return await DailyEffectiveRepository.updateDailyEffective(
    dailyEffective,
    newData
  );
};

export const DailyEffectiveService = {
  getAllDailyEffective,
  registerDailyEffective,
  getDailyEffectiveById,
  updateDailyEffective,
};
