import connectToMongoDB from "../config/mongoConnection";
import mongoose from "mongoose";
import { ProductVariantKeyService } from "../services/productVariantKey.service";

const run = async () => {
  try {
    await connectToMongoDB();
    const result = await ProductVariantKeyService.migrateVariantKeysForAllProducts();
    console.log(
      `[variant-key-migration] processed=${result.processed} updated=${result.updated}`
    );
  } catch (error) {
    console.error("[variant-key-migration] failed", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

void run();

