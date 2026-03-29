/**
 * Extracts a human-readable error message from a failed fetch Response.
 * Expects the backend to return { success: false, message: string | string[] }.
 */
export async function extractApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message) && body.message.length > 0)
      return body.message.join(', ');
  } catch {
    // ignore parse errors
  }
  return fallback;
}

/**
 * Extracts a human-readable error message from an axios error.
 * Expects the backend to return { success: false, message: string | string[] }.
 */
export function extractAxiosError(error: unknown, fallback: string): string {
  try {
    const axiosError = error as {
      response?: { data?: { message?: string | string[] } };
    };
    const message = axiosError?.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.length > 0)
      return message.join(', ');
  } catch {
    // ignore
  }
  return fallback;
}
