import { Request, Response, Router } from "express";

const productRouter = Router();
productRouter.get('/', (req: Request, res: Response) => {
    res.send("GET Product")
})

productRouter.post('/register', (req: Request, res: Response) => {
    res.send("POST Product")
})

export default productRouter;