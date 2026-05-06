import { Request, Response } from "express";

export const verifyWhatsappWebhook = (req: Request, res: Response) => {
  const mode = String(req.query["hub.mode"] || "");
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = String(req.query["hub.challenge"] || "");
  const expectedToken = String(process.env.W_WEBHOOK_VERIFY_TOKEN || "");

  if (mode === "subscribe" && token && token === expectedToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

export const receiveWhatsappWebhook = (req: Request, res: Response) => {
  console.log("[whatsapp-webhook]", JSON.stringify(req.body));
  return res.sendStatus(200);
};
