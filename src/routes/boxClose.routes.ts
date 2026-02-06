import { Router } from "express";
import {
  getBoxCloseByIdController,
  getBoxClosingsController,
  registerBoxCloseController,
  updateBoxCloseController,
} from "../controllers/boxClose.controller";

const boxCloseRouter = Router();

boxCloseRouter.get("/", getBoxClosingsController);

boxCloseRouter.post("/register", registerBoxCloseController);

boxCloseRouter.get("/:id", getBoxCloseByIdController);

boxCloseRouter.patch("/:id", updateBoxCloseController);

export default boxCloseRouter;
