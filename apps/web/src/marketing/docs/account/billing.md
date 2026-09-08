# Billing

Billing is where you choose a plan, see what you are paying for, and look back at every payment. This page explains the plans, the limits each one carries, what happens when you reach one, and where transactions live.

Billing lives under **Account**, at `/app/billing`, with a **Transactions** tab beside its **Overview**.

## What SlideOps meters

The header states the principle:

> SlideOps meters only what it provides, the servers you connect and the Projects you run, never the resources on your own servers.

Your plan bounds how many Workspaces, Servers, and Projects you may register with SlideOps, how many team seats you get, how long history is kept, and which features are unlocked.

It never bounds CPU, memory, disk, or the number of Services running on a machine. Those are your own resources on hardware SlideOps does not own, and metering them would be charging you for something you already pay for.

## The plans

Four tiers exist. Two of them are self-serve.

| | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Workspaces | 1 | 3 | 10 | Unlimited |
| Servers | 1 | 3 | 15 | Unlimited |
| Projects | 1 | 5 | 30 | Unlimited |
| Team seats | 1 | 2 | 5 | Unlimited |
| History retention | 7 days | 30 days | 1 year | Unlimited |
| Automations | No | Yes | Yes | Yes |
| Advanced monitoring | No | No | Yes | Yes |
| Audit trail | No | No | Yes | Yes |

Free is where every account starts. The card reads:

> You are on the Free plan. One server, one Project, and the full flow. Upgrade any time to run more.

"The full flow" is literal. Free is not a crippled mode: discovery, assessment, planning, approval, execution, verification, and history all work exactly as they do on a paid plan. What Free bounds is how much you can run at once.

**Starter** and **Pro** are the two cards on the Billing page, shown at **$19 per month** and **$49 per month**.

**Enterprise** has no card and cannot be bought through checkout. Neither can Free, for obvious reasons.

Whoever operates a SlideOps deployment can adjust both the prices and the limits, so what you see on your own Billing page is authoritative for your deployment.

## Buying a plan

Select **Starter** or **Pro**, and a **Complete your upgrade** card appears with the rest of the choices.

### Billing cycle

**Monthly**, **1 year**, **2 years**, or **3 years**. Paying for longer is simply the monthly price times the months, with one exception, which the page states:

> The first time you pay for a full year or more straight through checkout, you get a one-time 2% discount, shown below.

That discount applies once per account, ever, and never stacks with a promo code. If you supply a code, the code wins.

### Payment provider

Two are offered when the deployment has them configured:

- **Paystack**, described as best for local cards and bank transfers, charging in Naira, converted from the dollar price at the live exchange rate at checkout.
- **Flutterwave**, described as best for international cards and currencies, charging in US Dollars.

The currency follows from the provider, so there is nothing separate to choose.

If no provider is configured on the deployment, the plans are shown for reference and checkout is unavailable:

> No payment provider is configured on this platform, so plans are shown for reference only.

### The price quote

Before you commit, a panel shows the subtotal, a fee line, and the total. The fee reads **VAT (10%)** and is a flat platform-wide addition covering payment processing and other costs. It is not a computed government tax rate, there is no tax identifier field, and there is no per-jurisdiction rate.

When Naira is involved, the panel also shows the conversion rate it used.

### Promo codes

A **Promo code** field with a **Validate** button previews what a code does before you pay. Validating redeems nothing; the code is applied when the payment succeeds.

A valid code shows what it grants in plain words, for example a percentage off the price, extra Servers, Projects and seats, or a tier free for a number of days. A code granting a free tier needs no payment at all: your plan activates in place.

An invalid code says why: not found, not active, outside its window, redemption limit reached, already redeemed by you, or not applicable to the tier you chose.

Codes are issued by whoever runs the deployment. There is no public list.

### Checkout

**Upgrade to Starter** or **Upgrade to Pro** sends you to the payment provider's own hosted page.

Card details never touch SlideOps. The provider collects them, and SlideOps learns the outcome from a signed notification it verifies independently. This is why there is no card field anywhere in the product, and why there is no saved card and no "update payment method": every checkout is a fresh hosted session.

You return to Billing with a notice:

- **Payment received. Your plan is being activated.**
- **That payment did not go through. Nothing was charged. You can try again below.**

The plan is granted when the provider's confirmation is verified, which is usually immediate but is not tied to your browser getting back.

## Cancelling

**Cancel plan** appears on the current plan card while a subscription is active. The confirmation states what happens:

> Your subscription ends and you return to the Free tier. Anything over the Free limits stays in place but you will not be able to add more until you are within them again.

That last sentence is the important one. Cancelling never deletes anything. Servers you have connected stay connected, Projects stay, and Services keep running. What changes is that you cannot add more until you are back inside the Free limits.

There is no separate downgrade action. To move from Pro to Starter, buy Starter. To move to Free, cancel.

There is no pause or resume of a subscription available to an Operator.

## When you reach a limit

A create that would take you over a limit is refused, with the plan and the number named:

```text
the free tier allows at most 1 nodes
the starter tier allows at most 5 projects
the starter tier allows at most 2 seats
the free tier allows at most 1 workspaces
```

A feature your plan does not include is refused the same way:

```text
the free tier does not include automations
```

Nothing is deleted, throttled, or switched off when you hit a limit. Existing Servers keep working, existing Automations keep running, and existing Projects stay. Only the next create is refused.

Seats are counted per Workspace, and a pending invitation counts as a seat because it reserves the one it will fill. The seat limit comes from the plan of the account that **created** the Workspace, not the account doing the inviting.

To see where you stand before you hit a wall, the tier panel on the Workspace home shows your plan alongside your current usage of Workspaces, Servers, and Projects, and your seat allowance.

An account carrying the platform admin role is unlimited by role and never needs a subscription.

## Transactions

The **Transactions** tab is every payment you have made or started, and what happened to it.

### Finding a payment

- **Date range**: 7 days, 30 days, 90 days (the default), 6 months, 1 year, All time, or a custom From and To.
- **Status filters**: All, Pending, Successful, Failed, Cancelled, Refunded, Disputed.
- **Search** by reference or plan name.
- Summary tiles for total paid, and counts of successful, pending, and failed payments. Totals are kept per currency and never summed across currencies.
- An activity chart over the chosen range.
- Rows load twenty at a time with **Load more**.

**Export CSV** downloads the current filter as a file with one row per payment: date, reference, status, plan, amount, currency, provider, provider reference, term in months, and promo code.

### Payment statuses

| Status | Shown as |
|--------|----------|
| pending | Pending Payment |
| success | Payment Successful |
| failed | Payment Failed |
| cancelled | Payment Cancelled |
| refunded | Payment Refunded |
| disputed | Payment Disputed |

Refunded and disputed are reserved. Nothing sets them today, and there is no refund or dispute flow in the product. If you need one, contact whoever runs the deployment.

### One payment's detail

Opening a payment shows its status, the plan, the amount, the date, its reference with a copy control, the provider and the provider's own reference, the billing period it covers, and any promo code applied.

What you can do depends on where it ended up:

- **Pending**: **Complete Payment** sends you back into the same hosted checkout rather than starting a second one; **Cancel Payment** abandons it; **Check Payment Status** re-asks the provider and reconciles the record.
- **Successful**: **View Receipt** and **Download Receipt** open a one-page PDF, and **Email Receipt** sends it to your account email again.
- **Failed** or **Cancelled**: a button back to the plans, with the note that this starts a brand new payment and nothing from the old one carries over.

A receipt is also emailed automatically when a payment is confirmed.

The only identity on a receipt is your account email. There is no billing address field anywhere in SlideOps.

## Billing follows the account, not the Workspace

Your subscription belongs to the account paying for it, never to whichever Workspace you happen to be acting in.

Switching into somebody else's Workspace does not move your billing there, and it does not let your checkout, promo code, or cancellation land on their account.

The other direction is worth knowing too: a Workspace has no plan of its own. Its Server, Project, and seat limits come from the plan of whoever created it, and the usage counted against those limits is that Workspace's own, whoever in it created each thing. See [Workspaces and teams](/docs/account/workspaces-and-teams).

## Related

- [Workspaces and teams](/docs/account/workspaces-and-teams) for seats and Workspace limits
- [Automations](/docs/automate/automations) for the feature Free does not include
- [Security](/docs/account/security) for the rest of your account settings
