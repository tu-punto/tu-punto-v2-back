import { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "crypto";

const safeTokenMatches = (provided: string, expected: string) => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

export const requireCatalogIntegrationToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const expectedToken = String(process.env.CATALOG_INTEGRATION_TOKEN || "").trim();
  const providedToken = String(req.header("x-catalog-integration-token") || "").trim();

  if (!expectedToken) {
    return next();
  }

  if (!providedToken || !safeTokenMatches(providedToken, expectedToken)) {
    return res.status(401).json({
      success: false,
      message: "Token de integracion invalido"
    });
  }

  next();
};
