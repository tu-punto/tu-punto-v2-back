import { NextFunction, Request, Response } from "express";
import { RequestValidationError } from "../validation/requestValidation";

type ValidationTarget = "body" | "query" | "params";
type ValidationResult = Record<string, unknown>;
type Validator = (input: unknown, req: Request, res: Response) => ValidationResult;

type Validators = Partial<Record<ValidationTarget, Validator>>;

export const validateRequest = (validators: Validators) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (validators.params) {
        req.params = validators.params(req.params, req, res) as Request["params"];
      }

      if (validators.query) {
        (req as any).query = validators.query(req.query, req, res);
      }

      if (validators.body) {
        req.body = validators.body(req.body, req, res);
      }

      next();
    } catch (error: any) {
      if (error instanceof RequestValidationError) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          details: error.details,
        });
      }

      return res.status(400).json({
        success: false,
        message: error?.message || "Solicitud invalida",
      });
    }
  };
};
