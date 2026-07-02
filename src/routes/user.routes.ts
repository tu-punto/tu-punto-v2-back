import { Router } from "express";
import {
  registerUserController,
  loginUserController,
  getUserInfoController,
  logoutUserController,
  getAllUsersController,
  updateUserController,
  deleteUserController,
  getAdminsController,
  changePasswordController,
  resetUserPasswordToCarnetController,
  resetSellerPasswordController,
} from "../controllers/user.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const userRouter = Router();

console.log("[routes] user.routes loaded");

// Temporalmente abierto para permitir crear el primer usuario en un entorno sin cuentas.
// Volver a proteger con requireAuth + requireRole("superadmin") despues del alta inicial.
userRouter.post("/register", registerUserController);
userRouter.post("/login", loginUserController);
userRouter.get("/info", requireAuth, getUserInfoController);
userRouter.post("/logout", requireAuth, logoutUserController);
console.log("[routes] registering POST /user/change-password");
userRouter.post("/change-password", requireAuth, changePasswordController);

userRouter.get("/", requireAuth, requireRole("admin"), getAllUsersController);
userRouter.get("/admins", requireAuth, requireRole("admin", "operator"), getAdminsController);

userRouter.put("/:id", requireAuth, requireRole("admin"), updateUserController);
userRouter.post("/sellers/:sellerId/reset-password", requireAuth, requireRole("superadmin"), resetSellerPasswordController);
userRouter.post("/:id/reset-password-to-carnet", requireAuth, requireRole("admin"), resetUserPasswordToCarnetController);
userRouter.delete("/:id", requireAuth, requireRole("admin"), deleteUserController);


export default userRouter;
