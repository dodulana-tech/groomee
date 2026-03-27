import type { BookingStatus } from "@prisma/client";

/**
 * Valid booking status transitions.
 * If a transition is not listed here, it is not allowed.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["DISPATCHING", "CANCELLED"],
  DISPATCHING: ["ACCEPTED", "NO_GROOMER", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["IN_SERVICE"],
  IN_SERVICE: ["COMPLETED"],
  COMPLETED: ["CONFIRMED", "DISPUTED"],
  NO_GROOMER: ["DISPATCHING", "CANCELLED"], // admin can retry dispatch
};

export function canTransition(
  from: string,
  to: string,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Statuses that allow cancellation.
 */
export const CANCELLABLE_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "DISPATCHING",
  "ACCEPTED",
  "EN_ROUTE",
];

/**
 * Statuses that allow pro assignment.
 */
export const ASSIGNABLE_STATUSES: BookingStatus[] = [
  "DISPATCHING",
  "NO_GROOMER",
];
