# AI Disclosure

**Last updated: 5 October 2026**

## 1. Overview

Nexora — Waypoint was developed with the assistance of AI tools throughout the Designathon and Hackathon stages of Tech-Triathlon 2026.

We used AI as an **engineering and productivity tool**, not as an autonomous developer. Different tools were used for different stages of the project, including requirements analysis, research, architecture, UI exploration, implementation, debugging, testing, security review, documentation and presentation preparation.

The team remained responsible for the product requirements, architecture, business rules, implementation decisions, validation and final submission.

AI-generated output was treated as a starting point. It was reviewed, tested, modified or rejected before being accepted into the project.

---

# 2. Our AI-assisted development workflow

Our general workflow was:

```text
Challenge Requirements
        ↓
Research & Understanding
        ↓
Architecture & Product Decisions
        ↓
UX / UI Exploration
        ↓
AI-Assisted Implementation
        ↓
Testing & Debugging
        ↓
Security & Code Review
        ↓
Human Validation
        ↓
Final Integration
```

AI was therefore involved at multiple stages, rather than being used simply to generate source code.

---

# 3. AI tools used

The following tools were used or incorporated into our development workflow where appropriate.

| Tool | Area | How it supported Waypoint |
|---|---|---|
| **Claude / Claude Code** | Engineering | Codebase analysis, implementation, refactoring, debugging, tests and technical reviews |
| **ChatGPT / Codex** | Engineering & reasoning | Requirements analysis, architecture, implementation assistance, debugging, testing and repository reviews |
| **Kimi / Kimi Code** | Long-context development | Repository analysis, implementation assistance, refactoring and documentation |
| **Perplexity** | Research | Technical research, external verification and investigation of logistics, optimisation and software approaches |
| **Figma AI / FigJam AI** | Product & UX | User-flow exploration, interface concepts, design iteration and product mapping |
| **GitHub Copilot** | Development | Code completion, boilerplate, test assistance and development productivity |
| **Gemini / Gemini Code Assist** | Technical analysis | Technical reasoning, multimodal analysis and implementation exploration |
| **NotebookLM** | Requirements | Working with challenge documents, PRDs and project material to extract and cross-check requirements |
| **v0** | UI exploration | Rapid exploration of dashboard and application interface concepts |
| **Lovable / Bolt** | Prototyping | Rapid exploration of application concepts and workflows |
| **Snyk** | Security | Dependency and security analysis |
| **SonarQube** | Code quality | Code-quality, maintainability and static-analysis support |
| **Harness AI** | Engineering operations | CI/CD and deployment workflow analysis |
| **Gamma / Canva AI** | Presentation | Presentation structure, visual assets and communication material |
| **ElevenLabs / Whisper** | Media | Voiceover, transcription and supporting demo-video workflows |

> **Disclosure note:** this table describes the AI tooling used or evaluated as part of the team's workflow. Tools that were not actually used in the final development process should be removed rather than presented as having contributed to the codebase.

---

# 4. Claude and Claude Code

Claude and Claude Code were the most significant AI tools used during the implementation of Waypoint.

They assisted with substantial portions of the frontend, backend and testing work.

Examples include:

- Store Manager screens
- Loader screens
- Driver screens
- Dispatcher functionality
- FastAPI backend foundations
- API clients and mappers
- Offline functionality
- Synchronisation
- Scenario clock
- Database services
- Testing
- Security audits
- UX reviews
- Documentation
- Submission audits

Claude Code was also used to inspect the repository, reason across multiple files, implement changes and run development commands.

For example, AI-assisted development was used to implement and investigate:

```text
Frontend
├── React / TypeScript components
├── Role-specific interfaces
├── API clients
├── Offline field experience
└── State handling

Backend
├── FastAPI routes
├── Services
├── Database models
├── Migrations
└── Business logic

Engineering
├── Tests
├── Debugging
├── Security reviews
├── API validation
└── Submission audits
```

The existing AI build log records the individual areas in which Claude and Claude Code contributed and what was subsequently checked by a person.

---

# 5. ChatGPT / Codex

ChatGPT and Codex were used for higher-level reasoning and repository-oriented engineering tasks.

Potential and actual uses included:

### Requirements analysis

Converting challenge requirements into implementation checklists, acceptance criteria and traceability items.

### Architecture

Exploring:

- frontend/backend boundaries;
- API structures;
- offline-first architecture;
- authentication;
- synchronisation;
- database design; and
- service boundaries.

### Engineering

Assisting with:

- implementation;
- refactoring;
- debugging;
- test generation;
- API design; and
- repository audits.

### Final review

Using AI to challenge the implementation with questions such as:

> What requirements from the Challenge Booklet are not currently represented in the implementation?

The team then verified those findings against the actual project rather than accepting the AI response automatically.

---

# 6. Kimi / Kimi Code

Kimi was useful for long-context reasoning and repository-level analysis.

Its use cases included:

- understanding larger portions of the repository;
- analysing relationships between frontend and backend components;
- reviewing implementation consistency;
- exploring refactoring approaches;
- generating documentation; and
- investigating complex implementation questions.

For a project with multiple roles and interconnected services, long-context analysis was particularly useful when a change affected several parts of the system.

Where agent-style workflows were used, tasks could also be separated into areas such as:

```text
Frontend audit
Backend audit
Database audit
Testing audit
Security audit
Documentation audit
```

The output from these analyses was still reviewed by the team before being used.

---

# 7. Perplexity and AI-assisted research

Perplexity was used primarily as a **research and verification tool**, rather than as a code generator.

Research areas included:

- logistics optimisation;
- vehicle routing;
- delivery-window planning;
- offline-first applications;
- Progressive Web Apps;
- synchronisation strategies;
- forecasting approaches;
- software architecture; and
- technical implementation patterns.

AI research was used to help the team understand possible approaches.

External research was not treated as a substitute for the requirements defined by the Challenge Booklet.

---

# 8. Figma AI and UI exploration

AI-assisted design tools were used during the product-design process to explore:

- user journeys;
- dashboard layouts;
- mobile workflows;
- Driver interfaces;
- Loader interfaces;
- Dispatcher interfaces;
- Store Manager flows; and
- alternative interaction patterns.

AI could suggest an interface or interaction, but the final design decisions were made by the team and aligned with the project's Figma work and requirements.

The Figma source itself was not automatically modified by AI. The current project disclosure explicitly records that the Figma file was treated as read-only.

---

# 9. GitHub Copilot and coding assistance

Where used, GitHub Copilot supported day-to-day development through:

- code completion;
- boilerplate generation;
- type definitions;
- API clients;
- test generation;
- SQL;
- React/TypeScript development; and
- development documentation.

Copilot-style assistance was treated differently from repository-level agents: it was primarily used to accelerate individual development tasks rather than make architectural decisions.

---

# 10. NotebookLM and challenge-document analysis

NotebookLM-style document analysis was useful for working with large project documents such as:

- the Challenge Booklet;
- the PRD;
- Designathon documentation;
- technical specifications; and
- team documentation.

Example questions included:

> What are all the requirements that the Hackathon submission must satisfy?

and:

> Create a traceability matrix between the challenge requirements and the implemented features.

This helped reduce the chance of overlooking requirements during a short development cycle.

---

# 11. AI-assisted testing

AI was also used to help create and expand test coverage.

This included:

- unit tests;
- API tests;
- integration tests;
- Playwright scenarios;
- edge cases;
- authentication tests;
- offline/synchronisation tests;
- security tests; and
- regression tests.

AI was particularly useful for suggesting cases that developers might otherwise overlook.

However, a generated test was not considered evidence that the feature worked. The tests themselves had to run successfully and, where relevant, the underlying behaviour had to be manually inspected.

The existing development record contains examples of AI-assisted test generation followed by unit, API, browser and offline verification.

---

# 12. AI-assisted security review

AI was also used to identify potential security weaknesses.

Areas reviewed included:

- authentication;
- authorisation;
- JWT handling;
- route protection;
- input validation;
- attachment handling;
- synchronisation;
- demo-mode controls;
- security headers;
- request handling; and
- API exposure.

One security review reproduced potential issues before changes were made, after which the team selected the findings that were applicable and implemented fixes.

The resulting changes were then tested independently.

This distinction was important:

**AI identified possible vulnerabilities. Humans decided which findings were valid and how they should be addressed.**

The project disclosure records an example of this process during the authentication audit.

---

# 13. AI-assisted debugging

AI was frequently used as a debugging partner.

Rather than simply asking AI to "fix the error", the team used it to:

1. interpret the error;
2. identify possible causes;
3. trace the relevant code;
4. suggest multiple approaches;
5. implement or test a proposed fix; and
6. verify whether the underlying issue was actually resolved.

This was particularly useful for issues involving:

- frontend/backend contracts;
- API responses;
- offline synchronisation;
- database behaviour;
- state management;
- authentication;
- role-based access; and
- cross-flow behaviour.

---

# 14. AI-assisted code review

AI was also used as an additional reviewer.

Examples included asking AI to look for:

- duplicated logic;
- inconsistent patterns;
- dead buttons;
- missing handlers;
- missing states;
- security weaknesses;
- edge cases;
- API inconsistencies;
- potential race conditions;
- maintainability issues; and
- differences between documented and implemented behaviour.

One example was the submission audit, where AI-assisted analysis identified a vehicle-trip sequencing issue. The team reviewed the finding and decided to adopt the resulting `R-TURN` constraint.

This is an important example of our approach:

**AI proposed the finding; the team made the engineering decision.**

---

# 15. Human verification

AI output was never considered automatically correct.

For meaningful changes, the workflow was:

```text
Human defines problem
        ↓
AI investigates / proposes solution
        ↓
Human reviews proposal
        ↓
AI-assisted implementation
        ↓
Automated tests
        ↓
Manual / browser validation
        ↓
Human review
        ↓
Merge
```

Depending on the change, verification included:

- linting;
- type checking;
- unit tests;
- backend tests;
- API tests;
- browser testing;
- Playwright;
- production builds;
- database migration checks;
- security testing;
- offline testing; and
- comparison against the PRD and Figma designs.

The build log records numerous examples where AI-generated work was followed by explicit human validation.

---

# 16. What AI did not decide

AI did not independently decide:

- the overall Waypoint product;
- the four-role operating model;
- the core business workflow;
- the competition requirements;
- the final architecture;
- the final user experience;
- which trade-offs the team should make;
- which features should be submitted; or
- whether the final system was ready for submission.

These remained team decisions.

---

# 17. Competition data and AI

The competition data was treated separately from AI-assisted development.

The competition CSVs were not pasted into an AI tool for the purpose of generating the solution.

The project's invented and inferred demonstration data is separately documented, including hero-day orders, demo accounts, scripted events and generated fallback data.

This distinction allowed the team to use AI for engineering assistance without treating generated information as official competition data.

---

# 18. AI and generated content

AI was also used where appropriate for supporting project communication, including:

- technical documentation;
- README content;
- presentation structure;
- demo narration;
- explanatory diagrams;
- project descriptions; and
- submission material.

AI-generated content was reviewed and edited by the team before publication.

The same principle applied to media: AI could assist with production, but the final content and message remained team-controlled.

---

# 19. Invented and inferred data

Not all information displayed by Waypoint originates from the competition datasets.

The project contains explicitly documented invented or inferred information used to create a complete demonstration environment.

This includes:

- hero-day orders;
- generated operational events;
- demo accounts;
- loader PINs;
- additional driver names;
- generated orders;
- fallback reference data; and
- scripted scenario events.

These are documented separately in the project's PRD and are not presented as official competition data.

---

# 20. Machine-translated content

The Driver application includes Sinhala and Tamil content.

Some of these strings were produced as machine-assisted translations and are explicitly identified as requiring native-speaker review.

They should therefore not be interpreted as professionally certified translations.

---

# 21. What AI did not do with project data

We deliberately maintained boundaries around project information.

In particular:

- Competition CSV rows were not pasted into AI tools for solution generation.
- AI did not receive unrestricted control over the repository.
- AI did not have authority to approve or merge its own work.
- AI did not independently define competition rules.
- AI did not independently determine the final product architecture.
- The Figma source was not automatically edited by AI.
- Generated assumptions were documented separately from official competition data.

The project records these boundaries explicitly.

---

# 22. Why we used AI

Waypoint has a relatively large scope for a competition project:

- four operational roles;
- frontend and backend applications;
- API infrastructure;
- database models;
- allocation and planning logic;
- offline field operations;
- synchronisation;
- authentication;
- testing;
- security;
- deployment; and
- a scenario-driven demonstration environment.

AI allowed the team to move faster across these areas while still maintaining engineering review.

The biggest benefit was not simply generating code.

It was being able to use AI as a **development partner**:

> **Ask → Challenge → Generate → Test → Review → Improve**

The team had to understand the system well enough to give AI useful context, recognise incorrect assumptions, validate its output and decide what should actually become part of Waypoint.

---

# 23. Our position on AI-assisted development

We do not consider AI assistance to be a substitute for engineering.

The project demonstrates how AI can be incorporated into a real development workflow while keeping human accountability.

AI helped us:

**Research faster.  
Explore more alternatives.  
Write and refactor code faster.  
Find bugs earlier.  
Expand test coverage.  
Review security.  
Document the system.**

The team remained responsible for:

**What we built.  
Why we built it.  
How it should behave.  
Whether it was correct.  
Whether it met the challenge.**

---

# 24. Final statement

Waypoint was not produced by asking an AI to build an application from a single prompt.

It was developed through an iterative process involving people, AI tools, engineering practices, testing and continuous review.

We are therefore transparent that AI made a **meaningful contribution to the development of Waypoint**, while also making clear that the team remained responsible for the product and the decisions behind it.

### In short:

> **AI accelerated our development.  
> Humans directed, tested and owned the result.**
