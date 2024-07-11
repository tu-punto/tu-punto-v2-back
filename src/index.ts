import express, { Express, Request, Response } from "express";
import dotenv from 'dotenv'
import sellerRouter from "./routes/seller.routes";

dotenv.config();

const app: Express = express();
const port = process.env.SERVER_PORT;

app.use('',sellerRouter)

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
}); 