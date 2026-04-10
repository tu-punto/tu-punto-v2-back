import { Router } from "express";
import {
  deleteSimplePackageByID,
  getSimplePackagesList,
  getUploadedSimplePackageSellers,
  registerSimplePackages,
  updateSimplePackageByID,
} from "../controllers/simplePackage.controller";

const simplePackageRouter = Router();

simplePackageRouter.get("/list", getSimplePackagesList);
simplePackageRouter.get("/uploaded-sellers", getUploadedSimplePackageSellers);
simplePackageRouter.post("/register", registerSimplePackages);
simplePackageRouter.put("/:id", updateSimplePackageByID);
simplePackageRouter.delete("/:id", deleteSimplePackageByID);

export default simplePackageRouter;
