import dotenv from 'dotenv'

dotenv.config()

export const sendMessage = async (msg: String) => {

    const body = {
        messaging_product: "whatsapp",
        to: process.env.W_RECIPIENT_PHONE,
        type: "text",
        text: {
            body: msg
        }
    }
    const clientServerOptions = {
        uri: `https://graph.facebook.com/${process.env.W_VERSION}/${process.env.W_PHONE_NUMBER_ID}/messages`,
        body: JSON.stringify(body),
        method: "POST",
        headers: {
            'Content-Type': "application/json",
            'Authorization': `Bearer ${process.env.W_BEARER_TOKEN}`
        }
    }
    const res = await fetch(clientServerOptions.uri, {
        method: clientServerOptions.method,
        headers: clientServerOptions.headers,
        body: clientServerOptions.body
    })
    return res;   
}

export const sendHelloAPI = async (phone: String) => {
    
    const body = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
            name: "hello_world",
            language: {
                code: "en_US"
            }
        }
    }
    const clientServerOptions = {
        uri: `https://graph.facebook.com/${process.env.W_VERSION}/${process.env.W_PHONE_NUMBER_ID}/messages`,
        body: JSON.stringify(body),
        method: "POST",
        headers: {
            'Content-Type': "application/json",
            'Authorization': `Bearer ${process.env.W_BEARER_TOKEN}`
        }
    }
    const res = await fetch(clientServerOptions.uri, {
        method: clientServerOptions.method,
        headers: clientServerOptions.headers,
        body: clientServerOptions.body
    })
    return res; 
}