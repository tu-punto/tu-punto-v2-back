import moment from "moment-timezone";
import { normalizeUserRole } from "../constants/roles";
import { UserService } from "./user.service";
import {
  getJibbleConfig,
  getJibblePeople,
  getJibbleTimesheetsSummary,
  type JibblePerson,
  type JibbleSummaryDaily,
  type JibbleTimesheetSummary,
} from "./jibble.service";

const TIMEZONE = String(process.env.ATTENDANCE_TIMEZONE || "America/La_Paz");
const WEEKDAY_START = String(process.env.ATTENDANCE_WEEKDAY_START || "11:00");
const WEEKDAY_END = String(process.env.ATTENDANCE_WEEKDAY_END || "20:00");
const SATURDAY_START = String(process.env.ATTENDANCE_SATURDAY_START || "11:00");
const SATURDAY_END = String(process.env.ATTENDANCE_SATURDAY_END || "14:00");

type AttendanceFilters = {
  from?: string;
  to?: string;
  search?: string;
  personId?: string;
  role?: string;
  sucursalId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

type AttendancePerson = {
  userId: string;
  email: string;
  role: string;
  roleLabel: string;
  sucursalId: string;
  sucursalName: string;
  fullName: string;
  jibblePersonId: string | null;
  jibbleMatched: boolean;
};

type AttendanceRow = {
  id: string;
  personId: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  roleLabel: string;
  sucursalId: string;
  sucursalName: string;
  date: string;
  weekday: string;
  isRestDay: boolean;
  expectedStartTime: string | null;
  expectedEndTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  expectedMinutes: number;
  workedMinutes: number;
  differenceMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  statusKey: string;
  statusLabel: string;
  issueTags: string[];
  sourceStatus: string;
  jibbleMatched: boolean;
  jibblePersonId: string | null;
};

type AttendanceReport = {
  rows: AttendanceRow[];
  pagination: { page: number; pageSize: number; total: number };
  summary: {
    people: number;
    matchedPeople: number;
    rows: number;
    expectedMinutes: number;
    workedMinutes: number;
    differenceMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
  };
  meta: {
    configured: boolean;
    timezone: string;
    schedule: {
      weekday: { start: string; end: string };
      saturday: { start: string; end: string };
    };
    people: Array<{
      value: string;
      label: string;
      role: string;
      sucursalId: string;
      sucursalName: string;
      email: string;
      jibbleMatched: boolean;
    }>;
    sucursales: Array<{ value: string; label: string }>;
    integration: {
      configured: boolean;
      matchedPeople: number;
      unmatchedPeople: number;
      message: string;
    };
  };
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  operator: "Operario",
  superadmin: "Superadmin",
};

const normalizeEmail = (value?: string | null) => String(value || "").trim().toLowerCase();

const toMinutes = (value?: string | number | null): number | null => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value <= 24 ? Math.round(value * 60) : Math.round(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hhmm) {
    return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  }

  const parsed = moment.tz(raw, TIMEZONE);
  if (parsed.isValid()) {
    return parsed.hours() * 60 + parsed.minutes();
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return numeric <= 24 ? Math.round(numeric * 60) : Math.round(numeric);
  }

  return null;
};

const parseTime = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const hhmm = normalized.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) {
    return `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;
  }

  const parsed = moment.tz(normalized, TIMEZONE);
  if (parsed.isValid()) {
    return parsed.format("HH:mm");
  }

  return null;
};

const workedMinutes = (daily?: JibbleSummaryDaily | null): number => {
  if (!daily) return 0;
  const candidates = [
    daily.trackedHours?.worked,
    daily.trackedHours?.total,
    daily.tracked,
    daily.regular,
    daily.payrollHours?.total,
  ];

  for (const candidate of candidates) {
    const minutes = toMinutes(candidate as any);
    if (minutes !== null) return minutes;
  }

  return 0;
};

const minutesToDayjs = (value: string) => toMinutes(value) ?? 0;

const formatDateKey = (value: moment.Moment) => value.format("YYYY-MM-DD");

const scheduleForDate = (date: moment.Moment) => {
  const day = date.day();
  if (day === 0) {
    return { isRestDay: true, startTime: null, endTime: null, expectedMinutes: 0 };
  }

  if (day === 6) {
    return {
      isRestDay: false,
      startTime: SATURDAY_START,
      endTime: SATURDAY_END,
      expectedMinutes: Math.max(0, minutesToDayjs(SATURDAY_END) - minutesToDayjs(SATURDAY_START)),
    };
  }

  return {
    isRestDay: false,
    startTime: WEEKDAY_START,
    endTime: WEEKDAY_END,
    expectedMinutes: Math.max(0, minutesToDayjs(WEEKDAY_END) - minutesToDayjs(WEEKDAY_START)),
  };
};

const rangeDays = (from: string, to: string) => {
  const start = moment.tz(from, TIMEZONE).startOf("day");
  const end = moment.tz(to, TIMEZONE).endOf("day");
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return [] as moment.Moment[];

  const days: moment.Moment[] = [];
  const cursor = start.clone();
  while (cursor.isSameOrBefore(end, "day")) {
    days.push(cursor.clone());
    cursor.add(1, "day");
  }

  return days;
};

const findDaily = (summaries: JibbleTimesheetSummary[], personId: string, date: string): JibbleSummaryDaily | null => {
  const summary = summaries.find((item) => String(item.personId || "") === String(personId));
  if (!summary?.daily?.length) return null;
  return summary.daily.find((daily) => formatDateKey(moment.tz(daily.date || date, TIMEZONE)) === date) || null;
};

const getStatus = (payload: {
  isRestDay: boolean;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  hasActual: boolean;
}) => {
  if (!payload.hasActual && payload.workedMinutes === 0) {
    return {
      key: payload.isRestDay ? "rest" : "missing",
      label: payload.isRestDay ? "Descanso" : "Sin marcacion",
      tags: [payload.isRestDay ? "Descanso" : "Sin marcacion"],
    };
  }

  if (payload.isRestDay && payload.workedMinutes > 0) {
    return {
      key: "rest-worked",
      label: "Descanso trabajado",
      tags: ["Descanso trabajado", "Extra"],
    };
  }

  const tags: string[] = [];
  if (payload.lateMinutes > 0) tags.push("Tarde");
  if (payload.earlyLeaveMinutes > 0) tags.push("Salida temprana");
  if (payload.overtimeMinutes > 0) tags.push("Extra");

  if (!tags.length) {
    tags.push(payload.isRestDay ? "Descanso" : "A tiempo");
  }

  return {
    key: payload.lateMinutes > 0
      ? "late"
      : payload.earlyLeaveMinutes > 0
        ? "early"
        : payload.overtimeMinutes > 0
          ? "overtime"
          : payload.isRestDay
            ? "rest"
            : "normal",
    label: tags.join(" + "),
    tags,
  };
};

const buildPeople = async (): Promise<AttendancePerson[]> => {
  const users = await UserService.getAllUsers();
  const allowedRoles = new Set(["admin", "operator", "superadmin"]);

  return users
    .map((user: any) => {
      const role = normalizeUserRole(user.role);
      if (!allowedRoles.has(role)) return null;

      const sucursal = user.sucursal?.toObject?.() || user.sucursal || {};
      const email = normalizeEmail(user.email);
      const fullName = String(user.fullName || user.name || user.nombre || user.email || "").trim() || user.email;

      return {
        userId: String(user._id),
        email,
        role,
        roleLabel: ROLE_LABELS[role] || role,
        sucursalId: String(sucursal?._id || sucursal?.id || "").trim(),
        sucursalName: String(sucursal?.nombre || sucursal?.name || "Sin sucursal").trim(),
        fullName,
        jibblePersonId: null,
        jibbleMatched: false,
      } as AttendancePerson;
    })
    .filter(Boolean) as AttendancePerson[];
};

const buildMetaLists = (people: AttendancePerson[]) => {
  const sucursales = new Map<string, string>();
  const peopleOptions = people.map((person) => {
    if (person.sucursalId) {
      sucursales.set(person.sucursalId, person.sucursalName || "Sin sucursal");
    }

    return {
      value: person.userId,
      label: `${person.fullName} ${person.email ? `(${person.email})` : ""}`.trim(),
      role: person.role,
      sucursalId: person.sucursalId,
      sucursalName: person.sucursalName,
      email: person.email,
      jibbleMatched: person.jibbleMatched,
    };
  });

  return {
    peopleOptions,
    sucursales: Array.from(sucursales.entries()).map(([value, label]) => ({ value, label })),
  };
};

const toLower = (value?: string | null) => String(value || "").trim().toLowerCase();

export const AttendanceService = {
  async getAttendanceReport(filters: AttendanceFilters): Promise<AttendanceReport> {
    const from = String(filters.from || moment.tz(TIMEZONE).startOf("month").format("YYYY-MM-DD"));
    const to = String(filters.to || moment.tz(TIMEZONE).endOf("month").format("YYYY-MM-DD"));
    const page = Math.max(1, Number(filters.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(filters.pageSize || 25)));
    const search = toLower(filters.search);
    const personId = String(filters.personId || "").trim();
    const role = toLower(filters.role);
    const sucursalId = String(filters.sucursalId || "").trim();
    const status = toLower(filters.status || "all");

    const [basePeople, jibbleConfig] = [await buildPeople(), getJibbleConfig()];
    let people = basePeople;

    const jibblePeople: JibblePerson[] = jibbleConfig ? await getJibblePeople() : [];
    const peopleByEmail = new Map(jibblePeople.map((person) => [normalizeEmail(person.email), person]));

    people = people.map((person) => {
      const jibblePerson = peopleByEmail.get(person.email);
      return {
        ...person,
        fullName: jibblePerson?.fullName ? String(jibblePerson.fullName).trim() : person.fullName,
        jibblePersonId: jibblePerson?.id || null,
        jibbleMatched: Boolean(jibblePerson?.id),
      };
    });

    const personIds = people.filter((person) => person.jibblePersonId).map((person) => person.jibblePersonId as string);
    const summaries = jibbleConfig && personIds.length > 0
      ? await getJibbleTimesheetsSummary({ from, to, personIds })
      : [];

    const dateRange = rangeDays(from, to);
    const rows: AttendanceRow[] = [];

    for (const person of people) {
      for (const date of dateRange) {
        const schedule = scheduleForDate(date);
        const dateKey = formatDateKey(date);
        const daily = person.jibblePersonId ? findDaily(summaries, person.jibblePersonId, dateKey) : null;
        const actualStartTime = parseTime(daily?.firstIn || daily?.firstInTimestamp || daily?.startTime || null);
        const actualEndTime = parseTime(daily?.lastOut || daily?.lastOutTimestamp || daily?.endTime || null);
        const actualStartMinutes = actualStartTime ? toMinutes(actualStartTime) : null;
        const actualEndMinutes = actualEndTime ? toMinutes(actualEndTime) : null;
        const expectedStartMinutes = schedule.startTime ? toMinutes(schedule.startTime) : null;
        const expectedEndMinutes = schedule.endTime ? toMinutes(schedule.endTime) : null;
        const worked = workedMinutes(daily);
        const lateMinutes = schedule.isRestDay || expectedStartMinutes === null || actualStartMinutes === null
          ? 0
          : Math.max(0, actualStartMinutes - expectedStartMinutes);
        const earlyLeaveMinutes = schedule.isRestDay || expectedEndMinutes === null || actualEndMinutes === null
          ? 0
          : Math.max(0, expectedEndMinutes - actualEndMinutes);
        const overtimeMinutes = Math.max(0, worked - schedule.expectedMinutes);
        const differenceMinutes = worked - schedule.expectedMinutes;
        const statusInfo = getStatus({
          isRestDay: schedule.isRestDay,
          workedMinutes: worked,
          lateMinutes,
          earlyLeaveMinutes,
          overtimeMinutes,
          hasActual: Boolean(daily),
        });

        rows.push({
          id: `${person.userId}-${dateKey}`,
          personId: person.userId,
          userId: person.userId,
          email: person.email,
          fullName: person.fullName,
          role: person.role,
          roleLabel: person.roleLabel,
          sucursalId: person.sucursalId,
          sucursalName: person.sucursalName,
          date: dateKey,
          weekday: date.format("dddd"),
          isRestDay: schedule.isRestDay,
          expectedStartTime: schedule.startTime,
          expectedEndTime: schedule.endTime,
          actualStartTime,
          actualEndTime,
          expectedMinutes: schedule.expectedMinutes,
          workedMinutes: worked,
          differenceMinutes,
          lateMinutes,
          earlyLeaveMinutes,
          overtimeMinutes,
          statusKey: statusInfo.key,
          statusLabel: statusInfo.label,
          issueTags: statusInfo.tags,
          sourceStatus: daily ? "Jibble" : (jibbleConfig ? "Jibble sin coincidencia" : "Preparado"),
          jibbleMatched: person.jibbleMatched,
          jibblePersonId: person.jibblePersonId,
        });
      }
    }

    let filteredRows = rows;

    if (search) {
      filteredRows = filteredRows.filter((row) =>
        [row.fullName, row.email, row.sucursalName].some((value) => toLower(value).includes(search))
      );
    }

    if (personId) {
      filteredRows = filteredRows.filter((row) => row.userId === personId);
    }

    if (role) {
      filteredRows = filteredRows.filter((row) => row.role === role);
    }

    if (sucursalId) {
      filteredRows = filteredRows.filter((row) => row.sucursalId === sucursalId);
    }

    if (status && status !== "all") {
      filteredRows = filteredRows.filter((row) => {
        if (status === "problematic") {
          return row.statusKey !== "normal" && row.statusKey !== "rest";
        }
        return row.statusKey === status;
      });
    }

    filteredRows = filteredRows.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.fullName.localeCompare(b.fullName);
    });

    const total = filteredRows.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

    const summary = filteredRows.reduce(
      (acc, row) => {
        acc.rows += 1;
        acc.expectedMinutes += row.expectedMinutes;
        acc.workedMinutes += row.workedMinutes;
        acc.differenceMinutes += row.differenceMinutes;
        acc.lateMinutes += row.lateMinutes;
        acc.earlyLeaveMinutes += row.earlyLeaveMinutes;
        acc.overtimeMinutes += row.overtimeMinutes;
        return acc;
      },
      {
        people: new Set(filteredRows.map((row) => row.userId)).size,
        matchedPeople: new Set(filteredRows.filter((row) => row.jibbleMatched).map((row) => row.userId)).size,
        rows: 0,
        expectedMinutes: 0,
        workedMinutes: 0,
        differenceMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
      }
    );

    const metaLists = buildMetaLists(people);
    const integrationConfigured = Boolean(jibbleConfig);
    const unmatchedPeople = people.filter((person) => !person.jibbleMatched).length;

    return {
      rows: paginatedRows,
      pagination: { page, pageSize, total },
      summary,
      meta: {
        configured: integrationConfigured,
        timezone: TIMEZONE,
        schedule: {
          weekday: { start: WEEKDAY_START, end: WEEKDAY_END },
          saturday: { start: SATURDAY_START, end: SATURDAY_END },
        },
        people: metaLists.peopleOptions,
        sucursales: metaLists.sucursales,
        integration: {
          configured: integrationConfigured,
          matchedPeople: people.filter((person) => person.jibbleMatched).length,
          unmatchedPeople,
          message: integrationConfigured
            ? unmatchedPeople > 0
              ? `${unmatchedPeople} persona(s) aun no coinciden con Jibble por email`
              : "Jibble listo para sincronizar"
            : "Faltan credenciales de Jibble para traer horas reales",
        },
      },
    };
  },
};
