import express, { Express, Request, Response } from "express";
import dotenv from 'dotenv'
import sellerRouter from "./routes/seller.routes";
import productRouter from "./routes/products.routes";
import AppDataSource from "./config/dataSource";
import { json } from "stream/consumers";

dotenv.config();

AppDataSource.initialize().then(() => {
  const app: Express = express();
  const port = process.env.SERVER_PORT;

  app.use(express.json())
 
  app.use('/seller',sellerRouter)
  app.use('/product',productRouter)

  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  }); 
})
