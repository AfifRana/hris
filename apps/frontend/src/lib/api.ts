import { AccessLevel } from "@/types";

type JsonBody = Record<string, unknown> | unknown[];

async function parseError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => ({}));
  // FastAPI HTTPException -> { detail }, app errors -> { error: { code, message } }
  const detail = data?.detail;
  const error = data?.error;
  let message: string | undefined;
  if (typeof detail === "string") message = detail;
  else if (Array.isArray(detail)) message = detail.map((d) => d?.msg ?? JSON.stringify(d)).join("; ");
  else if (typeof error === "string") message = error;
  else if (typeof error?.message === "string") message = error.message;
  return new Error(message || fallback);
}

export class ApiClient {
  private static getHeaders(accessLevel?: AccessLevel, userId: string = "user_001"): Record<string, string> {
    return {
      "x-user-id": userId,
      "x-access-level": accessLevel || "EMPLOYEE",
    };
  }

  private static async request<T>(
    method: string,
    path: string,
    accessLevel: AccessLevel | undefined,
    userId: string | undefined,
    body?: JsonBody | FormData
  ): Promise<T> {
    const headers = this.getHeaders(accessLevel, userId);
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const res = await fetch(`/api/proxy/${path}`, { method, headers, body: payload });
    if (!res.ok) {
      throw await parseError(res, `Request failed with status ${res.status}`);
    }
    return res.json();
  }

  static get<T>(path: string, accessLevel?: AccessLevel, userId?: string): Promise<T> {
    return this.request<T>("GET", path, accessLevel, userId);
  }

  static post<T>(path: string, body?: JsonBody, accessLevel?: AccessLevel, userId?: string): Promise<T> {
    return this.request<T>("POST", path, accessLevel, userId, body);
  }

  static put<T>(path: string, body?: JsonBody, accessLevel?: AccessLevel, userId?: string): Promise<T> {
    return this.request<T>("PUT", path, accessLevel, userId, body);
  }

  static upload<T>(path: string, formData: FormData, accessLevel?: AccessLevel, userId?: string): Promise<T> {
    return this.request<T>("POST", path, accessLevel, userId, formData);
  }
}
