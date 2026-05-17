import { Types } from "mongoose";
import {
  IPackageDeliverySpace,
  IPackageEscalationRange,
  PackageEscalationServiceOrigin,
} from "../entities/IPackageEscalationConfig";
import { PackageEscalationConfigRepository } from "../repositories/packageEscalationConfig.repository";
import { SimplePackageRepository } from "../repositories/simplePackage.repository";

const DEFAULT_RANGES: Record<PackageEscalationServiceOrigin, IPackageEscalationRange[]> = {
  external: [
    { from: 1, to: 5, small_price: 5, large_price: 10 },
    { from: 6, to: 15, small_price: 4, large_price: 8 },
    { from: 16, to: null, small_price: 3, large_price: 6 },
  ],
  simple_package: [
    { from: 1, to: 30, small_price: 4, large_price: 8 },
    { from: 31, to: 60, small_price: 3, large_price: 6 },
    { from: 61, to: null, small_price: 2.5, large_price: 5 },
  ],
  delivery: [
    { from: 1, to: 5, small_price: 5, large_price: 5 },
    { from: 6, to: 15, small_price: 4, large_price: 4 },
    { from: 16, to: null, small_price: 3, large_price: 3 },
  ],
};

const DEFAULT_DELIVERY_SPACES: IPackageDeliverySpace[] = [
  { size: "small_limit", spaces: 1 },
];

const normalizeServiceOrigin = (value: unknown): PackageEscalationServiceOrigin => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "delivery") return "delivery";
  return normalized === "simple" || normalized === "simple_package" ? "simple_package" : "external";
};

const roundCurrency = (value: number) => +Number(value || 0).toFixed(2);

const normalizeRanges = (
  ranges: any[],
  serviceOrigin: PackageEscalationServiceOrigin
): IPackageEscalationRange[] => {
  const fallback = DEFAULT_RANGES[serviceOrigin];
  const source = Array.isArray(ranges) && ranges.length ? ranges : fallback;

  return source.slice(0, 3).map((row, index) => {
    const fallbackRow = fallback[index] || fallback[fallback.length - 1];
    const from = Math.max(1, Number(row?.from ?? fallbackRow.from));
    const rawTo = row?.to ?? fallbackRow.to ?? null;
    const to = rawTo === null || rawTo === "" || rawTo === undefined ? null : Math.max(from, Number(rawTo));

    return {
      from,
      to,
      small_price: roundCurrency(Math.max(0, Number(row?.small_price ?? fallbackRow.small_price ?? 0))),
      large_price: roundCurrency(Math.max(0, Number(row?.large_price ?? fallbackRow.large_price ?? 0))),
    };
  });
};

const validateRanges = (ranges: IPackageEscalationRange[]) => {
  if (ranges.length !== 3) {
    throw new Error("Debe configurar exactamente 3 rangos");
  }

  ranges.forEach((range, index) => {
    if (!Number.isFinite(range.from) || range.from < 1) {
      throw new Error(`Rango ${index + 1}: desde debe ser mayor a 0`);
    }
    if (range.to !== null && range.to !== undefined && range.to < range.from) {
      throw new Error(`Rango ${index + 1}: hasta no puede ser menor que desde`);
    }
    if (range.small_price < 0 || range.large_price < 0) {
      throw new Error(`Rango ${index + 1}: los precios no pueden ser negativos`);
    }
  });
};

const normalizeDeliverySpaces = (rows: any[] | undefined): IPackageDeliverySpace[] => {
  const source = Array.isArray(rows) && rows.length ? rows : DEFAULT_DELIVERY_SPACES;
  const normalized = source
    .map((row) => ({
      size: String(row?.size || row?.tamano || "").trim().toLowerCase(),
      spaces: Math.max(1, Number(row?.spaces ?? row?.espacios ?? 1)),
    }))
    .filter((row) => row.size);

  return normalized.length ? normalized : DEFAULT_DELIVERY_SPACES;
};

const getSmallSpaceLimitFromRows = (rows: any[] | undefined) => {
  const normalized = normalizeDeliverySpaces(rows);
  return Math.max(
    1,
    Number(
      normalized.find((row) => row.size === "small_limit")?.spaces ??
        normalized.find((row) => row.size === "estandar")?.spaces ??
        1
    )
  );
};

const getSmallSpaceLimitForRoute = async (routeId?: string) => {
  const config = routeId
    ? await PackageEscalationConfigRepository.findByRouteAndOrigin(routeId, "delivery")
    : null;
  const globalConfig = await PackageEscalationConfigRepository.findGlobalByOrigin("delivery");
  return getSmallSpaceLimitFromRows((globalConfig as any)?.delivery_spaces || (config as any)?.delivery_spaces || []);
};

const resolvePackageSizeBySpaces = async (params: {
  routeId?: string;
  deliverySpaces?: number;
  fallbackSize?: string;
}) => {
  if (params.deliverySpaces === undefined || params.deliverySpaces === null) {
    return String(params.fallbackSize || "").toLowerCase() === "grande" ? "grande" : "estandar";
  }

  const limit = await getSmallSpaceLimitForRoute(params.routeId);
  return Math.max(1, Number(params.deliverySpaces || 1)) > limit ? "grande" : "estandar";
};

const getRangesForRoute = async (routeId: string | undefined, serviceOrigin: PackageEscalationServiceOrigin) => {
  const config = routeId
    ? await PackageEscalationConfigRepository.findByRouteAndOrigin(routeId, serviceOrigin)
    : null;
  return normalizeRanges((config as any)?.ranges || [], serviceOrigin);
};

const getUnitPriceForCount = (
  ranges: IPackageEscalationRange[],
  count: number,
  packageSize?: string
) => {
  const safeCount = Math.max(1, Number(count || 1));
  const range =
    ranges.find((row) => safeCount >= row.from && (row.to === null || row.to === undefined || safeCount <= row.to)) ||
    ranges[ranges.length - 1];

  return roundCurrency(String(packageSize || "").toLowerCase() === "grande" ? range.large_price : range.small_price);
};

const listConfigs = async (routeId?: string) => {
  const rows = await PackageEscalationConfigRepository.listConfigs(routeId);
  return rows;
};

const getConfigForRoute = async (routeId: string) => {
  if (!Types.ObjectId.isValid(routeId)) {
    throw new Error("Debe seleccionar una ruta valida");
  }

  const existingRows = await PackageEscalationConfigRepository.listConfigs(routeId);
  const byOrigin = new Map(existingRows.map((row: any) => [String(row.service_origin), row]));
  const globalDelivery = await PackageEscalationConfigRepository.findGlobalByOrigin("delivery");

  return {
    routeId,
    external: normalizeRanges((byOrigin.get("external") as any)?.ranges || [], "external"),
    simple_package: normalizeRanges((byOrigin.get("simple_package") as any)?.ranges || [], "simple_package"),
    delivery: normalizeRanges((byOrigin.get("delivery") as any)?.ranges || [], "delivery"),
    delivery_spaces: normalizeDeliverySpaces(
      (globalDelivery as any)?.delivery_spaces || (byOrigin.get("delivery") as any)?.delivery_spaces || []
    ),
  };
};

const upsertConfig = async (params: {
  routeId: string;
  serviceOrigin: unknown;
  ranges: any[];
  deliverySpaces?: any[];
}) => {
  const routeId = String(params.routeId || "").trim();
  const serviceOrigin = normalizeServiceOrigin(params.serviceOrigin);
  const ranges = normalizeRanges(params.ranges, serviceOrigin);
  validateRanges(ranges);
  if (serviceOrigin === "delivery" && !routeId) {
    return await PackageEscalationConfigRepository.upsertGlobalByOrigin({
      serviceOrigin,
      ranges,
      deliverySpaces: normalizeDeliverySpaces(params.deliverySpaces),
    });
  }
  if (!Types.ObjectId.isValid(routeId)) {
    throw new Error("Debe seleccionar una ruta valida");
  }

  return await PackageEscalationConfigRepository.upsertByRouteAndOrigin({
    routeId,
    serviceOrigin,
    ranges,
    deliverySpaces: serviceOrigin === "delivery" ? normalizeDeliverySpaces(params.deliverySpaces) : undefined,
  });
};

const getExternalUnitPrice = async (params: {
  routeId?: string;
  packageCount: number;
  packageSize?: string;
}) => {
  const ranges = await getRangesForRoute(params.routeId, "external");
  return getUnitPriceForCount(ranges, params.packageCount, params.packageSize);
};

const getSimpleUnitPrice = async (params: {
  routeId?: string;
  sellerId: string;
  packageIndexInBatch: number;
  packageSize?: string;
  fallbackSmallPrice?: number;
  fallbackLargePrice?: number;
}) => {
  const routeConfig = params.routeId
    ? await PackageEscalationConfigRepository.findByRouteAndOrigin(params.routeId, "simple_package")
    : null;
  if (!routeConfig) {
    const fallbackSmallPrice = roundCurrency(Number(params.fallbackSmallPrice || 0));
    const fallbackLargePrice = roundCurrency(Number(params.fallbackLargePrice || fallbackSmallPrice));
    if (fallbackSmallPrice > 0 || fallbackLargePrice > 0) {
      return String(params.packageSize || "").toLowerCase() === "grande"
        ? fallbackLargePrice
        : fallbackSmallPrice;
    }
  }

  const ranges = normalizeRanges((routeConfig as any)?.ranges || [], "simple_package");
  const monthCount = await SimplePackageRepository.countSimplePackagesForSellerInCurrentMonth(params.sellerId);
  return getUnitPriceForCount(ranges, monthCount + params.packageIndexInBatch + 1, params.packageSize);
};

const getDeliveryPricing = async (params: {
  routeId?: string;
  packageCount: number;
  packageSize?: string;
  deliverySpaces?: number;
  escalationSpaces?: number;
  fallbackRoutePrice?: number;
}) => {
  const routeId = String(params.routeId || "");
  const config = routeId
    ? await PackageEscalationConfigRepository.findByRouteAndOrigin(routeId, "delivery")
    : null;
  const hasConfig = Boolean(config);
  const ranges = normalizeRanges((config as any)?.ranges || [], "delivery");
  const spaces = Math.max(1, Number(params.deliverySpaces || 1));
  const escalationSpaces = Math.max(1, Number(params.escalationSpaces || spaces));

  if (!hasConfig && params.fallbackRoutePrice !== undefined) {
    const fallbackSpaces = params.deliverySpaces !== undefined ? spaces : 1;
    return {
      unitPrice: roundCurrency(Number(params.fallbackRoutePrice || 0)),
      spaces: fallbackSpaces,
      total: roundCurrency(Number(params.fallbackRoutePrice || 0) * fallbackSpaces),
    };
  }

  const unitPrice = getUnitPriceForCount(ranges, escalationSpaces, "estandar");
  return {
    unitPrice,
    spaces,
    total: roundCurrency(unitPrice * spaces),
  };
};

const getSimpleEscalationStatus = async (params: { routeId?: string; sellerId: string }) => {
  const ranges = await getRangesForRoute(params.routeId, "simple_package");
  const monthCount = await SimplePackageRepository.countSimplePackagesForSellerInCurrentMonth(params.sellerId);
  const currentPosition = monthCount + 1;
  const currentRange =
    ranges.find((row) => currentPosition >= row.from && (row.to === null || row.to === undefined || currentPosition <= row.to)) ||
    ranges[ranges.length - 1];
  const nextRange = ranges.find((row) => row.from > currentPosition);
  const missingForNextRange = nextRange ? Math.max(0, nextRange.from - currentPosition) : 0;

  return {
    monthCount,
    ranges,
    currentRange,
    missingForNextRange,
  };
};

export const PackageEscalationConfigService = {
  DEFAULT_RANGES,
  DEFAULT_DELIVERY_SPACES,
  normalizeServiceOrigin,
  getUnitPriceForCount,
  listConfigs,
  getConfigForRoute,
  upsertConfig,
  getExternalUnitPrice,
  getSimpleUnitPrice,
  getDeliveryPricing,
  getSmallSpaceLimitForRoute,
  resolvePackageSizeBySpaces,
  getSimpleEscalationStatus,
};
