import AppDataSource from "../config/dataSource";
import { IEfectivoDiario } from "../entities/IEfectivoDiario";
import { EfectivoDiarioEntity } from "../entities/implements/EfectivoDiarioSchema";

const dailyEffectiveRepository =
  AppDataSource.getRepository(EfectivoDiarioEntity);

const findAll = async (): Promise<IEfectivoDiario[]> => {
  return await dailyEffectiveRepository.find();
};

const registerDailyEffective = async (
  dailyEffective: IEfectivoDiario
): Promise<IEfectivoDiario> => {
  const newDailyEffective = dailyEffectiveRepository.create(dailyEffective);
  const savedDailyEffective = await dailyEffectiveRepository.save(
    newDailyEffective
  );
  return savedDailyEffective;
};

const getDailyEffectiveById = async (id: number) => {
  return await dailyEffectiveRepository.findOne({
    where: {
      id_efectivo_diario: id,
    },
  });
};

const updateDailyEffective = async (
  dailyEffective: IEfectivoDiario,
  newData: any
) => {
  const updatedDailyEffective = { ...dailyEffective, ...newData };
  const newDailyEffective = await dailyEffectiveRepository.save(
    updatedDailyEffective
  );
  return newDailyEffective;
};

export const DailyEffectiveRepository = {
  findAll,
  registerDailyEffective,
  getDailyEffectiveById,
  updateDailyEffective,
};
