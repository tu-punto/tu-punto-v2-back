import jwt, { JwtPayload } from "jsonwebtoken";
import { getJwtSecret } from "../config/secrets";

const JWT_SECRET = getJwtSecret();
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);

const generateToken = (id: string, role: string, sucursalId?: string) => {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * SESSION_TTL_HOURS,
    id: id,
    role,
    sucursalId, 
  };

  return jwt.sign(payload, JWT_SECRET);
};

const verifyToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

export { generateToken, verifyToken };
