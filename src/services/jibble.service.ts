type JibbleConfig = {
  identityUrl: string;
  workspaceUrl: string;
  timeAttendanceUrl: string;
  timeTrackingUrl: string;
  clientId: string;
  clientSecret: string;
};

type JibbleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

export type JibblePerson = {
  id: string;
  fullName?: string;
  email?: string;
  groupId?: string;
  group?: unknown;
  role?: string;
  status?: string;
  code?: string;
  latestTimeEntryTime?: string;
};

export type JibbleSummaryDaily = {
  date?: string;
  firstIn?: string;
  lastOut?: string;
  firstInTimestamp?: string;
  lastOutTimestamp?: string;
  startTime?: string;
  endTime?: string;
  tracked?: number | string;
  regular?: number | string;
  overtime?: number | string;
  trackedHours?: {
    total?: number | string;
    worked?: number | string;
    totalBreakTime?: number | string;
    paidBreakTime?: number | string;
    unpaidBreakTime?: number | string;
    totalAutoDeductionTime?: number | string;
    breaks?: unknown[];
    autoDeductions?: unknown[];
  };
  payrollHours?: {
    total?: number | string;
    billing?: number | string;
    regular?: number | string;
    dailyOvertime?: number | string;
    dailyDoubleOvertime?: number | string;
    restDayOvertime?: number | string;
    publicHolidayOvertime?: number | string;
  };
};

export type JibbleTimesheetSummary = {
  personId?: string;
  total?: number | string;
  totalTracked?: number | string;
  totalPayroll?: number | string;
  weeklyOvertime?: number | string;
  person?: {
    id?: string;
    fullName?: string;
    pictureUrl?: string;
    groupName?: string;
    code?: string;
    managers?: unknown;
    positionName?: string;
    timeZone?: string;
    status?: string;
    billableRate?: number | string;
  };
  daily?: JibbleSummaryDaily[];
};

let cachedToken: { value: string; expiresAt: number } | null = null;

const getConfig = (): JibbleConfig | null => {
  const clientId = String(process.env.JIBBLE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.JIBBLE_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    identityUrl: String(process.env.JIBBLE_IDENTITY_URL || "https://identity.prod.jibble.io").trim(),
    workspaceUrl: String(process.env.JIBBLE_WORKSPACE_URL || "https://workspace.prod.jibble.io").trim(),
    timeAttendanceUrl: String(process.env.JIBBLE_TIME_ATTENDANCE_URL || "https://time-attendance.prod.jibble.io").trim(),
    timeTrackingUrl: String(process.env.JIBBLE_TIME_TRACKING_URL || "https://time-tracking.prod.jibble.io").trim(),
    clientId,
    clientSecret,
  };
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const fetchFn = globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("Fetch no disponible en el entorno del servidor");
  }

  const response = await fetchFn(url, init);
  const text = await response.text();
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = text ? (isJson ? JSON.parse(text) : text) : null;

  if (!response.ok) {
    const payloadMessage = (() => {
      if (typeof payload === "string") return payload;
      if (payload && typeof payload === "object") {
        const errorDescription = (payload as any).error_description;
        const error = (payload as any).error;
        const message = (payload as any).message;
        const details = (payload as any).details;
        if (typeof errorDescription === "string" && errorDescription.trim()) return errorDescription;
        if (typeof error === "string" && error.trim()) return error;
        if (typeof message === "string" && message.trim()) return message;
        if (typeof details === "string" && details.trim()) return details;
        return JSON.stringify(payload);
      }
      return null;
    })();

    const message = payloadMessage || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
};

const getAccessToken = async (config: JibbleConfig): Promise<string | null> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);

  const tokenResponse = await fetchJson<JibbleTokenResponse>(`${config.identityUrl}/connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const token = String(tokenResponse.access_token || "").trim();
  if (!token) {
    return null;
  }

  cachedToken = {
    value: token,
    expiresAt: Date.now() + Number(tokenResponse.expires_in || 3600) * 1000,
  };

  return token;
};

const buildAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
});

const unwrapOData = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.value)) return payload.value as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  return [];
};

const ODATA_PAGE_SIZE = 1000;

export const getJibbleConfig = () => getConfig();

export const getJibblePeople = async (): Promise<JibblePerson[]> => {
  const config = getConfig();
  if (!config) return [];

  const token = await getAccessToken(config);
  if (!token) return [];

  const people: JibblePerson[] = [];
  let skip = 0;

  while (true) {
    const params = new URLSearchParams();
  params.set("$select", "id,fullName,email,groupId,group,role,status,code,latestTimeEntryTime");
    params.set("$top", String(ODATA_PAGE_SIZE));
    if (skip > 0) {
      params.set("$skip", String(skip));
    }

    const payload = await fetchJson<any>(`${config.workspaceUrl}/v1/People?${params.toString()}`, {
      method: "GET",
      headers: buildAuthHeaders(token),
    });

    const page = unwrapOData<JibblePerson>(payload).filter((person) => Boolean(person?.id));
    people.push(...page);

    if (page.length < ODATA_PAGE_SIZE) {
      break;
    }

    skip += ODATA_PAGE_SIZE;

    if (skip > 10_000) {
      break;
    }
  }

  return people;
};

export const getJibbleTimesheetsSummary = async (params: {
  from: string;
  to: string;
  personIds: string[];
}): Promise<JibbleTimesheetSummary[]> => {
  const config = getConfig();
  if (!config || params.personIds.length === 0) return [];

  const token = await getAccessToken(config);
  if (!token) return [];

  const query = new URLSearchParams();
  query.set("period", "Custom");
  query.set("date", params.from);
  query.set("endDate", params.to);
  for (const personId of params.personIds) {
    query.append("personIds", personId);
  }

  const payload = await fetchJson<any>(`${config.timeAttendanceUrl}/v1/TimesheetsSummary?${query.toString()}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  return unwrapOData<JibbleTimesheetSummary>(payload).filter((item) => Boolean(item?.personId));
};
