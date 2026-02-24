// Temporary augmentation so TypeScript recognizes subscription models not in the generated client types.
import { PrismaClient } from "@prisma/client";

declare module "@prisma/client" {
  interface PrismaClient {
    subscription: any;
    subscriptionPlan: any;
    referral: any;
    favouriteGroomer: any;
    payout: any;
    giftCard: any;
    groomerAdvance: any;
    groomerCreditEvent: any;
    beautyProfile: any;
    strike: any;
  }
}
