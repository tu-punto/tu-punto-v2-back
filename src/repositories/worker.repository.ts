import { ITrabajador } from "../entities/ITrabajador";
import { TrabajadorModel } from "../entities/implements/TrabajadorSchema";
import { ITrabajadorDocument } from "../entities/documents/ITrabajadorDocument";

const findAll = async (): Promise<ITrabajadorDocument[]> => {
  const workers = await TrabajadorModel.find(); 
  return workers; 
};
const registerWorker = async (worker: ITrabajador): Promise<ITrabajadorDocument> => {
  const newWorker = new TrabajadorModel(worker); 
  const savedWorker = await newWorker.save(); 
  return savedWorker; 
};

const getWorkerByFinanceFlux = async (workerId: string): Promise<ITrabajadorDocument | null> => {
  const worker = await TrabajadorModel.findOne({ _id: workerId }); // Buscar por _id
  return worker; 
};

export const WorkerRepository = {
  findAll,
  registerWorker,
  getWorkerByFinanceFlux
};
