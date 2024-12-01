import { sendHelloAPI, sendMessage } from "../api/whatsapp/whatsapp"


export const sendMessageService = async (msg: String) => {
    try {
        const res = await sendMessage(msg)
        return res
    } catch (error) {
        throw new Error("Error to send the message")        
    }
}

export const sendHelloService = async (phone: String) => {
    try {
        const res = await sendHelloAPI(phone)
        return res
    } catch (error) {
        throw new Error("Error to send the template")
    }
}