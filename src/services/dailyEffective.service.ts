import { DailyEffectiveRepository } from "../repositories/dailyEffective.repository";

const getAllDailyEffective = async () => {
  return await DailyEffectiveRepository.findAll();
};

const registerDailyEffective = async (boxClose: any) => {
  return await DailyEffectiveRepository.registerDailyEffective(boxClose);
};

const getDailyEffectiveById = async (id: number) => {
  const category = await DailyEffectiveRepository.getDailyEffectiveById(id);
  if (!category)
    throw new Error("Doesn't exist a daily effective with such id");
  return category;
};

export const DailyEffectiveService = {
  getAllDailyEffective,
  registerDailyEffective,
  getDailyEffectiveById,
};
