import * as paymentProofRepository from '../repositories/paymentProof.repository'

export const getPaymentProofsBySellerId = async (sellerId:number)=>{
    const paymentProofs = await paymentProofRepository.getPaymentProofsBySellerId(sellerId);

    if (!paymentProofs.length) {
        // throw new Error(`No payment proofs found for seller with id ${id}`);
        return []
    }

    return paymentProofs
}   
