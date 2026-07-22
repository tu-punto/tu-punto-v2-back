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
import { rateLimiters } from "../middlewares/rateLimit.middleware";
import { validateRequest } from "../middlewares/validate.middleware";
import {
  validateChangePasswordBody,
  validateLoginBody,
  validateRegisterUserBody,
  validateResetSellerPasswordBody,
  validateResetSellerPasswordParams,
  validateResetUserPasswordParams,
  validateUpdateUserBody,
  validateUpdateUserParams,
} from "../validation/user.validation";

const userRouter = Router();

console.log("[routes] user.routes loaded");

userRouter.post(
  "/register",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateRequest({ body: (input) => validateRegisterUserBody(input) }),
  registerUserController
);
userRouter.post("/login", rateLimiters.login, validateRequest({ body: validateLoginBody }), loginUserController);
userRouter.get("/info", requireAuth, getUserInfoController);
userRouter.post("/logout", requireAuth, logoutUserController);
console.log("[routes] registering POST /user/change-password");
userRouter.post(
  "/change-password",
  requireAuth,
  validateRequest({ body: validateChangePasswordBody }),
  changePasswordController
);

userRouter.get("/", requireAuth, requireRole("admin"), getAllUsersController);
userRouter.get("/admins", requireAuth, requireRole("admin", "operator"), getAdminsController);

userRouter.put(
  "/:id",
  requireAuth,
  requireRole("admin", "superadmin"),
  validateRequest({ params: validateUpdateUserParams, body: (input, _req, res) => validateUpdateUserBody(input, res) }),
  updateUserController
);
userRouter.post(
  "/sellers/:sellerId/reset-password",
  requireAuth,
  requireRole("superadmin"),
  validateRequest({ params: validateResetSellerPasswordParams, body: validateResetSellerPasswordBody }),
  resetSellerPasswordController
);
userRouter.post(
  "/:id/reset-password-to-carnet",
  requireAuth,
  requireRole("admin"),
  validateRequest({ params: validateResetUserPasswordParams }),
  resetUserPasswordToCarnetController
);
userRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validateRequest({ params: validateUpdateUserParams }),
  deleteUserController
);


export default userRouter;
