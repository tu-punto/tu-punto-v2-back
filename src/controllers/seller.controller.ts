import { Request, Response } from "express";
import { SellerService } from "../services/seller.service";
import { SellerPdfService } from "../services/sellerPdf.service";

export const getSellers = async (_: Request, res: Response) => {
  try {
    const sellerList = await SellerService.getAllSellers();
    res.json(sellerList);
  } catch (err) {
    res.status(500).json({ msg: "Error obteniendo vendedores", err });
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
