import { Request, Response, Router } from "express";

const sellerRouter = Router();
sellerRouter.get('/', (req: Request, res: Response) => {
    res.send("GET Sellers")
})

sellerRouter.post('/register', (req: Request, res: Response) => {
    res.send("POST Sellers")
})

export default sellerRouter;