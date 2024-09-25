import { googleDrive } from "../api/drive/google.drive"




export const generatePdf = async (bodyTable: any) => {
    try {
        const pdf = await googleDrive.sentProductsPDF(bodyTable)
        return pdf
    } catch (error) {
        throw error
    }
}

export const generatePaymentPDF = async (bodyTable: any[], paymentData: any[]) => {
    try{
        const pdf = await googleDrive.sentPaymentPDF(bodyTable, paymentData)
        return pdf
    } catch (error) {
        throw error
    }
}
