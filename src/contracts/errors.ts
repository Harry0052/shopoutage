export const ERROR_CATEGORIES = [
  "malformed",
  "schema",
  "bounds",
  "unsupported_value",
  "boundary"
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/**
 * A fixture or report failed validation. `mutated` is always false: validation
 * and the boundary check finish before any adapter write.
 */
export class FixtureError extends Error {
  readonly category: ErrorCategory;
  readonly field: string;
  readonly mutated = false as const;

  constructor(category: ErrorCategory, field: string, message: string) {
    super(message);
    this.name = "FixtureError";
    this.category = category;
    this.field = field;
  }
}

export function formatFixtureError(error: FixtureError): string {
  return `${error.category}: ${error.message} No data was mutated.`;
}
