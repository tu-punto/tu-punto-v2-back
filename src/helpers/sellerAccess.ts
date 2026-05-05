import dayjs from "dayjs";
import { UserModel } from "../entities/implements/UserSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";

export type SellerLifecycleStatus = "activo" | "debe_renovar" | "ya_no_es_cliente" | "declinando_servicio";

export const SELLER_SYSTEM_ACCESS_DENIED_MESSAGE =
  "Tu acceso no esta habilitado. Contacta a administracion.";

export const getSellerLifecycleStatus = (
  fechaVigencia: unknown,
  fechaDeclinacion?: unknown
): SellerLifecycleStatus => {
  if (!fechaVigencia) return "ya_no_es_cliente";
  if (
    typeof fechaVigencia !== "string" &&
    typeof fechaVigencia !== "number" &&
    !(fechaVigencia instanceof Date) &&
    !dayjs.isDayjs(fechaVigencia)
  ) {
    return "ya_no_es_cliente";
  }

  const today = dayjs().startOf("day");
  const vigencia = dayjs(fechaVigencia).endOf("day");
  if (!vigencia.isValid()) return "ya_no_es_cliente";

  const hasValidDeclinationInput =
    typeof fechaDeclinacion === "string" ||
    typeof fechaDeclinacion === "number" ||
    fechaDeclinacion instanceof Date ||
    dayjs.isDayjs(fechaDeclinacion);

  if (hasValidDeclinationInput) {
    const declinacion = dayjs(fechaDeclinacion);
    const retiroHasta = vigencia.add(5, "day").endOf("day");
    if (declinacion.isValid() && !today.isAfter(retiroHasta)) {
      return "declinando_servicio";
    }
    if (declinacion.isValid() && today.isAfter(retiroHasta)) {
      return "ya_no_es_cliente";
    }
  }

  const diasVencido = today.diff(vigencia, "day");
  if (diasVencido <= 0) return "activo";
  if (diasVencido <= 20) return "debe_renovar";
  return "ya_no_es_cliente";
};

export const sellerHasSystemAccess = (fechaVigencia: unknown): boolean =>
  getSellerLifecycleStatus(fechaVigencia) !== "ya_no_es_cliente";

type SellerAuthUser = {
  role?: unknown;
  vendedor?: unknown;
  email?: unknown;
};

export const resolveSellerByUserData = async (
  user: SellerAuthUser | null | undefined
) => {
  if (!user || String(user.role || "").toLowerCase() !== "seller") {
    return null;
  }

  if (user.vendedor) {
    const sellerById = await VendedorModel.findById(user.vendedor)
      .select("_id nombre apellido mail fecha_vigencia")
      .lean();
    if (sellerById?._id) {
      return sellerById;
    }
  }

  if (user.email) {
    const sellerByEmail = await VendedorModel.findOne({ mail: user.email })
      .select("_id nombre apellido mail fecha_vigencia")
      .lean();
    if (sellerByEmail?._id) {
      return sellerByEmail;
    }
  }

  return null;
};

export const resolveSellerByUserId = async (userId: string) => {
  const user = await UserModel.findById(userId).select("role vendedor email").lean();
  if (!user) {
    return null;
  }

  return resolveSellerByUserData(user);
};
