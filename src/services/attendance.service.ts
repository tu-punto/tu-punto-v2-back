import moment from "moment-timezone";
import {
  getJibbleConfig,
  getJibblePeople,
  getJibbleTimesheetsSummary,
  type JibblePerson,
  type JibbleSummaryDaily,
  type JibbleTimesheetSummary,
} from "./jibble.service";

const TIMEZONE = String(process.env.ATTENDANCE_TIMEZONE || "America/La_Paz");
const WEEKDAY_EXPECTED_MINUTES = Number(process.env.ATTENDANCE_WEEKDAY_EXPECTED_MINUTES || 9 * 60);
const SATURDAY_EXPECTED_MINUTES = Number(process.env.ATTENDANCE_SATURDAY_EXPECTED_MINUTES || 3 * 60);

type AttendanceFilters = {
  from?: string;
  to?: string;
  search?: string;
  personId?: string;
  groupId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

type AttendancePerson = {
  personId: string;
  email: string;
  roleLabel: string;
  fullName: string;
  groupId: string;
  groupName: string;
  status: string;
  code: string;
};

type AttendanceRow = {
  id: string;
  personId: string;
  email: string;
  fullName: string;
  roleLabel: string;
  groupId: string;
  groupName: string;
  status: string;
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
  missingMinutes: number;
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
    missingMinutes: number;
    overtimeMinutes: number;
  };
  meta: {
    configured: boolean;
    connected: boolean;
    timezone: string;
    schedule: {
      weekday: { expectedMinutes: number; label: string };
      saturday: { expectedMinutes: number; label: string };
    };
    people: Array<{
      value: string;
      label: string;
      email: string;
      groupId: string;
      groupName: string;
      status: string;
    }>;
    groups: Array<{ value: string; label: string }>;
    integration: {
      configured: boolean;
      matchedPeople: number;
      unmatchedPeople: number;
      message: string;
    };
  };
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

const parseDurationMinutes = (raw: string): number | null => {
  const normalized = raw.trim();
  if (!normalized) return null;

  const iso = normalized.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    const hours = Number(iso[1] || 0);
    const minutes = Number(iso[2] || 0);
    const seconds = Number(iso[3] || 0);
    return hours * 60 + minutes + Math.round(seconds / 60);
  }

  const verbose = normalized.match(/^(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?\s*(?:(\d+)\s*s(?:ec(?:onds?)?)?)?$/i);
  if (verbose && (verbose[1] || verbose[2] || verbose[3])) {
    const hours = Number(verbose[1] || 0);
    const minutes = Number(verbose[2] || 0);
    const seconds = Number(verbose[3] || 0);
    return hours * 60 + minutes + Math.round(seconds / 60);
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

const extractMinutes = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" || typeof value === "string") {
    if (typeof value === "string") {
      const durationMinutes = parseDurationMinutes(value);
      if (durationMinutes !== null) return durationMinutes;
    }
    return toMinutes(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const minutes = extractMinutes(item);
      if (minutes !== null) return minutes;
    }
    return null;
  }

  if (typeof value === "object") {
    const candidates = [
      value.minutes,
      value.totalMinutes,
      value.workedMinutes,
      value.durationMinutes,
      value.hours,
      value.total,
      value.worked,
      value.regular,
      value.value,
      value.amount,
      value.time,
      value.duration,
    ];

    for (const candidate of candidates) {
      const minutes = extractMinutes(candidate);
      if (minutes !== null) return minutes;
    }
  }

  return null;
}

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
    const minutes = extractMinutes(candidate as any);
    if (minutes !== null) return minutes;
  }

  const firstIn = parseTime(daily.firstIn || daily.firstInTimestamp || daily.startTime || null);
  const lastOut = parseTime(daily.lastOut || daily.lastOutTimestamp || daily.endTime || null);
  if (firstIn && lastOut) {
    const start = toMinutes(firstIn);
    const end = toMinutes(lastOut);
    if (start !== null && end !== null && end >= start) {
      return end - start;
    }
  }

  return 0;
};

const formatDateKey = (value: moment.Moment) => value.format("YYYY-MM-DD");

const scheduleForDate = (date: moment.Moment) => {
  const day = date.day();
  if (day === 0) {
    return { isRestDay: true, expectedMinutes: 0, label: "Descanso" };
  }

  if (day === 6) {
    return {
      isRestDay: false,
      expectedMinutes: Math.max(0, SATURDAY_EXPECTED_MINUTES),
      label: "3h",
    };
  }

  return {
    isRestDay: false,
    expectedMinutes: Math.max(0, WEEKDAY_EXPECTED_MINUTES),
    label: "9h",
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
  return summary.daily.find((daily) => {
    const rawDate = String(daily.date || "").trim();
    if (rawDate.slice(0, 10) === date) return true;
    return formatDateKey(moment.tz(rawDate || date, TIMEZONE)) === date;
  }) || null;
};

const getStatus = (payload: {
  isRestDay: boolean;
  workedMinutes: number;
  missingMinutes: number;
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
  if (payload.missingMinutes > 0) tags.push("Faltan horas");
  if (payload.overtimeMinutes > 0) tags.push("Extra");

  if (!tags.length) {
    tags.push(payload.isRestDay ? "Descanso" : "Cumplió");
  }

  return {
    key: payload.missingMinutes > 0
      ? "missing-hours"
      : payload.overtimeMinutes > 0
        ? "overtime"
        : payload.isRestDay
          ? "rest"
          : "normal",
    label: tags.join(" + "),
    tags,
  };
};

const getGroupNameFromJibble = (person: JibblePerson, summary?: JibbleTimesheetSummary) => {
  const summaryGroupName = String(summary?.person?.groupName || "").trim();
  if (summaryGroupName) return summaryGroupName;

  if (typeof person.group === "string" && person.group.trim()) return person.group.trim();
  if (person.group && typeof person.group === "object") {
    const groupObj = person.group as any;
    const groupName = String(groupObj?.name || groupObj?.fullName || groupObj?.title || "").trim();
    if (groupName) return groupName;
  }

  return String(person.status || "Sin grupo").trim() || "Sin grupo";
};

const normalizeKey = (value?: string | null) => toLower(value).replace(/\s+/g, "-");

const buildPeople = (jibblePeople: JibblePerson[], summaries: JibbleTimesheetSummary[]): AttendancePerson[] => {
  const summariesByPersonId = new Map(summaries.map((summary) => [String(summary.personId || ""), summary]));

  return jibblePeople
    .filter((person) => Boolean(person?.id))
    .map((person) => {
      const summary = summariesByPersonId.get(String(person.id));
      const email = normalizeEmail(person.email);
      const fullName = String(summary?.person?.fullName || person.fullName || person.email || "").trim();
      const groupName = getGroupNameFromJibble(person, summary);
      const status = String(summary?.person?.status || person.status || "").trim();
      const code = String(person.code || "").trim();

      return {
        personId: String(person.id),
        email,
        roleLabel: groupName,
        fullName,
        groupId: normalizeKey(person.groupId || groupName),
        groupName,
        status,
        code,
      } as AttendancePerson;
    });
};

const buildMetaLists = (people: AttendancePerson[]) => {
  const groups = new Map<string, string>();

  const peopleOptions = people.map((person) => {
    const groupKey = normalizeKey(person.groupId || person.groupName) || "joined";
    const groupLabel = String(person.groupName || "Joined").trim() || "Joined";
    groups.set(groupKey, groupLabel);

    return {
      value: person.personId,
      label: `${person.fullName} ${person.email ? `(${person.email})` : ""}`.trim(),
      email: person.email,
      groupId: person.groupId,
      groupName: person.groupName,
      status: person.status,
    };
  });

  return {
    peopleOptions,
    groups: (groups.size ? Array.from(groups.entries()) : [["joined", "Joined"]]).map(([value, label]) => ({ value, label })),
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
    const groupId = normalizeKey(String(filters.groupId || "").trim());
    const status = toLower(filters.status || "all");

    const jibbleConfig = getJibbleConfig();
    let integrationConnected = Boolean(jibbleConfig);
    let integrationMessage = jibbleConfig
      ? "Jibble configurado, cargando datos..."
      : "Faltan credenciales de Jibble para traer horas reales";
    let jibblePeople: JibblePerson[] = [];

    if (jibbleConfig) {
      try {
        jibblePeople = await getJibblePeople();
        if (jibblePeople.length === 0) {
          integrationMessage = "Jibble respondió pero no devolvió personas";
        }
      } catch (error: any) {
        console.error("Error consultando Jibble People:", error);
        integrationConnected = false;
        integrationMessage = error?.message
          ? `Jibble no respondió: ${error.message}`
          : "Jibble no respondió al consultar personas";
      }
    }

    let summaries: JibbleTimesheetSummary[] = [];

    if (jibbleConfig && jibblePeople.length > 0) {
      try {
        summaries = await getJibbleTimesheetsSummary({
          from,
          to,
          personIds: jibblePeople.map((person) => String(person.id)),
        });
      } catch (error: any) {
        console.error("Error consultando Jibble TimesheetsSummary:", error);
        integrationConnected = false;
        integrationMessage = error?.message
          ? `Jibble no respondió: ${error.message}`
          : "Jibble no respondió al consultar horas";
      }
    }

    let people = buildPeople(jibblePeople, summaries);

    people = people.map((person) => {
      const summary = summaries.find((item) => String(item.personId || "") === person.personId);
      return {
        ...person,
        fullName: String(summary?.person?.fullName || person.fullName || person.email || "").trim(),
        groupName: getGroupNameFromJibble(
          jibblePeople.find((jibblePerson) => String(jibblePerson.id || "") === person.personId) || ({} as JibblePerson),
          summary
        ),
        status: String(summary?.person?.status || person.status || "").trim(),
      };
    });

    const dateRange = rangeDays(from, to);
    const rows: AttendanceRow[] = [];

    for (const person of people) {
      for (const date of dateRange) {
        const schedule = scheduleForDate(date);
        const dateKey = formatDateKey(date);
        const daily = findDaily(summaries, person.personId, dateKey);
        const actualStartTime = parseTime(daily?.firstIn || daily?.firstInTimestamp || daily?.startTime || null);
        const actualEndTime = parseTime(daily?.lastOut || daily?.lastOutTimestamp || daily?.endTime || null);
        const worked = workedMinutes(daily);
        const differenceMinutes = worked - schedule.expectedMinutes;
        const missingMinutes = Math.max(0, schedule.expectedMinutes - worked);
        const overtimeMinutes = Math.max(0, differenceMinutes);
        const statusInfo = getStatus({
          isRestDay: schedule.isRestDay,
          workedMinutes: worked,
          missingMinutes,
          overtimeMinutes,
          hasActual: Boolean(daily),
        });

        rows.push({
          id: `${person.personId}-${dateKey}`,
          personId: person.personId,
          email: person.email,
          fullName: person.fullName,
          roleLabel: person.roleLabel,
          groupId: person.groupId,
          groupName: person.groupName,
          status: person.status,
          date: dateKey,
          weekday: date.format("dddd"),
          isRestDay: schedule.isRestDay,
          expectedStartTime: null,
          expectedEndTime: null,
          actualStartTime,
          actualEndTime,
          expectedMinutes: schedule.expectedMinutes,
          workedMinutes: worked,
          differenceMinutes,
          missingMinutes,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes,
          statusKey: statusInfo.key,
          statusLabel: statusInfo.label,
          issueTags: statusInfo.tags,
          sourceStatus: daily ? "Jibble" : (jibbleConfig ? "Jibble sin datos para el rango" : "Preparado"),
          jibbleMatched: true,
          jibblePersonId: person.personId,
        });
      }
    }

    let filteredRows = rows;

    if (search) {
      filteredRows = filteredRows.filter((row) =>
        [row.fullName, row.email, row.groupName, row.status].some((value) => toLower(value).includes(search))
      );
    }

    if (personId) {
      filteredRows = filteredRows.filter((row) => row.personId === personId);
    }

    if (groupId) {
      filteredRows = filteredRows.filter((row) => normalizeKey(row.groupId || row.groupName) === groupId);
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
        acc.missingMinutes += row.missingMinutes;
        acc.overtimeMinutes += row.overtimeMinutes;
        return acc;
      },
      {
        people: new Set(filteredRows.map((row) => row.personId)).size,
        matchedPeople: new Set(filteredRows.filter((row) => row.jibbleMatched).map((row) => row.personId)).size,
        rows: 0,
        expectedMinutes: 0,
        workedMinutes: 0,
        differenceMinutes: 0,
        missingMinutes: 0,
        overtimeMinutes: 0,
      }
    );

    const metaLists = buildMetaLists(people);
    const integrationConfigured = Boolean(jibbleConfig);

    return {
      rows: paginatedRows,
      pagination: { page, pageSize, total },
      summary,
      meta: {
        configured: integrationConfigured,
        connected: integrationConnected,
        timezone: TIMEZONE,
        schedule: {
          weekday: { expectedMinutes: WEEKDAY_EXPECTED_MINUTES, label: "Lun-Vie 9h" },
          saturday: { expectedMinutes: SATURDAY_EXPECTED_MINUTES, label: "Sábado 3h" },
        },
        people: metaLists.peopleOptions,
        groups: metaLists.groups,
        integration: {
          configured: integrationConfigured,
          matchedPeople: people.length,
          unmatchedPeople: 0,
          message: integrationConfigured ? integrationMessage : integrationMessage,
        },
      },
    };
  },
};
