import { Router } from "express";
import {
  deleteSimplePackageByID,
  getSimplePackageBranchPrices,
  getSimplePackagesList,
  getSellerAccountingSimplePackages,
  getUploadedSimplePackageSellers,
  registerSimplePackages,
  upsertSimplePackageBranchPrice,
  updateSimplePackageByID,
} from "../controllers/simplePackage.controller";

const simplePackageRouter = Router();

simplePackageRouter.get("/list", getSimplePackagesList);
simplePackageRouter.get("/uploaded-sellers", getUploadedSimplePackageSellers);
simplePackageRouter.get("/seller-accounting", getSellerAccountingSimplePackages);
simplePackageRouter.get("/branch-prices", getSimplePackageBranchPrices);
simplePackageRouter.post("/register", registerSimplePackages);
simplePackageRouter.post("/branch-prices", upsertSimplePackageBranchPrice);
simplePackageRouter.put("/:id", updateSimplePackageByID);
simplePackageRouter.delete("/:id", deleteSimplePackageByID);

export default simplePackageRouter;
