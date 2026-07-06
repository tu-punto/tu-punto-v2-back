import { Request, Response } from "express";
import { AttendanceService } from "../services/attendance.service";

export const getAttendanceReportController = async (req: Request, res: Response) => {
  try {
    const report = await AttendanceService.getAttendanceReport({
      from: String(req.query.from || ""),
      to: String(req.query.to || ""),
      search: String(req.query.search || ""),
      personId: String(req.query.personId || ""),
      role: String(req.query.role || ""),
      sucursalId: String(req.query.sucursalId || ""),
      status: String(req.query.status || ""),
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 25),
    });

    return res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error("Error obteniendo reporte de asistencia:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Error al obtener el reporte de asistencia",
    });
  }
};
