import { PaymentProofRepository } from "../repositories/paymentProof.repository";

const getComprobantesByVendedor = async (vendedorId: string) => {
  try {
    const comprobantes = await PaymentProofRepository.findByVendedor(
      vendedorId
    );

    return comprobantes;
  } catch (error) {
    console.error("Error en getComprobantesByVendedor:", error);
    throw error;
  }
};

const createComprobante = async (comprobanteData: {
  vendedor: string;
  comprobante_entrada_pdf: string;
  monto_pagado: number;
  total_ventas: number;
  total_adelantos: number;
  total_deliverys: number;
  total_mensualidades: number;
}) => {
  try {
    return await PaymentProofRepository.create(comprobanteData);
  } catch (error) {
    console.error("Error en createComprobante:", error);
    throw error;
  }
};

export const PaymentProofService = {
  getComprobantesByVendedor,
  createComprobante,
};
