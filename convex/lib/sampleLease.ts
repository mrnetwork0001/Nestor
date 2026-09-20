import type { LeaseFlag, RiskLevel } from "./validators";

/*
 * The bundled demo lease: a fictional but realistic one-year apartment lease.
 * Sections 4, 5, 8, 9, 10, 11, 12 and 19 are written to be genuinely bad for a
 * renter; the rest is ordinary boilerplate so the reviewer has to discriminate.
 * Landlord, address and amounts are invented.
 */

export const SAMPLE_LEASE_FILE_NAME = "Sample lease (418 Alder Street)";

export const SAMPLE_LEASE_TEXT = `RESIDENTIAL LEASE AGREEMENT

This Residential Lease Agreement ("Lease") is made on October 1, 2026 between Alder Street Holdings LLC ("Landlord") and the undersigned resident or residents ("Tenant") for the apartment known as Unit 3B, 418 Alder Street (the "Premises").

1. TERM. The Lease begins on November 1, 2026 and ends on October 31, 2027 (the "Initial Term").

2. RENT. Tenant shall pay monthly rent of $1,950, due on the first day of each month. Rent may be paid by check, bank transfer or through the resident portal.

3. LATE FEES. If rent is not received by the fifth day of the month, Tenant shall pay a one-time late fee of $50 for that month.

4. MONTHLY SERVICE FEES. In addition to rent, Tenant shall pay a monthly administrative fee of $45, a trash valet fee of $35 and a pest control fee of $15. Landlord may add new service fees or increase existing fees at any time by posting notice in the resident portal.

5. SECURITY DEPOSIT. Tenant shall pay a security deposit of $1,950 before move-in. Landlord will return the deposit, less lawful deductions, with an itemized statement after Tenant vacates. A non-refundable cleaning and re-keying charge of $400 will be deducted from the deposit regardless of the condition of the Premises.

6. USE AND OCCUPANCY. The Premises shall be used only as a private residence by the Tenant named in this Lease. Guests may stay up to fourteen nights in any six-month period without Landlord's written consent.

7. UTILITIES. Tenant is responsible for electricity, gas and internet service. Landlord provides water, sewer and trash collection.

8. MAINTENANCE AND REPAIRS. Tenant shall keep the Premises clean and promptly report any defect. Tenant accepts the Premises "as is" and is responsible for the full cost of all repairs to the Premises, including plumbing, electrical, heating and cooling systems and appliances, regardless of cause. Tenant waives any right to withhold rent or to repair and deduct because of the condition of the Premises.

9. LANDLORD'S ACCESS. Landlord or its agents may enter the Premises at any time, without prior notice, for inspection, repairs, or to show the Premises to prospective residents or buyers.

10. RENT ADJUSTMENT. Landlord may increase the monthly rent during the Initial Term upon thirty (30) days' written notice if Landlord's taxes, insurance or operating costs increase.

11. RENEWAL. Unless Tenant gives written notice of non-renewal at least ninety (90) days before the end of the then-current term, this Lease automatically renews for an additional twelve (12) month term at Landlord's then-current market rate.

12. EARLY TERMINATION. If Tenant vacates before the end of the term for any reason, Tenant shall immediately pay all rent remaining through the end of the term, plus a re-letting fee equal to two months' rent, and forfeits the security deposit. Landlord has no obligation to attempt to re-rent the Premises.

13. PETS. No pets are allowed without Landlord's written consent. Approved pets require a pet deposit of $300, refundable less any pet-related damage, and monthly pet rent of $35.

14. RENTER'S INSURANCE. Tenant shall maintain renter's insurance with at least $100,000 of personal liability coverage for the full term and provide proof on request.

15. JOINT AND SEVERAL LIABILITY. If more than one person signs this Lease as Tenant, each is jointly and severally liable for all obligations under this Lease.

16. SUBLETTING. Tenant shall not assign this Lease or sublet the Premises without Landlord's prior written consent, which shall not be unreasonably withheld.

17. QUIET ENJOYMENT. So long as Tenant complies with this Lease, Tenant shall peacefully and quietly enjoy the Premises. Quiet hours are 10 p.m. to 7 a.m.

18. SMOKING. Smoking and vaping are prohibited inside the Premises and in all common areas.

19. DISPUTE RESOLUTION. Any dispute arising from this Lease shall be resolved exclusively by binding arbitration administered by a provider chosen by Landlord. Tenant waives the right to a jury trial and to participate in any class or collective action. Tenant shall pay Landlord's attorney's fees and costs in any dispute, regardless of the outcome.

20. NOTICES. Notices to Landlord must be sent by certified mail to the management office. Notices to Tenant may be delivered by email, through the resident portal or by posting on the door of the Premises.

21. MOVE-OUT. Tenant shall return all keys, remove all belongings and leave the Premises in broom-clean condition, normal wear and tear excepted.

22. ALTERATIONS. Tenant shall not paint, install fixtures or make other alterations without Landlord's written consent. Small nail holes for hanging pictures are permitted and are treated as normal wear and tear.

23. PARKING AND STORAGE. One unassigned parking space is included with the Premises at no additional charge. Storage lockers are available separately for $40 per month, subject to availability.

24. KEYS AND LOCKS. Landlord will provide two sets of keys at move-in. Tenant shall not change or add locks without Landlord's written consent. Replacement keys cost $25 each.

25. CONDITION REPORT. Within five days of move-in, Tenant may give Landlord a written list of existing damage, and Landlord will keep that list with Tenant's file for use at move-out.

26. SEVERABILITY. If any part of this Lease is found to be unenforceable, the rest of the Lease remains in effect.

27. ENTIRE AGREEMENT. This Lease and its attached community rules are the entire agreement between the parties and may be changed only in writing signed by both parties.

Landlord: ______________________   Date: ____________

Tenant: ________________________   Date: ____________
`;

/*
 * Shown for the sample lease when OpenAI is not connected (or the shared demo
 * allowance for the day is used up). Every clauseQuote is an exact substring of
 * SAMPLE_LEASE_TEXT. The summary says plainly that no model wrote it.
 */
export const CANNED_SAMPLE_AUDIT: { overallRisk: RiskLevel; summary: string; flags: LeaseFlag[] } = {
  overallRisk: "high",
  summary:
    "This is a pre-written example review of Nestor's sample lease, shown because a live AI review is not available right now. " +
    "The lease is a standard one-year apartment lease with several one-sided terms: the landlord can raise rent and fees mid-lease, enter without notice, push every repair onto you, and charge the full remaining rent if you leave early. " +
    "Start by asking to remove the mid-term rent increase and the no-notice entry clause. Rules on deposits, entry and repairs vary by state, so check your local tenant handbook. This is not legal advice.",
  flags: [
    {
      severity: "high",
      category: "Rent increases",
      title: "Rent can go up mid-lease",
      clauseQuote:
        "Landlord may increase the monthly rent during the Initial Term upon thirty (30) days' written notice if Landlord's taxes, insurance or operating costs increase.",
      pageHint: "Section 10",
      whyItMatters:
        "The point of a fixed-term lease is a fixed rent. This clause lets the landlord raise it whenever their costs go up, with no cap, while you stay locked in for the full term.",
      suggestedAsk:
        "Could we remove Section 10 so the rent stays at $1,950 for the full initial term? I am happy to discuss a fair increase at renewal.",
    },
    {
      severity: "high",
      category: "Maintenance & repairs",
      title: "You pay for every repair",
      clauseQuote:
        "is responsible for the full cost of all repairs to the Premises, including plumbing, electrical, heating and cooling systems and appliances, regardless of cause",
      pageHint: "Section 8",
      whyItMatters:
        "Landlords normally repair building systems and the appliances they supply. Here a failed water heater or air conditioner would be your bill even if you did nothing wrong. Most states do not let a landlord contract out of keeping a home habitable, but the details vary by state.",
      suggestedAsk:
        "Could Section 8 be changed so I cover only damage caused by me or my guests, and the landlord handles building systems, supplied appliances and normal wear?",
    },
    {
      severity: "high",
      category: "Early termination",
      title: "Leaving early costs everything",
      clauseQuote:
        "Tenant shall immediately pay all rent remaining through the end of the term, plus a re-letting fee equal to two months' rent, and forfeits the security deposit. Landlord has no obligation to attempt to re-rent the Premises.",
      pageHint: "Section 12",
      whyItMatters:
        "If a job move or family emergency forces you out in month three, you would owe nine months of rent, two more months as a fee, and your deposit. Many states require landlords to make a reasonable effort to re-rent, which this clause tries to avoid.",
      suggestedAsk:
        "Could we replace Section 12 with a 60-day notice and a fee of one month's rent, with the landlord agreeing to make reasonable efforts to re-rent?",
    },
    {
      severity: "high",
      category: "Entry & privacy",
      title: "Landlord can enter without notice",
      clauseQuote:
        "Landlord or its agents may enter the Premises at any time, without prior notice, for inspection, repairs, or to show the Premises to prospective residents or buyers.",
      pageHint: "Section 9",
      whyItMatters:
        "Many states require reasonable advance notice, often 24 hours, except in an emergency. As written, someone could walk into your home at any hour for a routine showing.",
      suggestedAsk:
        "Could Section 9 require at least 24 hours' written notice and entry during normal daytime hours, except for genuine emergencies?",
    },
    {
      severity: "high",
      category: "Arbitration & disputes",
      title: "Forced arbitration, you pay their lawyers",
      clauseQuote:
        "Tenant shall pay Landlord's attorney's fees and costs in any dispute, regardless of the outcome.",
      pageHint: "Section 19",
      whyItMatters:
        "You give up court, a jury and class actions, the landlord picks the arbitration provider, and you pay their legal fees even if you win. That makes it very expensive to dispute anything, including a withheld deposit. Some states limit one-way fee clauses.",
      suggestedAsk:
        "Could the attorney's fees sentence be changed so the losing party pays, and could small claims court stay available for deposit disputes?",
    },
    {
      severity: "medium",
      category: "Renewal & notice",
      title: "Auto-renews unless you give 90 days",
      clauseQuote:
        "Unless Tenant gives written notice of non-renewal at least ninety (90) days before the end of the then-current term, this Lease automatically renews for an additional twelve (12) month term at Landlord's then-current market rate.",
      pageHint: "Section 11",
      whyItMatters:
        "Miss a deadline three months before your lease ends and you are committed to another full year at whatever rent the landlord sets. Several states restrict automatic renewals or require a reminder.",
      suggestedAsk:
        "Could the lease convert to month-to-month after the initial term, or could the notice period be 30 days with a written reminder from you beforehand?",
    },
    {
      severity: "medium",
      category: "Fees",
      title: "$95 a month in fees that can grow",
      clauseQuote:
        "Landlord may add new service fees or increase existing fees at any time by posting notice in the resident portal.",
      pageHint: "Section 4",
      whyItMatters:
        "The administrative, trash valet and pest fees add $95 a month, so the real rent is $2,045. The landlord can also add or raise fees at will, which is a rent increase by another name.",
      suggestedAsk:
        "Could the monthly fees be listed at fixed amounts for the whole term, and could the $45 administrative fee be waived?",
    },
    {
      severity: "medium",
      category: "Deposit",
      title: "$400 kept from the deposit no matter what",
      clauseQuote:
        "A non-refundable cleaning and re-keying charge of $400 will be deducted from the deposit regardless of the condition of the Premises.",
      pageHint: "Section 5",
      whyItMatters:
        "Deposits are generally meant to cover actual damage and unpaid rent. An automatic deduction means you lose $400 even if you leave the unit spotless, and some states do not allow non-refundable deposit charges at all.",
      suggestedAsk:
        "Could the $400 charge be removed so that only actual, itemized cleaning costs beyond normal wear are deducted?",
    },
    {
      severity: "low",
      category: "Joint liability",
      title: "Each tenant is liable for the whole rent",
      clauseQuote:
        "If more than one person signs this Lease as Tenant, each is jointly and severally liable for all obligations under this Lease.",
      pageHint: "Section 15",
      whyItMatters:
        "This is common, but worth knowing: if a roommate stops paying, the landlord can ask you for the full amount. It only matters if someone else signs with you.",
      suggestedAsk:
        "If a co-tenant moves out with your approval, could they be released from the lease in writing, and could I be as well if I leave under the same terms?",
    },
  ],
};
