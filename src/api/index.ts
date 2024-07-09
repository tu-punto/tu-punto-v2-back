import express, { Express, Request, Response } from "express";
import dotenv from 'dotenv'

dotenv.config();

const app: Express = express();
const port = process.env.SERVER_PORT;

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript on Vercel Server");
});

app.get('/meencargo', (req: Request, res: Response) => {
  res.send("Bienvenido a Me Encargo")
})

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});