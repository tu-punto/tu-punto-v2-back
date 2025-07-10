import { Router } from "express";
import {
  registerUserController,
  loginUserController,
  getUserInfoController,
  logoutUserController,
  getAllUsersController,
  updateUserController,
  deleteUserController,
} from "../controllers/user.controller";

const userRouter = Router();

userRouter.post("/register", registerUserController);
userRouter.post("/login", loginUserController);
userRouter.get("/info", getUserInfoController);
userRouter.post("/logout", logoutUserController);

userRouter.get("/", getAllUsersController);
userRouter.put("/:id", updateUserController);
userRouter.delete("/:id", deleteUserController);


export default userRouter;