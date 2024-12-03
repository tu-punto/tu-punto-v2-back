import AppDataSource from "../config/dataSource";
import { ICategoria } from "../entities/ICategoria";
import { ICierreCaja } from "../entities/ICierreCaja";
import { IEfectivoDiario } from "../entities/IEfectivoDiario";
import { CierreCajaEntity } from "../entities/implements/CierreCajaEntity";
import { EfectivoDiarioEntity } from "../entities/implements/EfectivoDiarioEntity";
import { Categoria } from "../models/Categoria";

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

export const DailyEffectiveRepository = {
  findAll,
  registerDailyEffective,
  getDailyEffectiveById,
};
