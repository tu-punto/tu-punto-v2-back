import { CounterModel } from "../entities/implements/CounterSchema";

const GUIDE_COUNTER_KEY = "order_guide";
const GUIDE_NUMBER_LIMIT = 99999;

const resolveBranchId = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value?._id || value?.id_sucursal || value?.$oid || "");
};

const indexToLetters = (index: number): string => {
  let current = Math.max(0, index);
  let letters = "";

  do {
    letters = String.fromCharCode(65 + (current % 26)) + letters;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return letters.padStart(2, "A");
};

const buildGuideCode = (sequence: number, binarySuffix: 0 | 1): string => {
  const safeSequence = Math.max(1, Math.floor(sequence));
  const letterIndex = Math.floor((safeSequence - 1) / GUIDE_NUMBER_LIMIT);
  const numericPart = ((safeSequence - 1) % GUIDE_NUMBER_LIMIT) + 1;

  return `${indexToLetters(letterIndex)}-${String(numericPart).padStart(5, "0")}-${binarySuffix}`;
};

const resolveGuideBinarySuffix = (order: any): 0 | 1 => {
  const originBranchId = resolveBranchId(
    order?.lugar_origen ?? order?.origen_sucursal ?? order?.sucursal
  );
  const destinationBranchId = resolveBranchId(
    order?.destino_sucursal ?? order?.sucursal ?? order?.lugar_origen ?? order?.origen_sucursal
  );

  if (!originBranchId || !destinationBranchId) return 0;
  return String(originBranchId) === String(destinationBranchId) ? 0 : 1;
};

const getNextGuideSequence = async (): Promise<number> => {
  const counter = await CounterModel.findOneAndUpdate(
    { key: GUIDE_COUNTER_KEY },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return Number(counter?.value || 1);
};

const assignOrderGuide = async <T>(order: T & any): Promise<T> => {
  if (order.numero_guia) return order;

  const sequence = await getNextGuideSequence();
  const binarySuffix = resolveGuideBinarySuffix(order);
  const guideCode = buildGuideCode(sequence, binarySuffix);

  order.guia_sequence = sequence;
  order.numero_guia = guideCode;

  return order;
};

const buildMissingGuideUpdate = async (order: any) => {
  const sequence = await getNextGuideSequence();
  const binarySuffix = resolveGuideBinarySuffix(order);

  return {
    guia_sequence: sequence,
    numero_guia: buildGuideCode(sequence, binarySuffix),
  };
};

export const OrderGuideService = {
  assignOrderGuide,
  buildGuideCode,
  buildMissingGuideUpdate,
  resolveGuideBinarySuffix,
};
