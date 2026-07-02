const deploymentEnv = String(process.env.APP_ENV || process.env.DEPLOY_ENV || process.env.NODE_ENV || "").trim().toLowerCase();
const isProduction = deploymentEnv === "production";
const isStaging = deploymentEnv === "staging" || deploymentEnv === "stage" || process.env.STAGING === "true";
const DEV_JWT_SECRET = "dev-only-jwt-secret-change-me";

const isWeakSecret = (value: string) =>
  value.length < 32 ||
  ["LKDSJF", "fskdjnlfkasd", "replace-with-a-long-random-token", DEV_JWT_SECRET].includes(value);

export const getJwtSecret = () => {
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();

  if (!jwtSecret) {
    if (isProduction && !isStaging) {
      throw new Error("JWT_SECRET es obligatorio en produccion");
    }
    console.warn("[security] JWT_SECRET no configurado; usando secreto local de desarrollo.");
    return DEV_JWT_SECRET;
  }

  if (isProduction && !isStaging && isWeakSecret(jwtSecret)) {
    throw new Error("JWT_SECRET es demasiado debil para produccion");
  }

  return jwtSecret;
};

const requireProductionSecret = (name: string) => {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} es obligatorio en produccion`);
  }
  if (isWeakSecret(value)) {
    throw new Error(`${name} tiene un valor inseguro en produccion`);
  }
};

export const validateProductionSecrets = () => {
  if (!isProduction || isStaging) return;

  requireProductionSecret("JWT_SECRET");
};
