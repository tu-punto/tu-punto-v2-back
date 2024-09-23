import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "LKDSJF";

const generateToken = (userId: number, role: string) => {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expire set to 24 hours
    id: userId,
    role,
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
