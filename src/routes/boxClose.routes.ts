import { Router } from "express";
import {
  getBoxCloseByIdController,
  getBoxClosingsController,
  registerBoxCloseController,
} from "../controllers/boxClose.controller";

const boxCloseRouter = Router();

boxCloseRouter.get("/", getBoxClosingsController);

boxCloseRouter.post("/register", registerBoxCloseController);

boxCloseRouter.get("/:id", getBoxCloseByIdController);

export default boxCloseRouter;
