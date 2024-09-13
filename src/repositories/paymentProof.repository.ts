import AppDataSource from "../config/dataSource"
import { ComprobantePagoEntity } from "../entities/implements/ComprobantePagoEntity"

const paymentProofRepository = AppDataSource.getRepository(ComprobantePagoEntity)

export const getPaymentProofsBySellerId = async (sellerId:number): Promise<ComprobantePagoEntity[]> => {
    const paymentProofs = await paymentProofRepository.find({
        where: {id_vendedor:sellerId}
    })
    return paymentProofs
}