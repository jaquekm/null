export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const fail = (
  error: string,
  fieldErrors?: Record<string, string[]>,
): Result<never> => ({
  ok: false,
  error,
  fieldErrors,
});
