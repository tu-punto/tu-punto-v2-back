import { Request, Response } from "express";
import * as PaymentProofService from '../services/paymentProof.service'

export const getPaymentProofBySellerId = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const paymentProofs = await PaymentProofService.getPaymentProofsBySellerId(id);
        res.json(paymentProofs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "Error getting paymentProofs by seller id", error });
    }
}