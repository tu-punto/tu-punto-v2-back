import dotenv from 'dotenv'

dotenv.config()

export type WhatsAppSendResult = {
    success: boolean;
    status: number;
    data: any;
};

export type WhatsAppTemplateParameter = {
    type: "text";
    text: string;
};

export type WhatsAppTemplateComponent = {
    type: "header" | "body" | "button";
    parameters: WhatsAppTemplateParameter[];
    sub_type?: "url" | "quick_reply";
    index?: string;
};

const getWhatsAppConfig = () => {
    const version = process.env.W_VERSION;
    const phoneNumberId = process.env.W_PHONE_NUMBER_ID;
    const bearerToken = process.env.W_BEARER_TOKEN;

    if (!version || !phoneNumberId || !bearerToken) {
        throw new Error("WhatsApp API no configurada. Revisa W_VERSION, W_PHONE_NUMBER_ID y W_BEARER_TOKEN");
    }

    return {
        uri: `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
        bearerToken,
    };
};

export const sendTextMessage = async (phone: string, msg: string): Promise<WhatsAppSendResult> => {
    const to = String(phone || "").trim();
    const bodyText = String(msg || "").trim();

    if (!to) throw new Error("Telefono de WhatsApp requerido");
    if (!bodyText) throw new Error("Mensaje de WhatsApp requerido");

    const config = getWhatsAppConfig();

    const body = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: {
            preview_url: false,
            body: bodyText
        }
    }

    const res = await fetch(config.uri, {
        method: "POST",
        headers: {
            'Content-Type': "application/json",
            'Authorization': `Bearer ${config.bearerToken}`
        },
        body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}));

    return {
        success: res.ok,
        status: res.status,
        data,
    };
}

export const sendTemplateMessage = async (params: {
    phone: string;
    templateName: string;
    languageCode?: string;
    bodyParameters?: WhatsAppTemplateParameter[];
    headerParameters?: WhatsAppTemplateParameter[];
    buttonUrlParameters?: WhatsAppTemplateParameter[];
    buttonIndex?: string;
    components?: WhatsAppTemplateComponent[];
}): Promise<WhatsAppSendResult> => {
    const to = String(params.phone || "").trim();
    const templateName = String(params.templateName || "").trim();
    const languageCode = String(params.languageCode || "en_US").trim();

    if (!to) throw new Error("Telefono de WhatsApp requerido");
    if (!templateName) throw new Error("Nombre de plantilla de WhatsApp requerido");

    const config = getWhatsAppConfig();
    const bodyParameters = Array.isArray(params.bodyParameters) ? params.bodyParameters : [];
    const headerParameters = Array.isArray(params.headerParameters) ? params.headerParameters : [];
    const buttonUrlParameters = Array.isArray(params.buttonUrlParameters) ? params.buttonUrlParameters : [];
    const explicitComponents = Array.isArray(params.components) ? params.components : [];
    const body: any = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
            name: templateName,
            language: {
                code: languageCode,
            },
        },
    };

    const components: WhatsAppTemplateComponent[] = explicitComponents.length
        ? explicitComponents
        : [
            ...(headerParameters.length ? [{ type: "header" as const, parameters: headerParameters }] : []),
            ...(bodyParameters.length ? [{ type: "body" as const, parameters: bodyParameters }] : []),
            ...(buttonUrlParameters.length
                ? [{
                    type: "button" as const,
                    sub_type: "url" as const,
                    index: String(params.buttonIndex || "0"),
                    parameters: buttonUrlParameters,
                }]
                : []),
        ];

    if (components.length) {
        body.template.components = components;
    }

    const res = await fetch(config.uri, {
        method: "POST",
        headers: {
            'Content-Type': "application/json",
            'Authorization': `Bearer ${config.bearerToken}`
        },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));

    return {
        success: res.ok,
        status: res.status,
        data,
    };
}

export const sendMessage = async (msg: String) => {
    return sendTextMessage(String(process.env.W_RECIPIENT_PHONE || ""), String(msg || ""));
}

export const sendHelloAPI = async (phone: String) => {
    const config = getWhatsAppConfig();
    
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
    const res = await fetch(config.uri, {
        method: "POST",
        headers: {
            'Content-Type': "application/json",
            'Authorization': `Bearer ${config.bearerToken}`
        },
        body: JSON.stringify(body)
    })
    return res; 
}
