# Notion Developer Platform Hackathon

Source: https://notion.notion.site/Hacker-Resources-Notion-Developer-Platform-Hackathon-351efdeead0580ff96b7c3cfb2b354fd?pvs=143

Fetched: 2026-05-16

## Event Basics

- Location: Notion HQ, 20 Annie Street, San Francisco, CA 94105.
- Schedule:
  - Saturday, May 16: check-in 9:00 a.m., kickoff and demos 10:00 a.m., building starts 10:45 a.m., day ends 8:00 p.m.
  - Sunday, May 17: arrival 9:00 a.m., submissions due 12:00 p.m., judging and lunch 12:15 p.m., awards and closing 3:00 p.m.
- Team size: up to 4 people.
- Submissions: due Sunday, May 17 at 12:00 p.m. through Cerebral Valley.
- Demo video: one-minute video uploaded to YouTube, Loom, or another accessible host.

## Hard Rules

- Everything shown in the demo must be fully open source, including backend, frontend, models, and other components.
- Projects must be started from scratch during the hackathon.
- The demo must only show features, code, and functionality built during the hackathon.
- Projects can be disqualified for legal, ethical, platform-policy, rights, or safety violations.
- Employees of partner companies are not eligible to participate.

## Anti-Projects

The page explicitly says not to build:

- Basic RAG applications
- Medical advice tools
- Generic education chatbots
- AI companion chatbots
- Personality analyzers
- NSFW projects
- Streamlit applications

## Build Themes

Projects must fit at least one of these themes.

### Theme 1: The Autonomous Sidekick

Build something that notices, decides, and acts. Strong examples include scheduled behavior, trigger-based behavior, durable memory, or a recurring artifact that can be shared.

Useful angle for Notion Personas:

- A persona notices a request for review in a Notion comment.
- It decides which persona or role should respond.
- It acts by posting a useful comment or threaded reply.
- It maintains run state across turns.

### Theme 2: The Workflow Relay

Replace manual handoffs with an orchestrated flow across systems. Strong examples include multiple data sources, translation between systems, and approval moments for risky or public actions.

Useful angle for Notion Personas:

- A Notion comment triggers a multi-agent review workflow.
- The system translates messy workspace context into structured persona feedback.
- Personas can coordinate handoffs between product, engineering, sales, support, or leadership.
- Risky actions can be limited to comments, drafts, or approval-gated updates.

### Theme 3: Chaos Mode

Build something slightly unhinged that still works. Bonus fit comes from personas, multimodal inputs, or dramatic single-button workflows.

Useful angle for Notion Personas:

- The project naturally includes personas, but it should avoid sounding like a banned "personality analyzer."
- The strongest version is not "analyze a person's personality"; it is "summon grounded work personas to review, debate, and produce actionable work."
- A memorable demo could lean into dramatic comment-thread debate while still showing real Notion platform primitives.

## Notion Developer Platform Notes

The hackathon emphasizes Notion's Developer Platform, especially:

- Workers: Notion-hosted runtime for custom code in a sandbox.
- ntn CLI: command-line workflow for creating and deploying Workers.
- Database sync: continuously sync external data into Notion databases.
- Agent tools: build custom tools for Notion Custom Agents.
- Webhooks: trigger workflows from external events.
- Notion API, pages, databases, search, and files through the CLI/API.

Suggested setup:

```bash
curl -fsSL https://ntn.dev | bash
ntn login
ntn workers new
ntn deploy
```

## Judging And Submission

Judges evaluate technical demos. The page says not to show a presentation; show what was built.

Judging process:

- Round 1: roughly 3-minute pitch plus 1-2 minutes of Q&A with assigned judges.
- Round 2: top six teams demo on stage to final judges with roughly 3-minute pitch plus 2-3 minutes of Q&A.
- Final round criteria are the same as first round criteria, except category weights are removed.

Submission requirements:

- Registered and approved on Cerebral Valley.
- Public repository.
- Accessible demo link.
- All team members added to the submission page.
- One-minute demo video.

## Judges

First-round judges include people from Anthropic, Notion, Radical Ventures, Vercel, Eigen, and other AI/product/investor backgrounds.

Final-round judges include:

- Andrew Qu, Vercel
- Anthony Morris, Anthropic / Claude Code
- Matt Palmer, Conductor
- Max Schoening, Notion
- Mike Vernal, Conviction
- Pavla Bobosikova, Neo
- Simon Last, Notion

## Prizes

Top prizes include Anthropic API credits, OpenAI API credits, Vercel credits, PlanetScale credits, MiniMax credits, Notion Business, and a Notion Expert build session.

## Implications For Notion Personas

Best theme fit:

1. Workflow Relay
2. Autonomous Sidekick
3. Chaos Mode as a demo flavor, not the core pitch

Important positioning:

- Do not frame the project as a personality analyzer.
- Do not frame it as a basic RAG app.
- Frame it as a Notion-native autonomous workflow that turns comment mentions into grounded cross-functional review.
- Emphasize Workers, webhooks, persisted run state, comments, and threaded multi-agent action.
- The demo should show something that acts inside Notion, not just a chatbot beside Notion.

Most hackathon-impressive demo shape:

- A Notion page receives a comment mentioning multiple personas.
- A Worker processes the webhook.
- Personas use their source pages as context.
- They post comments and replies in a bounded thread.
- The run state updates in a Notion database.
- The demo ends with the page improved by a concrete async review, not just summarized.
