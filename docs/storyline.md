# Notion Personas Demo Storyline

## Demo Goal

Show that Notion Personas can create useful async review from the people who should have been in the room, without requiring those people to stop what they are doing.

The demo should feel like a real product workflow in Notion: a spec needs review, the right voices are missing, and personas create a focused comment thread with tension, tradeoffs, and concrete next steps.

## Core Scenario

A product manager is preparing a launch spec for a customer-facing feature. The feature matters because Sales says several enterprise opportunities are blocked on it, but Engineering is worried that the proposed scope will create reliability and migration risk.

The PM posts the spec in Notion and leaves a comment:

```text
@sales-bot @eng-bot review this before planning
```

Notion Personas reads the comment, identifies the requested personas, loads each persona's Data Frame, reads the full document, and starts an async review thread in the page comments.

## Cast

### Product Manager

The human user who wrote the spec. They want fast, useful cross-functional feedback without scheduling another meeting.

### Sales Bot

Grounded in customer calls, deal notes, renewal risks, competitive takeaways, and customer-facing roadmap requests.

Sales Bot cares about:

- Customer urgency
- Revenue impact
- Commitments already made in the field
- Clear launch messaging
- Avoiding vague timelines

### Engineering Bot

Grounded in architecture docs, incident reviews, implementation plans, ownership notes, and previous postmortems.

Engineering Bot cares about:

- Technical risk
- Migration safety
- Operational load
- Hidden scope
- Clear rollout and rollback plans

## The Reviewed Document

Working title:

```text
Enterprise Account Permissions - Launch Spec
```

The spec proposes a new permissions model for enterprise customers. It includes:

- A target launch date in three weeks
- A customer-requested admin dashboard
- Bulk role assignment
- Audit logs
- Migration from the current account model
- A lightweight rollout plan

The document looks plausible, but it has unresolved tension:

- Sales needs a credible near-term ship date
- Engineering sees risk in the migration and audit-log scope
- Product wants a single launch, not a split release

## Demo Flow

### 1. The PM Requests Review

The PM leaves a comment on the spec:

```text
@sales-bot @eng-bot review this before planning
```

The comment creates a Persona Run with both agents in the queue.

### 2. Sales Bot Responds First

Sales Bot reads the spec and comments that the launch date matters because two enterprise deals are waiting on account-level permissions.

It pushes for:

- Preserving the three-week launch target
- Calling out audit logs as part of the customer-facing promise
- Adding clearer customer value language to the spec

Example tone:

```text
From the customer side, I would not treat this as optional polish. Acme and Northstar have both framed account-level permissions as a blocker for expansion. If we move the date, we need a very explicit alternative commitment.
```

### 3. Engineering Bot Pushes Back

Engineering Bot replies to Sales Bot rather than posting a disconnected comment. It points out that the proposed migration and audit-log scope are larger than the spec makes them sound.

It pushes for:

- Splitting the release into permissions first, audit logs later
- Adding a rollback plan
- Defining migration success metrics
- Naming the teams responsible for support escalation

Example tone:

```text
I agree the customer pressure is real, but the current plan combines three risky changes: permissions, bulk assignment, and audit logs. The spec needs a smaller first release or a much clearer migration plan.
```

### 4. Sales Bot Responds With Customer Reality

Sales Bot replies that audit logs are not just a nice-to-have for some customers, but accepts that the first release could frame them as limited.

It proposes:

- Shipping basic audit visibility in the first release
- Committing to full exportable audit logs in a follow-up
- Updating the customer-facing language so Sales has something concrete to communicate

### 5. Engineering Bot Offers A Compromise

Engineering Bot proposes a scoped MVP:

- Ship account permissions and bulk assignment behind a workspace flag
- Include read-only basic audit events
- Defer audit export and advanced filtering
- Add rollout, rollback, and monitoring sections to the spec

The debate stops after the agents converge on actionable changes.

## Demo Outcome

The final thread gives the PM a realistic review:

- Sales preserves the customer and revenue urgency
- Engineering surfaces hidden technical risk
- The personas respond to each other directly
- The PM gets a concrete spec revision path

The PM updates the spec without scheduling a sync meeting.

## What The Demo Must Prove

- A persona can review a Notion page using its own grounded context
- Multiple personas can participate in the same comment thread
- Personas can disagree in useful, specific ways
- The system can stop after a bounded exchange
- The output feels like async review from real cross-functional partners, not generic AI feedback

## Narrative Tagline

You are too busy to review every doc. Your persona is not.

## Open Story Decisions

- Should the demo use named personas, role personas, or both?
- Should the PM be visible as an active participant, or should the agents complete the review without human intervention?
- Should the debate run for a fixed number of turns, or stop once both personas converge?
- Should the reviewed document be shown in detail, or should the demo focus mainly on the generated comments?
