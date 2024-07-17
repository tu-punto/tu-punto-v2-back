import express, { Express, Request, Response } from "express";
import dotenv from 'dotenv'
import cors from 'cors'
import sellerRouter from "./routes/seller.routes";
import productRouter from "./routes/products.routes";
import AppDataSource from "./config/dataSource";
import featureRouter from "./routes/feature.routes";

dotenv.config();

AppDataSource.initialize().then(() => {
  const app: Express = express();
  const port = process.env.SERVER_PORT;

  app.use(express.json())
  app.use(cors())
 
  app.use('/seller',sellerRouter)
  app.use('/product',productRouter)
  app.use('/feature',featureRouter)

  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  }); 
})
