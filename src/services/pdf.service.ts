import { googleDrive } from "../api/drive/google.drive"
import { SaleService } from "./sale.service"

export const generatePdf = async (bodyTable: any) => {
    try {
        console.log(bodyTable)
        const pdf = await googleDrive.sentProductsPDF(bodyTable)
        return pdf
    } catch (error) {
        throw error
    }
}

export const generatePaymentPDF = async (sellerId: number) => {
    try{

        const {products, payments} = await SaleService.getDataPaymentProof(sellerId)

        const pdf = await googleDrive.sentPaymentPDF(products, payments)
        return pdf
    } catch (error) {
        throw error
    }
}
