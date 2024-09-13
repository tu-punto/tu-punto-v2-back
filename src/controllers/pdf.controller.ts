import { Request, Response } from "express"
import generatePdf from "../services/pdf.service"

const uploadPDF = async (req: Request, res:Response) => {
    const {bodyTable} = req.body
    try {
        console.log("PDF Controller")
        const pdf = await generatePdf(bodyTable)
        return res.status(200).json({
            pdf
        })
    } catch (error) {
        res.status(500).json({msg: `Internal Server error`,error})
    }
}

export const pdfController = {
    uploadPDF
}