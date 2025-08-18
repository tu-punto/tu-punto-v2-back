import { Router } from "express";
import https from "https";

const qrRouter = Router();

qrRouter.get("/download-qr", async (req, res) => {
  const { url, name } = req.query;
  if (!url) return res.status(400).send("Missing url");

  https.get(url as string, (s3Res) => {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${name || "qr"}.png"`
    );
    res.setHeader("Content-Type", "image/png");
    s3Res.pipe(res);
  }).on("error", (err) => {
    res.status(500).send("Error downloading QR");
  });
});

export default qrRouter;