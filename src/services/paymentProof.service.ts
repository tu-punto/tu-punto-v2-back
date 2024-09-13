import * as paymentProofRepository from '../repositories/paymentProof.repository'

export const getPaymentProofsBySellerId = async (sellerId:number)=>{
    const paymentProofs = await paymentProofRepository.getPaymentProofsBySellerId(sellerId);
    return paymentProofs
}   
