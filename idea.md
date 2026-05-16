# Notion Personas

Digital twins for every person in your workspace. You're too busy to review every doc — your persona isn't.

## The Problem

Knowledge work runs on feedback loops — between engineers and sales, design and product, leadership and ICs. But people are stretched thin. Docs sit unreviewed. Decisions get made without the right voices in the room.

## The Idea

**Notion Personas** are AI agents that mirror real people in your workspace. Each persona is built from a **Data Frame** — the Notion pages they've authored, comments they've left, and content they've contributed. The result is an agent that reasons and responds in that person's voice.

Tag a persona on any document — `@mike-bot` or `@engineering` — and it reads the doc, forms an opinion, and leaves a comment. Tag multiple personas and watch them debate: a sales persona pushes for a faster ship date, an engineering persona flags scope risk. They respond to each other's specific comments, thread replies, and resolve stale discussions — all without a human in the loop.

**The core use case:** async review that actually sounds like the people who should've been in the room.

## Demo Scenario

A product spec gets shared. Someone comments `@sales-bot @eng-bot review this`. Both personas read the full document, then run up to 20 turns of debate in the comments — each responding to the other's specific points in their own voice. The result: a living review thread that surfaces real cross-functional tension without requiring a single sync meeting.

## Why Notion

Notion is where work lives. Pages, databases, comment threads — it's the natural substrate for async collaboration. Notion Workers let us deploy agent logic natively on Notion's infrastructure. Notion MCP makes it trivial to read and write workspace content. And Notion's comment threading gives personas a structured arena to interact with depth and context.
