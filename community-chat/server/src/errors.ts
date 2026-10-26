// Errors the chat API returns, in the same `{ error: { code, message, fields } }` shape as the rest of /api/v1.

import type { ApiErrorBody } from "../../shared/types";

export class ChatError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code: string, message: string, options: { fields?: Record<string, string>; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = "ChatError";
    this.status = status;
    this.code = code;
    this.fields = options.fields;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
        ...(this.retryAfterSeconds ? { retryAfterSeconds: this.retryAfterSeconds } : {}),
      },
    };
  }
}

export const unauthenticated = () => new ChatError(401, "unauthenticated", "Sign in to use the community.");
export const forbidden = (message: string, code = "forbidden") => new ChatError(403, code, message);
export const notFound = (message = "This resource could not be found.") => new ChatError(404, "not_found", message);
export const invalid = (fields: Record<string, string>, message = "Check the highlighted fields.") => new ChatError(422, "validation_failed", message, { fields });
