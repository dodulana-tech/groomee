/**
 * Curated landing-page content: one entry per service and per area we want
 * Google and AI assistants to find. Slugs match the services / zones tables
 * so live prices and pro counts can be joined in; the copy here is what
 * makes each page worth ranking (no thin, templated pages).
 *
 * Prices here are fallbacks only — pages prefer the live catalogue.
 */
import type { ServiceCategory } from "@prisma/client";

export type CitySlug = "lagos" | "abuja";

export interface SeoService {
  slug: string;
  name: string;
  category: ServiceCategory;
  /** Search phrase people use, e.g. "Knotless braids at home". */
  headline: string;
  intro: string;
  included: string[];
  prep: string[];
  faqs: { q: string; a: string }[];
  fallback: { min: number; max: number; mins: number };
}

export interface SeoArea {
  slug: string;
  name: string;
  city: CitySlug;
  nearby: string[];
  blurb: string;
}

export const CITY_NAME: Record<CitySlug, string> = { lagos: "Lagos", abuja: "Abuja" };

/** Abuja takes bookings now; Lagos is coming soon (requests join a launch list). */
export const LIVE_CITY: CitySlug = "abuja";
export const COMING_SOON: Record<CitySlug, boolean> = { lagos: true, abuja: false };

export const CATEGORY_LABEL: Record<string, string> = {
  HAIR: "Hair & braids",
  MAKEUP: "Makeup",
  NAILS: "Nails",
  BARBING: "Barbing",
  LASHES: "Lashes",
  SKINCARE: "Skincare",
  OTHER: "More",
};

export const SERVICES: SeoService[] = [
  {
    slug: "knotless-braids",
    name: "Knotless Braids",
    category: "HAIR",
    headline: "Knotless braids at home",
    intro:
      "Knotless braids start with your own hair at the root, so there is less tension and a flatter, more natural finish than classic box braids. A vetted Groomee braider comes to your home with the tools; you choose the size, length and attachment.",
    included: [
      "Parting and sectioning to your chosen size",
      "Braiding with your attachment, ends sealed",
      "Edges laid on request",
      "Tidy-up of the space afterwards",
    ],
    prep: [
      "Wash, detangle and blow-dry your hair before the pro arrives",
      "Tell us the size and length you want so the pro brings enough time",
      "Attachment can be supplied by you or bought by the pro and added to the bill",
    ],
    faqs: [
      { q: "How long do knotless braids take at home?", a: "Medium, shoulder-length knotless braids usually take 3 to 5 hours. Smaller or longer braids take longer, so share a photo of the style when you message us." },
      { q: "How long do knotless braids last?", a: "With a satin scarf at night and light oiling of the scalp, most clients keep them 4 to 6 weeks." },
    ],
    fallback: { min: 12000, max: 25000, mins: 180 },
  },
  {
    slug: "box-braids",
    name: "Box Braids",
    category: "HAIR",
    headline: "Box braids at home",
    intro:
      "Classic box braids in small, medium or jumbo sizes, done in your home by a vetted braider. A protective style that lasts weeks and works with any attachment colour.",
    included: [
      "Sectioning into even boxes",
      "Braiding with your attachment, ends dipped or sealed",
      "Optional beads or cuffs you provide",
    ],
    prep: [
      "Arrive with clean, stretched hair",
      "Share a reference photo for size and length",
    ],
    faqs: [
      { q: "What is the difference between box braids and knotless braids?", a: "Box braids start with a small knot of attachment at the root, which gives a fuller root but more tension. Knotless braids feed the attachment in gradually and are gentler on the scalp." },
      { q: "Do I need to buy the attachment?", a: "You can supply it, or the pro can buy it on the way and add the cost to your bill. Tell us your preference when you book." },
    ],
    fallback: { min: 10000, max: 20000, mins: 150 },
  },
  {
    slug: "locs-styling",
    name: "Locs Styling",
    category: "HAIR",
    headline: "Loc retwist and styling at home",
    intro:
      "Retwists, interlocking and loc styles from a pro who comes to you. Ideal for keeping your locs neat between salon visits without losing half a day in traffic.",
    included: ["Wash on request", "Retwist or interlock of new growth", "Styling of your choice"],
    prep: ["Tell us how many locs you have and when you last retwisted", "Have your preferred products ready if you are particular about them"],
    faqs: [
      { q: "How often should I retwist my locs?", a: "Most people retwist every 4 to 6 weeks. Retwisting too often can thin the roots." },
    ],
    fallback: { min: 6000, max: 15000, mins: 90 },
  },
  {
    slug: "weave-installation",
    name: "Weave Installation",
    category: "HAIR",
    headline: "Weave and wig installation at home",
    intro:
      "Sew-in weaves and closures installed in your home by a vetted stylist, with cornrow base and blending included.",
    included: ["Cornrow base", "Sew-in of your bundles or closure", "Cut and blend to shape"],
    prep: ["Have your bundles or closure ready", "Wash and dry your natural hair beforehand"],
    faqs: [
      { q: "Can the stylist also install a frontal or wig?", a: "Yes. Mention frontal or wig install when you message us so we match you with a stylist who does it regularly." },
    ],
    fallback: { min: 15000, max: 35000, mins: 120 },
  },
  {
    slug: "natural-hair-styling",
    name: "Natural Hair Styling",
    category: "HAIR",
    headline: "Natural hair styling at home",
    intro:
      "Wash, condition and style for natural hair: twist-outs, puffs, cornrows and silk presses, done gently at home.",
    included: ["Wash and deep condition", "Detangling", "Styling of your choice"],
    prep: ["Let us know your hair type and the style you want"],
    faqs: [
      { q: "Do your stylists use heat on natural hair?", a: "Only if you ask. Tell us if you prefer heat-free styling and the pro will plan for it." },
    ],
    fallback: { min: 6000, max: 15000, mins: 60 },
  },
  {
    slug: "full-glam-makeup",
    name: "Full Glam Makeup",
    category: "MAKEUP",
    headline: "Makeup artist at home for events",
    intro:
      "Full glam for weddings as a guest, birthdays, shoots and owambe. A vetted makeup artist comes to you with a professional kit, so you get ready at home instead of in traffic.",
    included: ["Skin prep", "Full face with lashes", "Setting for long wear", "Quick touch-up before you leave"],
    prep: ["Start with a clean, moisturised face", "Share your outfit colour and a reference look", "Book at least 2 hours before you need to leave"],
    faqs: [
      { q: "Can I get a makeup artist to my home the same day?", a: "Often, yes. Message us with your location and time; same-day requests in our main areas are usually confirmed within the hour." },
      { q: "Do I need to provide lashes?", a: "No. Strip lashes are part of the kit. Bring your own if you have a favourite pair." },
    ],
    fallback: { min: 20000, max: 50000, mins: 90 },
  },
  {
    slug: "natural-makeup",
    name: "Natural Makeup",
    category: "MAKEUP",
    headline: "Soft natural makeup at home",
    intro:
      "Soft, skin-first makeup for work events, interviews, dates and everyday glow, done at home by a vetted artist.",
    included: ["Skin prep", "Light base and concealer", "Soft eyes, brows and lips"],
    prep: ["Clean, moisturised skin", "A reference photo helps"],
    faqs: [
      { q: "How long does natural makeup take?", a: "About 45 minutes to an hour." },
    ],
    fallback: { min: 12000, max: 25000, mins: 60 },
  },
  {
    slug: "bridal-makeup",
    name: "Bridal Makeup",
    category: "MAKEUP",
    headline: "Bridal makeup artist in your home",
    intro:
      "Bridal makeup for traditional and white weddings, done where you are getting ready. Your artist arrives early, works to your timeline and leaves you with a touch-up kit.",
    included: ["Consultation on your look", "Long-wear bridal face with lashes", "Touch-up kit", "Optional bridesmaids and family on the same visit"],
    prep: ["Book a trial if you can", "Share your wedding timeline and venue", "Tell us how many people need makeup"],
    faqs: [
      { q: "How early should I book bridal makeup?", a: "As early as you can, ideally 4 or more weeks ahead for weekend weddings. Message us your date and we will hold an artist." },
      { q: "Can the artist do my bridal party too?", a: "Yes. Tell us the number of people and we will send enough artists to keep to your schedule." },
    ],
    fallback: { min: 35000, max: 80000, mins: 120 },
  },
  {
    slug: "gel-nails",
    name: "Gel Nails",
    category: "NAILS",
    headline: "Gel nails at home",
    intro:
      "Gel manicures that stay glossy for weeks, done at home by a vetted nail technician with a portable lamp and sanitised tools.",
    included: ["Nail prep and cuticle care", "Gel polish in your colour", "Cured under a UV/LED lamp"],
    prep: ["Remove old gel if you can, or ask the tech to (small extra charge)"],
    faqs: [
      { q: "How long do gel nails last?", a: "Usually 2 to 3 weeks without chipping." },
      { q: "Are the tools sanitised?", a: "Yes. Our nail technicians sanitise metal tools between clients and use fresh files and buffers." },
    ],
    fallback: { min: 6000, max: 15000, mins: 60 },
  },
  {
    slug: "acrylic-nails",
    name: "Acrylic Nails",
    category: "NAILS",
    headline: "Acrylic nails at home",
    intro:
      "Full-set acrylic extensions in your choice of shape and length, done at home by a vetted nail technician.",
    included: ["Nail prep", "Tips and acrylic overlay", "Shaping and finish in gel or polish"],
    prep: ["Pick a shape and length, and share a reference photo"],
    faqs: [
      { q: "How long does a full set of acrylics take?", a: "About 90 minutes, longer for long lengths or detailed art." },
    ],
    fallback: { min: 10000, max: 20000, mins: 90 },
  },
  {
    slug: "nail-art",
    name: "Nail Art",
    category: "NAILS",
    headline: "Custom nail art at home",
    intro: "Custom designs, French tips, chrome and 3D details from nail technicians who come to you.",
    included: ["Design consultation", "Hand-painted or applied art", "Gel top coat"],
    prep: ["Send a picture of the design you want when you book"],
    faqs: [
      { q: "Can you copy a design from Instagram or Pinterest?", a: "Yes. Send the picture with your booking so we match you with a technician who does that style." },
    ],
    fallback: { min: 8000, max: 18000, mins: 75 },
  },
  {
    slug: "fade-shape-up",
    name: "Fade & Shape-up",
    category: "BARBING",
    headline: "Home barber: fade and shape-up",
    intro:
      "A clean skin fade or taper with a sharp line-up, from a vetted barber who comes to your home or office with sanitised clippers.",
    included: ["Fade or taper of your choice", "Line-up and shape-up", "Clean-up of hair afterwards"],
    prep: ["Tell us your usual style or share a photo"],
    faqs: [
      { q: "Can a barber come to my office?", a: "Yes, if your building allows it. Share the address and a convenient time." },
    ],
    fallback: { min: 3000, max: 8000, mins: 45 },
  },
  {
    slug: "classic-haircut",
    name: "Classic Haircut",
    category: "BARBING",
    headline: "Home haircut by a vetted barber",
    intro: "Scissor and clipper cuts for men and boys, done at home. Popular for kids and for busy professionals.",
    included: ["Cut to your style", "Neck and edge tidy", "Clean-up afterwards"],
    prep: ["Let us know if the cut is for a child"],
    faqs: [
      { q: "Do you cut children's hair?", a: "Yes. Tell us the child's age so we send a barber who is good with kids." },
    ],
    fallback: { min: 2500, max: 6000, mins: 30 },
  },
  {
    slug: "beard-grooming",
    name: "Beard Grooming",
    category: "BARBING",
    headline: "Beard trim and grooming at home",
    intro: "Beard trim, shaping and hot towel finish from a barber who comes to you.",
    included: ["Trim and shape", "Line-up", "Hot towel finish"],
    prep: [],
    faqs: [
      { q: "Can I combine a beard trim with a haircut?", a: "Yes. Ask for both in one visit when you message us." },
    ],
    fallback: { min: 2500, max: 5000, mins: 30 },
  },
  {
    slug: "classic-lash-set",
    name: "Classic Lash Set",
    category: "LASHES",
    headline: "Classic lash extensions at home",
    intro: "One extension per natural lash for a natural, defined look, applied at home by a vetted lash technician.",
    included: ["Lash mapping", "Classic extensions", "Aftercare advice"],
    prep: ["Come with clean lashes and no mascara", "Avoid caffeine before so you can relax with eyes closed"],
    faqs: [
      { q: "How long do lash extensions last?", a: "Around 3 to 4 weeks before a refill, depending on your natural lash cycle." },
    ],
    fallback: { min: 10000, max: 20000, mins: 90 },
  },
  {
    slug: "volume-lashes",
    name: "Volume Lashes",
    category: "LASHES",
    headline: "Volume lash extensions at home",
    intro: "Russian volume fans for a fuller, fluffier look, applied in your home.",
    included: ["Lash mapping", "Handmade volume fans", "Aftercare advice"],
    prep: ["Clean lashes, no mascara"],
    faqs: [
      { q: "Classic or volume: which should I choose?", a: "Classic looks natural and defined; volume looks fuller and more dramatic. Your technician can advise based on your natural lashes." },
    ],
    fallback: { min: 15000, max: 30000, mins: 120 },
  },
  {
    slug: "lash-lift-tint",
    name: "Lash Lift & Tint",
    category: "LASHES",
    headline: "Lash lift and tint at home",
    intro: "A keratin lift and tint that curls and darkens your natural lashes for weeks, with no extensions.",
    included: ["Lift", "Tint", "Keratin treatment"],
    prep: ["Keep lashes dry for 24 hours afterwards"],
    faqs: [
      { q: "How long does a lash lift last?", a: "About 6 to 8 weeks." },
    ],
    fallback: { min: 8000, max: 15000, mins: 60 },
  },
  {
    slug: "facial-treatment",
    name: "Facial Treatment",
    category: "SKINCARE",
    headline: "Facial at home",
    intro: "A deep-cleansing facial with extractions, done at home by a vetted skincare professional.",
    included: ["Cleanse and exfoliate", "Extractions", "Mask and moisturise"],
    prep: ["Tell us about any skin conditions or products you react to"],
    faqs: [
      { q: "Is a home facial safe for sensitive skin?", a: "Yes. Tell us about your skin when you book; your pro will patch-test and adjust products." },
    ],
    fallback: { min: 12000, max: 25000, mins: 60 },
  },
  {
    slug: "glow-treatment",
    name: "Glow Treatment",
    category: "SKINCARE",
    headline: "Glow facial at home",
    intro: "A brightening facial for dull or uneven skin, popular before events and photoshoots.",
    included: ["Cleanse and exfoliate", "Brightening mask", "Hydration and SPF"],
    prep: ["Book 1 to 3 days before an event for the best glow"],
    faqs: [
      { q: "How soon before an event should I get a glow facial?", a: "One to three days before gives the best result." },
    ],
    fallback: { min: 15000, max: 35000, mins: 75 },
  },
];

export const AREAS: SeoArea[] = [
  { slug: "lekki-phase-1", name: "Lekki Phase 1", city: "lagos", nearby: ["Admiralty Way", "Oniru", "Ikate"], blurb: "Lekki Phase 1 is one of our busiest areas, with pros based on the Lekki axis who can reach you quickly." },
  { slug: "victoria-island", name: "Victoria Island", city: "lagos", nearby: ["Adeola Odeku", "Ajose Adeogun", "Oniru"], blurb: "Home, hotel and office visits across Victoria Island, popular for event makeup and lunchtime grooming." },
  { slug: "ikoyi", name: "Ikoyi", city: "lagos", nearby: ["Banana Island", "Parkview", "Old Ikoyi"], blurb: "Discreet home visits across Ikoyi, including estates with gate access. Share your estate rules when you book." },
  { slug: "ikeja", name: "Ikeja", city: "lagos", nearby: ["Ikeja GRA", "Allen Avenue", "Opebi", "Maryland"], blurb: "Mainland coverage across Ikeja, so you skip the trip to the Island for a good stylist." },
  { slug: "surulere", name: "Surulere", city: "lagos", nearby: ["Adeniran Ogunsanya", "Bode Thomas", "Aguda"], blurb: "Pros based on the mainland serve Surulere homes most days of the week." },
  { slug: "yaba", name: "Yaba", city: "lagos", nearby: ["Sabo", "Akoka", "Onike", "Ebute Metta"], blurb: "Student-friendly and professional services across Yaba, with quick barbing and nails slots." },
  { slug: "gbagada", name: "Gbagada", city: "lagos", nearby: ["Gbagada Phase 1", "Gbagada Phase 2", "Ifako", "Anthony"], blurb: "Home visits across Gbagada and nearby, convenient for both Island and Mainland commuters." },
  { slug: "ajah", name: "Ajah", city: "lagos", nearby: ["Abraham Adesanya", "Sangotedo", "Badore", "Thomas Estate"], blurb: "Coverage along the Lekki-Epe axis around Ajah, so you don't have to battle traffic into Lekki." },
  { slug: "wuse", name: "Wuse", city: "abuja", nearby: ["Wuse 2", "Zone 4", "Zone 6"], blurb: "Home and office visits across Wuse, booked by our team on WhatsApp." },
  { slug: "maitama", name: "Maitama", city: "abuja", nearby: ["Maitama District"], blurb: "Discreet home visits in Maitama for event makeup, braids and grooming." },
  { slug: "asokoro", name: "Asokoro", city: "abuja", nearby: ["Asokoro", "Guzape"], blurb: "Home visits across Asokoro, including estates with gate access." },
  { slug: "garki", name: "Garki", city: "abuja", nearby: ["Area 11", "Garki 2", "Area 1"], blurb: "Pros serving Garki homes and offices, booked over WhatsApp." },
  { slug: "jabi", name: "Jabi", city: "abuja", nearby: ["Jabi Lake", "Utako"], blurb: "Home visits around Jabi for hair, makeup and nails." },
  { slug: "gudu", name: "Gudu", city: "abuja", nearby: ["Apo", "Gudu"], blurb: "Coverage around Gudu and Apo for home beauty services." },
  { slug: "gwarinpa", name: "Gwarinpa", city: "abuja", nearby: ["Gwarinpa Estate", "Life Camp"], blurb: "Home visits across Gwarinpa and Life Camp." },
  { slug: "utako", name: "Utako", city: "abuja", nearby: ["Utako", "Jabi"], blurb: "Home and office visits around Utako." },
];

/** Questions every page answers, phrased the way people ask assistants. */
export const COMMON_FAQS: { q: string; a: string }[] = [
  { q: "How do I book a Groomee beauty pro?", a: "Message us on WhatsApp with the service, your area and a time. We match you with a vetted pro, confirm the price, and they come to you. You can also book online on groomeeapp.com." },
  { q: "Are Groomee pros vetted?", a: "Yes. Our team reviews every pro's identity and past work before they can take bookings, and customers rate them after each job. Pros who fall below our standards are removed." },
  { q: "How much does it cost?", a: "Each service page shows a typical price range. Your pro confirms the final price before they set off, based on the exact style, length and any extras." },
  { q: "How do I pay?", a: "Pay securely through Groomee by card or bank transfer. Your pro confirms the price before they set off, so there are no surprises." },
  { q: "Can I book for the same day?", a: "Often, yes. Same-day and urgent requests in our main areas are usually confirmed within the hour when you message us on WhatsApp." },
];

export function serviceBySlug(slug: string) {
  return SERVICES.find((s) => s.slug === slug);
}

export function areaBySlug(city: CitySlug, slug: string) {
  return AREAS.find((a) => a.city === city && a.slug === slug);
}

export function areasIn(city: CitySlug) {
  return AREAS.filter((a) => a.city === city);
}
