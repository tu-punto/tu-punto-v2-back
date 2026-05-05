import { Request, Response } from "express";
import { SellerService } from "../services/seller.service";
import { SellerPdfService } from "../services/sellerPdf.service";
import { UserModel } from "../entities/implements/UserSchema";
import { VendedorModel } from "../entities/implements/VendedorSchema";

const resolveSellerIdByAuthUser = async (userId: string): Promise<string | null> => {
  const user = await UserModel.findById(userId).select("role vendedor email").lean();
  if (!user || String(user.role).toLowerCase() !== "seller") {
    return null;
  }

  if (user.vendedor) {
    return String(user.vendedor);
  }

  if (user.email) {
    const seller = await VendedorModel.findOne({ mail: user.email }).select("_id").lean();
    if (seller?._id) {
      return String(seller._id);
    }
  }

  return null;
};

export const getSellers = async (req: Request, res: Response) => {
  try {
    const authRole = String(res.locals.auth?.role || "").toLowerCase();
    const authUserId = String(res.locals.auth?.id || "");
    const q = String(req.query.q || "").trim() || undefined;
    const statusQuery = String(req.query.status || "").trim().toLowerCase();
    const pendingPaymentQuery = String(req.query.pendingPayment || "").trim().toLowerCase();
    const status =
      statusQuery === "activo" ||
      statusQuery === "debe_renovar" ||
      statusQuery === "ya_no_es_cliente" ||
      statusQuery === "declinando_servicio"
        ? statusQuery
        : undefined;
    const pendingPayment =
      pendingPaymentQuery === "con_deuda" || pendingPaymentQuery === "sin_deuda"
        ? pendingPaymentQuery
        : undefined;

    if (authRole === "seller" && authUserId) {
      const sellerId = await resolveSellerIdByAuthUser(authUserId);
      if (!sellerId) {
        return res.json([]);
      }

      const sellerList = await SellerService.getAllSellers({
        sellerId,
        q,
        status,
        pendingPayment,
      });
      return res.json(sellerList);
    }

    const sellerList = await SellerService.getAllSellers({
      q,
      status,
      pendingPayment,
    });
    res.json(sellerList);
  } catch (err) {
    console.error("Error obteniendo vendedores:", err);
    res.status(500).json({ msg: "Error obteniendo vendedores", err });
  }
};

export const getSellersBasic = async (req: Request, res: Response) => {
  try {
    const authRole = String(res.locals.auth?.role || "").toLowerCase();
    const authUserId = String(res.locals.auth?.id || "");
    const sucursalId = (req.query.sucursalId as string | undefined) || undefined;
    const onlyProductInfoAccess =
      String(req.query.onlyProductInfoAccess || "").trim().toLowerCase() === "true";
    const onlySimplePackageAccess =
      String(req.query.onlySimplePackageAccess || "").trim().toLowerCase() === "true";
    const includeProductInfoStatus =
      String(req.query.includeProductInfoStatus || "").trim().toLowerCase() === "true";
    const onlyActiveOrRenewal =
      String(req.query.onlyActiveOrRenewal || "").trim().toLowerCase() === "true";

    if (authRole === "seller" && authUserId) {
      const sellerId = await resolveSellerIdByAuthUser(authUserId);
      if (!sellerId) {
        return res.json([]);
      }
      const sellerList = await SellerService.getAllSellersBasic({
        sellerId,
        sucursalId,
        onlyProductInfoAccess,
        onlySimplePackageAccess,
        includeProductInfoStatus,
        onlyActiveOrRenewal,
      });
      return res.json(sellerList);
    }

    const sellerList = await SellerService.getAllSellersBasic({
      sucursalId,
      onlyProductInfoAccess,
      onlySimplePackageAccess,
      includeProductInfoStatus,
      onlyActiveOrRenewal,
    });
    return res.json(sellerList);
  } catch (err) {
    console.error("Error obteniendo vendedores basicos:", err);
    return res.status(500).json({ msg: "Error obteniendo vendedores basicos", err });
  }
};

export const getSeller = async (req: Request, res: Response) => {
  try {
    const sellerIdParam = req.params.id;
    const seller = await SellerService.getSeller(sellerIdParam);

    if (!seller) {
      return res
        .status(404)
        .json({ msg: `No existe vendedor con id ${sellerIdParam}` });
    }
    res.json(seller);
  } catch (err) {
    console.error("Error obteniendo vendedor:", err);
    res.status(500).json({ msg: "Error obteniendo vendedor", err });
  }
};

export const registerSeller = async (req: Request, res: Response) => {
  try {
    const sellerPayload = req.body;
    const createdSeller = await SellerService.registerSeller(sellerPayload);
    res.json({ ok: true, createdSeller });
  } catch (err) {
    res.status(500).json({ msg: "Error registrando vendedor", err });
  }
};

export const updateSeller = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const updated = await SellerService.updateSeller(id, req.body); // sin flux
    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ msg: "Error actualizando vendedor", err });
  }
};

export const renewSeller = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const renewed = await SellerService.renewSeller(id, req.body); // con flux
    res.json({ ok: true, renewed });
  } catch (err: any) {
    console.error("Error renovando vendedor:", err);

    const status = err.status || 500;
    const msg = err.msg || "Error renovando vendedor";

    res.status(status).json({ ok: false, msg });
  }
};

export const paySellerDebt = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { payAll } = req.body;

  try {
    // Actualizar la deuda del vendedor
    const pdfBuffer = await SellerPdfService.generateSellerPdfBuffer(id);
    const updatedSeller = await SellerService.paySellerDebt(id, payAll);

    if (!updatedSeller) {
      return res.status(404).json({ msg: "Vendedor no encontrado" });
    }

    // Configurar la respuesta para enviar el PDF
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="seller_${updatedSeller._id}.pdf"`,
    });

    // Enviar el PDF al cliente
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ msg: "Error al pagar la deuda del vendedor", error });
  }
};

export const requestSellerPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await SellerService.requestSellerPayment(
      id,
      req.file as Express.Multer.File | undefined
    );

    res.json({
      ok: true,
      msg: "Solicitud de pago registrada correctamente",
      ...result,
    });
  } catch (error: any) {
    console.error("Error solicitando pago del vendedor:", error);
    res.status(error?.status || 500).json({
      ok: false,
      msg: error?.message || "Error solicitando pago del vendedor",
    });
  }
};

export const declineSellerService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const seller = await SellerService.declineSellerService(id);
    res.json({
      ok: true,
      msg: "Declinacion del servicio registrada correctamente",
      seller,
    });
  } catch (error: any) {
    console.error("Error registrando declinacion del servicio:", error);
    res.status(error?.status || 500).json({
      ok: false,
      msg: error?.message || "Error registrando declinacion del servicio",
    });
  }
};

export const getSellerDebts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const debts = await SellerService.getSellerDebts(id);
    res.json(debts);
  } catch (err) {
    res.status(500).json({ msg: "Error obteniendo deudas del vendedor", err });
  }
};

export const getServicesSummary = async (_: Request, res: Response) => {
  try {
    const resumen = await SellerService.getServicesSummary();
    res.json(resumen);
  } catch (err) {
    res.status(500).json({ msg: "Error generando resumen", err });
  }
};

export const getClientsStatusList = async (_: Request, res: Response) => {
  try {
    const rows = await SellerService.getClientsStatusList();
    res.json({ ok: true, rows });
  } catch (err) {
    console.error("Error obteniendo clientes activos:", err);
    res.status(500).json({ ok: false, msg: "Error obteniendo clientes", err });
  }
};

export const getSellerPaymentProofs = async (req: Request, res: Response) => {
  try {
    console.log("Obteniendo comprobantes de pago para el vendedor...");
    const { id } = req.params;

    const result = await SellerService.getSellerPaymentProofs(id);

    res.json(result);
  } catch (err) {
    console.error("Error obteniendo comprobantes de pago:", err);
    res.status(500).json({
      msg: "Error obteniendo comprobantes de pago",
      error: err,
    });
  }
};
