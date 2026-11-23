import { LIMITS } from "./limits.js";
import { FixtureError } from "./errors.js";

/**
 * Convert a decimal major-unit string to integer minor units.
 * Scale is 100 (two fractional digits). "5.00" and "5" both become 500.
 * Binary floating point is not used.
 */
export function decimalToMinorUnits(value: string, field: string): number {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new FixtureError(
      "unsupported_value",
      field,
      `${field} must be a non-negative decimal string with at most 2 fractional digits (simulated major units).`
    );
  }
  const [whole, frac = ""] = value.split(".");
  const minor = Number(whole) * LIMITS.minorUnitScale + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > LIMITS.maxUnitPriceCents) {
    throw new FixtureError(
      "bounds",
      field,
      `${field} exceeds ${LIMITS.maxUnitPriceCents} minor units.`
    );
  }
  return minor;
}
