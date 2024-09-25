import { Request, Response } from "express"
import {generatePaymentPDF, generatePdf} from "../services/pdf.service"

const uploadPDF = async (req: Request, res:Response) => {
    const {bodyTable} = req.body
    try {
        const pdf = await generatePdf(bodyTable)
        return res.status(200).json({
            pdf
        })
    } catch (error) {
        res.status(500).json({msg: `Internal Server error`,error})
    }
}

const uploadPaymentPDF = async (req: Request, res: Response) => {
    const {bodyTable, paymentTable} = req.body
    try {
        const pdf = await generatePaymentPDF(bodyTable, paymentTable)
        return res.status(200).json({
            pdf
        })
    } catch (error) {
        res.status(500).json({msg: `Internal Server error`,error})
    }
}

export const pdfController = {
    uploadPDF, uploadPaymentPDF
}