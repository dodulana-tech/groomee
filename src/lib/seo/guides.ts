/**
 * Answer-first price guides: the questions people type into Google and ask
 * ChatGPT ("how much are knotless braids in Abuja?"). Each guide quotes our
 * live catalogue range for its services, then explains what moves the
 * price. Copy states only what Groomee does or general, well-known facts
 * about the service; no invented statistics.
 */
export interface Guide {
  slug: string;
  /** Services whose live price range the guide quotes. */
  services: string[];
  title: string;
  /** The question, exactly as people ask it. */
  question: string;
  description: string;
  intro: string;
  factors: { name: string; detail: string }[];
  time: string;
  tips: string[];
  faqs: { q: string; a: string }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "knotless-braids-price-abuja",
    services: ["knotless-braids"],
    title: "How much do knotless braids cost in Abuja? (2026)",
    question: "How much do knotless braids cost in Abuja?",
    description: "Typical prices for knotless braids at home in Abuja, what changes the price (size, length, attachment) and how long they take.",
    intro: "Knotless braids are priced mainly by size and length: the smaller and longer the braids, the more hours they take, and time is what you pay for.",
    factors: [
      { name: "Size", detail: "Small and smedium braids take far longer than medium or large, so they cost more." },
      { name: "Length", detail: "Waist and bum length add hours over shoulder or bra-strap length." },
      { name: "Attachment", detail: "Bring your own, or the braider buys it and adds the cost. Ask for the attachment cost separately so you can compare." },
      { name: "Extras", detail: "Curly ends, colour mixing, beads or boho strands add time." },
      { name: "Timing", detail: "Same-day or late-night bookings can carry an urgency fee on top." },
    ],
    time: "Medium, shoulder-length knotless braids usually take 3 to 5 hours; small or long styles can take most of a day.",
    tips: [
      "Arrive with washed, detangled and stretched hair so the braider starts straight away.",
      "Send a photo of the exact size and length you want so the quote is accurate.",
      "Book a weekday slot during busy seasons like December; weekends fill first.",
    ],
    faqs: [
      { q: "Are knotless braids more expensive than box braids?", a: "Usually a little, because feeding in the attachment gradually takes longer than starting with a knot." },
      { q: "Is the attachment included in the price?", a: "The labour price is separate from the hair. Your braider tells you the total before they set off." },
    ],
  },
  {
    slug: "box-braids-price-abuja",
    services: ["box-braids"],
    title: "How much do box braids cost in Abuja? (2026)",
    question: "How much do box braids cost in Abuja?",
    description: "Box braids prices at home in Abuja by size and length, what affects the cost, and how to get an accurate quote.",
    intro: "Box braids cost less than knotless for the same size and length, and the price climbs as braids get smaller and longer.",
    factors: [
      { name: "Size", detail: "Jumbo and large braids are quickest; small braids take the longest." },
      { name: "Length", detail: "Longer braids need more attachment and more time." },
      { name: "Attachment", detail: "Supplied by you, or bought by the braider and added to the bill." },
      { name: "Finish", detail: "Dipped ends, beads or cuffs add a little time." },
    ],
    time: "Medium box braids typically take 2 to 4 hours.",
    tips: [
      "Ask whether the price includes take-down of old braids; that can add an hour.",
      "Keep a reference photo handy so size and length are agreed up front.",
    ],
    faqs: [
      { q: "How long do box braids last?", a: "With care, around 4 to 6 weeks. Retouching the edges can stretch that." },
    ],
  },
  {
    slug: "bridal-makeup-price-abuja",
    services: ["bridal-makeup"],
    title: "How much does bridal makeup cost in Abuja? (2026)",
    question: "How much does a bridal makeup artist cost in Abuja?",
    description: "Bridal makeup prices in Abuja for traditional and white weddings, what is included, and how to budget for your bridal party.",
    intro: "Bridal makeup is priced per look and per person: the bride's face, any change of look between ceremonies, and the bridal party each add to the total.",
    factors: [
      { name: "Number of looks", detail: "A traditional and a white wedding on the same day often means two looks." },
      { name: "Bridal party", detail: "Bridesmaids, mothers and sisters are usually priced per face." },
      { name: "Trial", detail: "A trial session before the day is booked separately." },
      { name: "Timing and location", detail: "Very early starts and venues far from the artist can add travel or early-call fees." },
    ],
    time: "A bridal look takes about 1.5 to 2 hours; plan around 45 to 60 minutes per extra face.",
    tips: [
      "Book weeks ahead for weekend weddings, and earlier still in December.",
      "Share your timeline so the artist arrives early enough for everyone.",
      "Ask what the touch-up kit includes.",
    ],
    faqs: [
      { q: "Can one artist do the whole bridal party?", a: "For a small party, yes. For larger parties we send more than one artist so you stay on schedule." },
      { q: "Is a trial worth it?", a: "Yes if you're unsure about the look. It also lets you check how the makeup lasts." },
    ],
  },
  {
    slug: "makeup-artist-price-abuja",
    services: ["full-glam-makeup", "natural-makeup"],
    title: "How much does a makeup artist cost in Abuja? (2026)",
    question: "How much does a makeup artist cost in Abuja for an event?",
    description: "What a home service makeup artist costs in Abuja for owambe, parties and shoots, from soft natural looks to full glam.",
    intro: "Event makeup in Abuja ranges from soft, natural looks to full glam with lashes. Full glam costs more because it takes longer and uses more product.",
    factors: [
      { name: "Look", detail: "Natural makeup is quicker and cheaper; full glam with lashes and contour takes longer." },
      { name: "Lashes", detail: "Strip lashes are usually included in glam; ask if you want something specific." },
      { name: "Timing", detail: "Same-day and early-morning bookings may carry an urgency fee." },
      { name: "Group bookings", detail: "Several faces in one visit are quoted per face." },
    ],
    time: "Natural makeup takes about an hour; full glam about 1.5 hours.",
    tips: [
      "Start with a clean, moisturised face.",
      "Book at least two hours before you need to leave.",
      "Share your outfit colours and a reference look.",
    ],
    faqs: [
      { q: "Can I get a makeup artist the same day?", a: "Often, yes. Message us with your area and time and we'll confirm availability, usually within the hour." },
    ],
  },
  {
    slug: "gel-nails-price-abuja",
    services: ["gel-nails", "acrylic-nails", "nail-art"],
    title: "How much do gel and acrylic nails cost in Abuja? (2026)",
    question: "How much do gel nails cost in Abuja?",
    description: "Prices for gel manicures, acrylic extensions and nail art at home in Abuja, and what changes the price.",
    intro: "A plain gel manicure is the most affordable nail service; acrylic extensions and detailed nail art cost more because they take longer.",
    factors: [
      { name: "Service", detail: "Gel polish on natural nails is quickest; acrylic or gel extensions take longer." },
      { name: "Length and shape", detail: "Long coffin or stiletto shapes take more time than short square nails." },
      { name: "Art", detail: "French tips, chrome and 3D details are priced on top." },
      { name: "Removal", detail: "Taking off old gel or acrylic adds time." },
    ],
    time: "Gel manicure about an hour; a full acrylic set about 1.5 hours or more with art.",
    tips: [
      "Send a photo of the design so the technician quotes the art accurately.",
      "Gel lasts about 2 to 3 weeks; book your next set before it starts lifting.",
    ],
    faqs: [
      { q: "Gel or acrylic: which is better?", a: "Gel polish on natural nails is lighter and quicker. Acrylic adds length and strength. Your technician can advise." },
    ],
  },
  {
    slug: "lash-extensions-price-abuja",
    services: ["classic-lash-set", "volume-lashes", "lash-lift-tint"],
    title: "How much do lash extensions cost in Abuja? (2026)",
    question: "How much do eyelash extensions cost in Abuja?",
    description: "Classic and volume lash extension prices at home in Abuja, lash lift costs, and how often you need a refill.",
    intro: "Classic lashes are the entry price; volume sets cost more because each fan is made by hand. A lash lift is a cheaper option with no extensions.",
    factors: [
      { name: "Style", detail: "Classic is one extension per lash; volume uses handmade fans and takes longer." },
      { name: "Full set or refill", detail: "Refills every 3 to 4 weeks cost less than a new full set." },
      { name: "Lift instead", detail: "A lash lift and tint curls your own lashes for about 6 to 8 weeks." },
    ],
    time: "Classic sets take about 1.5 hours; volume about 2 hours.",
    tips: [
      "Arrive with clean lashes and no mascara.",
      "Avoid water and steam for 24 hours after a new set.",
    ],
    faqs: [
      { q: "Do lash extensions damage natural lashes?", a: "Applied properly, no. Don't pull them off; let your technician remove them." },
    ],
  },
  {
    slug: "home-barber-price-abuja",
    services: ["fade-shape-up", "classic-haircut", "beard-grooming"],
    title: "How much does a home service barber cost in Abuja? (2026)",
    question: "How much does a home service barber cost in Abuja?",
    description: "Prices for a barber who comes to your home or office in Abuja: fades, haircuts, beard trims and kids' cuts.",
    intro: "A home service barber costs more than a walk-in shop because the barber travels to you, but you skip the queue and the traffic.",
    factors: [
      { name: "Cut", detail: "A simple clipper cut is quickest; skin fades and designs take longer." },
      { name: "Beard", detail: "Adding a beard trim and shape is priced on top." },
      { name: "Several people", detail: "Cutting for the whole family or several colleagues in one visit is often better value." },
    ],
    time: "Most cuts take 30 to 45 minutes.",
    tips: [
      "Book cuts for several people in one visit.",
      "Tell us if a cut is for a child so we send a barber who is good with kids.",
    ],
    faqs: [
      { q: "Can a barber come to my office?", a: "Yes, if your building allows visitors. Share the address and a time." },
    ],
  },
  {
    slug: "home-service-vs-salon-abuja",
    services: ["knotless-braids", "full-glam-makeup", "gel-nails"],
    title: "Home service or salon in Abuja: which is better value?",
    question: "Is home service beauty in Abuja worth it compared to a salon?",
    description: "Home service beauty vs going to a salon in Abuja: real costs, time saved in traffic, hygiene and when each makes sense.",
    intro: "A home service visit usually costs a little more than the same service in a salon, but the time you save on travel and waiting often outweighs the difference.",
    factors: [
      { name: "Travel and traffic", detail: "A salon trip across Abuja adds travel time and transport costs both ways, plus waiting time at busy salons." },
      { name: "Waiting", detail: "At home there's no queue; the pro starts when they arrive." },
      { name: "Comfort", detail: "Long services like braids are easier at home, with your own food and TV." },
      { name: "Groups", detail: "For bridal parties and squads, one home visit for everyone saves the most." },
    ],
    time: "You save the round trip and the wait at the salon, often an hour or more.",
    tips: [
      "Home service is best for long services (braids, bridal) and groups.",
      "Prepare a well-lit spot near a socket for the pro's tools.",
    ],
    faqs: [
      { q: "Is home service hygienic?", a: "Groomee pros sanitise their tools between clients. Ask your pro about their kit if you have concerns." },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
