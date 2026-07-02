import bcrypt from "bcrypt";

const PASSWORD_MIN_LENGTH = 8;

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

export const comparePassword = (password: string, hashedPassword: string) => {
  return bcrypt.compare(password, hashedPassword);
};

export const validatePasswordStrength = (password: string) => {
  const errors: string[] = [];
  const value = String(password || "");

  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  }
  if (!/[a-z]/.test(value)) {
    errors.push("Debe incluir una letra minuscula");
  }
  if (!/[A-Z]/.test(value)) {
    errors.push("Debe incluir una letra mayuscula");
  }
  if (!/\d/.test(value)) {
    errors.push("Debe incluir un numero");
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push("Debe incluir un simbolo");
  }

  return errors;
};

export const assertPasswordStrength = (password: string) => {
  const errors = validatePasswordStrength(password);
  if (errors.length > 0) {
    const error: any = new Error(`La contrasena no cumple la politica: ${errors.join(", ")}`);
    error.status = 400;
    error.details = errors;
    throw error;
  }
};
