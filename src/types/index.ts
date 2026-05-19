import type {
  User,
  Pro,
  Service,
  Zone,
  Booking,
  Payment,
  Dispute,
  Review,
  Earning,
  Notification,
  BookingStatus,
  ProStatus,
  ProAvail,
  PaymentStatus,
  DisputeStatus,
  ServiceCategory,
} from "@prisma/client";

// Re-export Prisma types
export type {
  User,
  Pro,
  Service,
  Zone,
  Booking,
  Payment,
  Dispute,
  Review,
  Earning,
  Notification,
  BookingStatus,
  ProStatus,
  ProAvail,
  PaymentStatus,
  DisputeStatus,
  ServiceCategory,
};

// ─── ENRICHED TYPES ──────────────────────────────────────────────────────────

export type ProWithServices = Pro & {
  services: Array<{
    service: Service;
    customPrice: number | null;
  }>;
  zones: Array<{
    zone: Zone;
  }>;
  reviews?: Review[];
};

export type BookingWithRelations = Booking & {
  customer: Pick<User, "id" | "name" | "phone">;
  pro: Pro | null;
  service: Service;
  // Additional services chained to the booking (multi-service). Empty for
  // single-service bookings.
  items?: Array<{
    id: string;
    serviceId: string;
    customPrice: number | null;
    durationMins: number;
    sortOrder: number;
    service: Pick<Service, "id" | "name" | "durationMins">;
  }>;
  zone: Zone | null;
  payment: Payment | null;
  dispute: Dispute | null;
  review: Review | null;
};

export type BookingFull = BookingWithRelations & {
  pro: ProWithServices | null;
};

// ─── SESSION / AUTH ───────────────────────────────────────────────────────────

export interface SessionPayload {
  userId: string;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN" | "PRO";
  adminRoleId?: string;
  adminRoleName?: string;
  permissions?: string[];
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
  proId: string;
  proName: string;
  offeredAt: string;
  response: "accepted" | "declined" | "timeout" | null;
  respondedAt?: string;
}

// ─── ADMIN STATS ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  todayRevenue: number;
  activeBookings: number;
  prosOnline: number;
  openDisputes: number;
  weeklyBookings: { day: string; count: number; revenue: number }[];
  recentBookings: BookingWithRelations[];
  proAvailability: Array<{
    pro: Pro;
    availability: ProAvail;
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

export interface ProCreditScore {
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
