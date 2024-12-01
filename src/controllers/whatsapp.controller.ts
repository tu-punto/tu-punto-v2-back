import { Request, Response } from "express";
import { sendHelloService, sendMessageService } from "../services/whats.service";

export const sendWhats = async (req: Request, res: Response) => {
    const {message} = req.body
    try {
        const msg = await sendMessageService(message)
        return res.status(200).json({
            msg
        })
    } catch (error) {
        res.status(500).json({msg: `Internal Server error`,error})
    }
}

export const sendHello = async(req: Request, res: Response) => {
    const {phone} = req.body
    try {
        const msg = await sendHelloService(phone)
        return res.status(200).json({
            msg
        })
    } catch (error) {
        res.status(500).json({msg: "Internal Server error", error})
    }
}