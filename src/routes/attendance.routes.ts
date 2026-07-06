import { Router } from "express";
import { getAttendanceReportController } from "../controllers/attendance.controller";

const attendanceRouter = Router();

attendanceRouter.get("/report", getAttendanceReportController);

export default attendanceRouter;
