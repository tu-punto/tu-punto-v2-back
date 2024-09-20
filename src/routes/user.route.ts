import { Router } from "express";
import { loginUserController, registerUserController } from "../controllers/user.controller";

const userRouter = Router();
userRouter.post("/register", registerUserController);
userRouter.post("/login", loginUserController);
userRouter.post("/logout");

export default userRouter;
