import { Trabajador } from './../models/Trabajador';
import AppDataSource from "../config/dataSource";
import { TrabajadorEntity } from "../entities/implements/TrabajadorEntity";
import { ITrabajador } from '../entities/ITrabajador';

const workerRepository = AppDataSource.getRepository(TrabajadorEntity);

const findAll = async (): Promise<Trabajador[]> => {
    return await workerRepository.find();
}

const registerWorker = async (worker: ITrabajador): Promise<Trabajador> => {
    const newWorker = workerRepository.create(worker);
    const saveWorker = await workerRepository.save(newWorker);
    return new Trabajador(saveWorker);
} 
export const getWorkerByFinanceFlux = async (workerId: number): Promise<TrabajadorEntity | null> => {
    const worker = await workerRepository.findOne({
        where: { id_trabajador: workerId }
    });
    return worker;
};

export const WorkerRepository = {
    findAll,
    registerWorker,
    getWorkerByFinanceFlux
}