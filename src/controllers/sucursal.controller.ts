import { Request, Response } from "express";
import { SucursalsService } from "../services/sucursals.service";
import { uploadFileToAws } from "../services/bucket.service";
import { awsFolderNames } from "../config/bucketConfig";

const getAllSucursals = async (req: Request, res: Response) => {
  try {
    const sucursals = await SucursalsService.getAllSucursals();
    res.json(sucursals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Failed", error });
  }
};

export const registerSucursalController = async (
  req: Request,
  res: Response
) => {
  const sucursal = req.body;
  try {
    const newSucursal = await SucursalsService.registerSucursal(sucursal);
    res.json({
      status: true,
      newSucursal,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSucursalByIdController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  try {
    const sucursal = await SucursalsService.getSucursalByID(id);
    res.json(sucursal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error", error });
  }
};

export const getSucursalHeaderInfoController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  try {
    const sucursal = await SucursalsService.getSucursalHeaderInfoByID(id);
    return res.json({
      success: true,
      data: sucursal,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, msg: "Internal Server Error", error });
  }
};

export const updateSucursalController = async (req: Request, res: Response) => {
  const sucursalId = req.params.id;
  const newData = req.body; 
  try {
    const updatedSucursal = await SucursalsService.updateSucursal(
      sucursalId,
      newData
    );
    res.json({ status: true, updatedSucursal });
  } catch (error) {
    res.status(500).json({ msg: "Internal server error", error });
  }
};

export const uploadSucursalHeaderImageController = async (req: Request, res: Response) => {
  const sucursalId = req.params.id;

  try {
    if (!req.file) {
      return res.status(400).json({ status: false, msg: "Debes enviar una imagen" });
    }

    const baseName = req.file.originalname.replace(/\s+/g, "-").replace(/[^\w.-]/g, "");
    const safeName = baseName.length > 0 ? baseName : `header-${Date.now()}.jpg`;
    const key = `${awsFolderNames.sucursalesHeader}/${sucursalId}/${Date.now()}-${safeName}`;

    const imageUrl = await uploadFileToAws(req.file.buffer, key, req.file.mimetype);
    const updatedSucursal = await SucursalsService.updateSucursal(sucursalId, {
      imagen_header: imageUrl,
    });

    return res.json({
      status: true,
      msg: "Imagen de header actualizada",
      imageUrl,
      updatedSucursal,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, msg: "Error al subir la imagen", error });
  }
};

export const SucursalController = {
  getAllSucursals,
};
