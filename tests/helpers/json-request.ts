export function jsonRequest(
  url: string,
  body: unknown,
  init: RequestInit = {},
): Request {
  return new Request(url, {
    method: init.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
}

export function invalidJsonRequest(url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ not valid json",
  });
}

export async function readJsonResponse(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}
