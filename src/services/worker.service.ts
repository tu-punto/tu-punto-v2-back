import { WorkerRepository } from "../repositories/worker.repository";

const getAllWorkers = async () => {
    return await WorkerRepository.findAll();
};

const registerWorker = async (worker:any) => {
    return await WorkerRepository.registerWorker(worker);
}
export const WorkerService = {
    getAllWorkers,
    registerWorker
}