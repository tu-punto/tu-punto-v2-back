import { Request, Response } from "express";
import { WorkerService } from "../services/worker.service";


export const getWorker = async (req: Request, res:Response) =>{
    try {
        const workers = await WorkerService.getAllWorkers();
        res.json(workers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener todos los trabajadores' });
    }
}

export const registerWorker = async (req: Request, res:Response) =>{
    const worker = req.body;
    try{
        const newWorker = await WorkerService.registerWorker(worker)
        res.json({
            status: true,
            newWorker
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear un trabajador' });
    }
}