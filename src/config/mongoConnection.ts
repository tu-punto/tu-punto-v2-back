
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_DB_URL || "mongodb://localhost:27017/tupuntoDB";

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log("Conectado a MongoDB correctamente");
  } catch (error) {
    console.error("Error al conectar a MongoDB:", error);
    process.exit(1);
  }
};

export default connectToMongoDB;

