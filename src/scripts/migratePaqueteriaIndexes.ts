import "dotenv/config";
import mongoose from "mongoose";

// Dry-run by default. Run with --apply only against the intended database.
async function main() {
  const uri = process.env.MONGO_DB_URL;
  if (!uri) throw new Error("MONGO_DB_URL no está configurada");
  const apply = process.argv.includes("--apply");
  await mongoose.connect(uri, { autoIndex: false });
  const collection = mongoose.connection.collection("Paqueteria");
  const indexes = await collection.indexes();
  const index = indexes.find((item) => item.key?.codigo_guia === 1 && Object.keys(item.key).length === 1);
  const slugIndex = indexes.find((item) => item.key?.slug === 1 && Object.keys(item.key).length === 1);
  const nullCodes = await collection.countDocuments({ codigo_guia: null });
  const emptySlugs = await collection.countDocuments({ slug: { $in: ["", null] } });
  const duplicates = await collection.aggregate([
    { $match: { codigo_guia: { $type: "number" } } },
    { $group: { _id: "$codigo_guia", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  const duplicateSlugs = await collection.aggregate([
    { $match: { slug: { $type: "string", $ne: "" } } },
    { $group: { _id: "$slug", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  console.log({ database: mongoose.connection.name, apply, guideIndex: index, slugIndex, nullCodes, emptySlugs, duplicateGuideCodes: duplicates, duplicateSlugs });
  if (!apply) return;
  if (duplicates.length) throw new Error("Hay códigos de guía duplicados; no se modificó el índice");
  if (duplicateSlugs.length) throw new Error("Hay enlaces duplicados; no se modificó el índice");
  await collection.updateMany({ codigo_guia: null }, { $unset: { codigo_guia: "" } });
  await collection.updateMany({ slug: { $in: ["", null] } }, { $unset: { slug: "" } });
  if (index && (!index.unique || !index.sparse)) {
    if (!index.name) throw new Error("No se pudo identificar el índice anterior");
    await collection.dropIndex(index.name);
  }
  await collection.createIndex({ codigo_guia: 1 }, { unique: true, sparse: true });
  if (slugIndex && (!slugIndex.unique || !slugIndex.sparse)) {
    if (!slugIndex.name) throw new Error("No se pudo identificar el índice de enlaces anterior");
    await collection.dropIndex(slugIndex.name);
  }
  await collection.createIndex({ slug: 1 }, { unique: true, sparse: true });
  console.log("Índices de paqueterías actualizados");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
