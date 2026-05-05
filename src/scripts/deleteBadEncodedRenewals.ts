import mongoose, { Types } from "mongoose";
import dayjs from "dayjs";
import connectToMongoDB from "../config/mongoConnection";
import { FlujoFinancieroModel } from "../entities/implements/FlujoFinancieroSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";

// Cambia este texto si necesitas borrar otra variante exacta del concepto.
// Se busca como texto literal dentro de "concepto", no como regex.
const BORRAR_CONCEPTO_CON = "RenovaciÃ³n";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const conceptContainsFilter = {
  $regex: escapeRegex(BORRAR_CONCEPTO_CON),
  $options: "i",
};

type CleanupOptions = {
  dryRun?: boolean;
  inactiveDate?: Date;
};

export const cleanupBadEncodedRenewals = async (options: CleanupOptions = {}) => {
  const dryRun = options.dryRun !== false;
  const inactiveDate = options.inactiveDate || dayjs().subtract(365, "day").startOf("day").toDate();

  const badRenewals = await FlujoFinancieroModel.find({
    concepto: conceptContainsFilter,
  })
    .select("_id id_vendedor monto esDeuda concepto")
    .lean();

  const sellerIds = Array.from(
    new Set(
      badRenewals
        .map((flux: any) => String(flux.id_vendedor || ""))
        .filter((id) => Types.ObjectId.isValid(id))
    )
  );

  const debtToRemoveBySeller = new Map<string, number>();
  for (const flux of badRenewals as any[]) {
    if (!flux.esDeuda) continue;
    const sellerId = String(flux.id_vendedor || "");
    if (!Types.ObjectId.isValid(sellerId)) continue;
    debtToRemoveBySeller.set(
      sellerId,
      (debtToRemoveBySeller.get(sellerId) || 0) + Number(flux.monto || 0)
    );
  }

  const summary = {
    dryRun,
    matchedRenewals: badRenewals.length,
    matchedSellers: sellerIds.length,
    inactiveDate,
    deletedRenewals: 0,
    updatedSellers: 0,
    debtAdjustments: Array.from(debtToRemoveBySeller.entries()).map(([sellerId, amount]) => ({
      sellerId,
      amount,
    })),
  };

  if (dryRun || !badRenewals.length) {
    return summary;
  }

  const deleteResult = await FlujoFinancieroModel.deleteMany({
    concepto: conceptContainsFilter,
  });
  summary.deletedRenewals = deleteResult.deletedCount || 0;

  for (const sellerId of sellerIds) {
    const debtToRemove = debtToRemoveBySeller.get(sellerId) || 0;
    const seller = await VendedorModel.findById(sellerId).select("deuda").lean();
    const nextDebt = Math.max(0, Number((seller as any)?.deuda || 0) - debtToRemove);

    await VendedorModel.updateOne(
      { _id: new Types.ObjectId(sellerId) },
      {
        $set: {
          fecha_vigencia: inactiveDate,
          deuda: nextDebt,
        },
        $unset: {
          declinacion_servicio_fecha: "",
          declinacion_servicio_fecha_limite_retiro: "",
        },
      }
    );
    summary.updatedSellers += 1;
  }

  return summary;
};

const run = async () => {
  try {
    await connectToMongoDB();
    const execute = String(process.env.CONFIRM_DELETE_BAD_RENEWALS || "").toLowerCase() === "true";
    const result = await cleanupBadEncodedRenewals({ dryRun: !execute });
    console.log("[delete-bad-encoded-renewals]", result);

    if (!execute) {
      console.log(
        "[delete-bad-encoded-renewals] Dry run only. Re-run with CONFIRM_DELETE_BAD_RENEWALS=true to delete and update sellers."
      );
    }
  } catch (error) {
    console.error("[delete-bad-encoded-renewals] failed", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

if (require.main === module) {
  void run();
}
