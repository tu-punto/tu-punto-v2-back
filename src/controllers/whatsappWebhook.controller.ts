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
  const body = req.body as any;
  const statuses = body?.entry
    ?.flatMap((entry: any) => entry?.changes || [])
    ?.flatMap((change: any) => change?.value?.statuses || []) || [];

  console.log("[whatsapp-webhook]", JSON.stringify({
    body,
    statuses: statuses.map((status: any) => ({
      id: status?.id,
      status: status?.status,
      recipient_id: status?.recipient_id,
      timestamp: status?.timestamp,
      errors: status?.errors,
    })),
  }));
  return res.sendStatus(200);
};
