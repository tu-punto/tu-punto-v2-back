import { Router } from "express";
import { getWorker, registerWorker } from "../controllers/worker.controller";

const workerRouter = Router();

workerRouter.get('/', getWorker)

workerRouter.post('/register', registerWorker)


export default workerRouter;
