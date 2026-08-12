import { Types } from "mongoose";
import {
  USER_TOUR_KEYS,
  UserTourKey,
  UserTourProgressModel,
  UserTourStatus,
} from "../entities/implements/UserTourProgressSchema";

const KNOWN_TOUR_KEYS = new Set<string>(USER_TOUR_KEYS);

const normalizeTourKey = (tourKey?: unknown): UserTourKey | "" => {
  const value = String(tourKey || "").trim();
  return KNOWN_TOUR_KEYS.has(value) ? (value as UserTourKey) : "";
};

const assertValidUserId = (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Usuario invalido");
  }
};

const getMyTourProgress = async (userId: string) => {
  assertValidUserId(userId);

  const rows = await UserTourProgressModel.find({
    user: new Types.ObjectId(userId),
    tourKey: { $in: USER_TOUR_KEYS },
  })
    .select("tourKey status completedAt updatedAt")
    .lean();

  const progress: Record<string, { status: UserTourStatus; completedAt?: Date | null; updatedAt?: Date }> = {};

  USER_TOUR_KEYS.forEach((tourKey) => {
    progress[tourKey] = {
      status: "unseen",
      completedAt: null,
    };
  });

  rows.forEach((row: any) => {
    const tourKey = normalizeTourKey(row?.tourKey);
    if (!tourKey) return;
    progress[tourKey] = {
      status: row?.status === "seen" ? "seen" : "unseen",
      completedAt: row?.completedAt || null,
      updatedAt: row?.updatedAt || undefined,
    };
  });

  return progress;
};

const markTourAsCompleted = async (userId: string, tourKey: unknown) => {
  assertValidUserId(userId);

  const normalizedTourKey = normalizeTourKey(tourKey);
  if (!normalizedTourKey) {
    throw new Error("Tour invalido");
  }

  const now = new Date();

  const row = await UserTourProgressModel.findOneAndUpdate(
    {
      user: new Types.ObjectId(userId),
      tourKey: normalizedTourKey,
    },
    {
      $set: {
        status: "seen",
        completedAt: now,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return {
    tourKey: normalizedTourKey,
    status: "seen" as UserTourStatus,
    completedAt: row?.completedAt || now,
  };
};

export const UserTourProgressService = {
  getMyTourProgress,
  markTourAsCompleted,
  normalizeTourKey,
  knownTourKeys: USER_TOUR_KEYS,
};
