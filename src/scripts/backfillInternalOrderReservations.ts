import mongoose from "mongoose";
import connectToMongoDB from "../config/mongoConnection";
import { InternalOrderReservationService } from "../services/internalOrderReservation.service";

const run = async () => {
  try {
    await connectToMongoDB();
    const result = await InternalOrderReservationService.backfillActiveOrderReservations();
    console.log(`[internal-order-reservations] ordersProcessed=${result.ordersProcessed}`);
  } catch (error) {
    console.error("[internal-order-reservations] failed", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

void run();
