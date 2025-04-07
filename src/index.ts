import express, { Express } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectToMongoDB from "./config/mongoConnection"; 
import routes from "./routes";

dotenv.config();

const app: Express = express();
const port = process.env.SERVER_PORT || 3000;
const client_url = process.env.CLIENT_URL || "http://localhost:5173";
const client_url2 = process.env.CLIENT_URL_2 || "http://localhost:5173";

connectToMongoDB().then(() => {
  app.use(
    cors({
      origin: [client_url, client_url2],
      credentials: true,
      exposedHeaders: ["Set-Cookie"]
    })
  );

  app.use(express.json());
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));
  app.use(routes);

  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
});

