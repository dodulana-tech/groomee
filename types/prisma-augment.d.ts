// Temporary augmentation so TypeScript recognizes models not yet in the generated client types.
import { PrismaClient } from "@prisma/client";

declare module "@prisma/client" {
  interface PrismaClient {
    subscription: any;
    subscriptionPlan: any;
    referral: any;
    favouritePro: any;
    payout: any;
    giftCard: any;
    proAdvance: any;
    proCreditEvent: any;
    beautyProfile: any;
    strike: any;
    dispatchLog: any;
    surveyResponse: any;
    waitlist: any;
    pointsLedger: any;
  }
}
