type DeliveredRecord = {
  estado_pedido?: unknown;
  delivered?: unknown;
  hora_entrega_real?: unknown;
  fecha_pedido?: unknown;
};

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

const toDateOrNull = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const assertEditableIfNotDeliveredOlderThanFiveDays = (record: DeliveredRecord) => {
  const isDelivered =
    String(record.estado_pedido || "").trim().toLowerCase() === "entregado" || record.delivered === true;
  if (!isDelivered) return;

  const deliveredAt = toDateOrNull(record.hora_entrega_real) || toDateOrNull(record.fecha_pedido);
  if (!deliveredAt) return;

  if (Date.now() - deliveredAt.getTime() >= FIVE_DAYS_MS) {
    throw new Error("No se puede editar una entrega que tiene mas de 5 dias como entregada");
  }
};
