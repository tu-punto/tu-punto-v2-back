import { Router } from "express";
import {
  getUserInfoController,
  loginUserController,
  logoutUserController,
  registerUserController,
} from "../controllers/user.controller";

const userRouter = Router();
userRouter.post("/register", registerUserController);
userRouter.post("/login", loginUserController);
userRouter.get("/info", getUserInfoController);
userRouter.post("/logout", logoutUserController);

export default userRouter;
