# Challenge Booklet: reference notes for the build

The booklet is the top authority (central context section 7: Booklet, then PRD v2, then
everything else). The PDF itself is not committed here. This file records only the parts the
store manager build depends on, so a teammate can check a requirement without the PDF.

Competition data is confidential: the booklet forbids sharing the datasets or derivatives.
No CSV contents are reproduced here, and `data/` is gitignored.

## Dates

| Milestone | When |
|---|---|
| Brief and datasets released | Fri 25 Sep 2026, 00:01 |
| Designathon deadline | Tue 29 Sep 2026, 23:59 |
| Hackathon deadline | Sun 4 Oct 2026, 23:59 |
| Datathon deadline | Fri 9 Oct 2026, 23:59 |

All times are Sri Lanka time (Asia/Colombo, UTC+05:30). The Hackathon build must follow the
Designathon submission, and judges assess continuity between the two.

## The store manager, in the booklet's own words

> Works at the outlet counter using a desktop or phone. Places orders by phone or message
> without confirmation that they received or scheduled them.
>
> Needs an expected arrival time to schedule staff to receive goods.
>
> Needs clear notice when an order is deferred, plus a way to confirm receipt and report issues.

This is the source for the three store screens: S1 places and confirms the order, S2 gives the
arrival time and the deferral notice, S3 confirms receipt and reports issues.

## Workflow stages the store owns

| Stage | Role | System requirement |
|---|---|---|
| Place order | Store manager | Capture and confirm the order before the cutoff |
| Confirm receipt | Store manager | Confirm what arrived and report issues |

## Rules the store screens depend on

- Orders for the next day close at **4 PM**. Orders received after the cutoff wait for the
  following run.
- Waypoint operates **Monday through Saturday**.
- Fresh deliveries must arrive before stores open at **8 AM**, though individual outlets'
  windows may differ.
- A Fresh outlet can have **two orders for the same delivery day**: dry groceries for every
  operating day it trades, plus separate chilled orders on several days each week. This is why
  ORD2001 (chilled) and ORD2002 (ambient) are two orders on one delivery day card.
- Unloading conditions vary by outlet: rear dock, curb, or shared mall loading bay.
- Mobile coverage can drop across hill country, the Kandy corridor and rural districts. Work
  away from the depot must remain usable offline, and records must reconcile on reconnect.
- When demand exceeds capacity, the dispatcher decides which orders move to the next run and
  records the reason.

## Problems the booklet asks the solution to address

The two that drive the store screens:

- **Deferrals lack a clear record.** Decisions made under pressure can leave the same outlet
  unserved on consecutive runs.
- **Communication does not support feedback.** Printed run sheets and verbal instructions give
  no reliable way to record proof of delivery or flag a loading shortfall before departure.

## Hackathon requirements that shape this build

- A **responsive web application** that lets a judge complete the workflow across all four
  roles. Judges assess the driver and loader experiences on phone-sized screens. Native apps
  are optional.
- Plans must respect capacity, temperature requirements, outlet access, delivery windows and
  fuel quotas.
- The README needs a numbered judge walkthrough across all four roles, and it must document
  **significant departures from the Designathon design**.

### Hackathon judging weights

| Criterion | Weight |
|---|---|
| Engineering quality and architecture | 25% |
| Functional completeness across all four roles | 20% |
| Planning and allocation engine | 20% |
| Demo video | 10% |
| Degradation, offline operation and recovery | 10% |
| Fidelity to the Day 5 design | 10% |
| Creativity | 5% |

Fidelity to the Day 5 design is scored, which is why every departure from the Figma frames is
listed in the README store section.
