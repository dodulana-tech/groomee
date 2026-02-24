import type {
  User,
  Groomer,
  Service,
  Zone,
  Booking,
  Payment,
  Dispute,
  Review,
  Earning,
  Notification,
  BookingStatus,
  GroomerStatus,
  GroomerAvail,
  PaymentStatus,
  DisputeStatus,
  ServiceCategory,
} from "@prisma/client";

// Re-export Prisma types
export type {
  User,
  Groomer,
  Service,
  Zone,
  Booking,
  Payment,
  Dispute,
  Review,
  Earning,
  Notification,
  BookingStatus,
  GroomerStatus,
  GroomerAvail,
  PaymentStatus,
  DisputeStatus,
  ServiceCategory,
};

// ─── ENRICHED TYPES ──────────────────────────────────────────────────────────

export type GroomerWithServices = Groomer & {
  services: Array<{
    service: Service;
    customPrice: number | null;
  }>;
  zones: Array<{
    zone: Zone;
  }>;
};

export type BookingWithRelations = Booking & {
  customer: Pick<User, "id" | "name" | "phone">;
  groomer: Groomer | null;
  service: Service;
  zone: Zone | null;
  payment: Payment | null;
  dispute: Dispute | null;
  review: Review | null;
};

export type BookingFull = BookingWithRelations & {
  groomer: GroomerWithServices | null;
};

// ─── SESSION / AUTH ───────────────────────────────────────────────────────────

export interface SessionPayload {
  userId: string;
  phone: string;
  role: "CUSTOMER" | "ADMIN";
  iat: number;
  exp: number;
}

// ─── API RESPONSE SHAPES ──────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── BOOKING CREATION ─────────────────────────────────────────────────────────

export interface CreateBookingInput {
  serviceId: string;
  address: string;
  addressExtra?: string;
  latitude?: number;
  longitude?: number;
  isAsap: boolean;
  scheduledFor?: string; // ISO date string
  customerNotes?: string;
  zoneId?: string;
}

// ─── SURCHARGE RESULT ─────────────────────────────────────────────────────────

export interface SurchargeResult {
  type: "emergency" | "latenight" | "earlymorning" | "surge" | null;
  rate: number;
  amount: number;
  label: string | null;
}

// ─── DISPATCH ─────────────────────────────────────────────────────────────────

export interface DispatchAttempt {
  groomerId: string;
  groomerName: string;
  offeredAt: string;
  response: "accepted" | "declined" | "timeout" | null;
  respondedAt?: string;
}

// ─── ADMIN STATS ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  todayRevenue: number;
  activeBookings: number;
  groomersOnline: number;
  openDisputes: number;
  weeklyBookings: { day: string; count: number; revenue: number }[];
  recentBookings: BookingWithRelations[];
  groomerAvailability: Array<{
    groomer: Groomer;
    availability: GroomerAvail;
    currentJob: string | null;
  }>;
}

// ─── PAYSTACK ─────────────────────────────────────────────────────────────────

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    authorization: {
      authorization_code: string;
      card_type: string;
      last4: string;
    };
    customer: {
      email: string;
      phone: string;
    };
  };
}

export interface GroomerCreditScore {
  score: number; // 0–850
  tier: "bronze" | "silver" | "gold" | "platinum";
  completedJobs: number;
  avgRating: number;
  monthsActive: number;
  onTimeRate: number;
  advanceEligible: boolean;
  maxAdvanceAmount: number;
  events: Array<{ date: string; description: string; points: number }>;
}

export interface SubscriptionWithPlan {
  plan: any;
  usages: any[];
  [key: string]: any;
}
