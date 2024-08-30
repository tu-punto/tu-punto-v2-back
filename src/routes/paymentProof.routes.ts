import { Router } from 'express';
import { getPaymentProofBySellerId } from '../controllers/paymentProof.controller';

const paymentProofRouter = Router()

paymentProofRouter.get('/seller/:id', getPaymentProofBySellerId)

export default paymentProofRouter