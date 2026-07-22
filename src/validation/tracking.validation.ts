import {
  ensurePlainObject,
  parsePushSubscription,
  parseRequiredString,
  parseTrackingCode,
  rejectUnexpectedKeys,
} from "./requestValidation";

export const validateTrackingParams = (input: unknown) => {
  const payload = ensurePlainObject(input, "params");
  rejectUnexpectedKeys(payload, ["code"], "params");

  return {
    code: parseTrackingCode(payload.code),
  };
};

export const validatePushSubscriptionBody = (input: unknown) => {
  const payload = ensurePlainObject(input, "body");
  rejectUnexpectedKeys(payload, ["subscription"], "body");

  return {
    subscription: parsePushSubscription(payload.subscription),
  };
};

export const validateNotificationListQuery = (input: unknown) => {
  const payload = ensurePlainObject(input, "query");
  rejectUnexpectedKeys(payload, ["limit"], "query");

  const limitValue = payload.limit === undefined ? undefined : Number(payload.limit);
  if (limitValue !== undefined && (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100)) {
    throw new Error("limit es invalido");
  }

  return {
    ...(limitValue !== undefined ? { limit: String(limitValue) } : {}),
  };
};
