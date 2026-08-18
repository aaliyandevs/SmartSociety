# SmartSociety — Documentation

Complete project documentation for **SmartSociety**, a web-based Smart Society
Management System built against the *Full-Stack Application Development*
Software Requirements Specification.

> Source code is deliberately **not** reproduced in this documentation, as the
> SRS requires (§1.9). Where a file matters, it is referenced by path.

## Contents

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [Problem definition](./problem-definition.md) | Background, the problem, the proposed solution and the project scope |
| 2 | [Requirements](./requirements.md) | Every functional and non-functional requirement, traced to where it is implemented |
| 3 | [Architecture](./architecture.md) | System architecture, layering, request lifecycle, technology choices |
| 4 | [Database design](./database-design.md) | Schema, data dictionary, keys, indexes, constraints |
| 5 | [ER diagram](./er-diagram.md) | Entity–relationship diagram and relationship notes |
| 6 | [Data flow diagrams](./dfd.md) | DFD level 0 (context) and level 1 (process decomposition) |
| 7 | [Use cases](./use-cases.md) | Use-case diagram and detailed use-case specifications |
| 8 | [Workflows](./workflows.md) | Activity diagrams and flowcharts for every major process |
| 9 | [Sitemap](./sitemap.md) | Complete navigation map of the application |
| 10 | [API reference](./api.md) | Server actions, route handlers, request/response contracts |
| 11 | [Testing](./testing.md) | Test strategy, test cases, test data, how to run the suites |
| 12 | [Installation](./installation.md) | Prerequisites, setup, environment variables, deployment |
| 13 | [User guide](./user-guide.md) | Step-by-step guide for each of the four roles |
| 14 | [Assumptions & limitations](./assumptions.md) | Decisions taken where the SRS was silent, and known limits |
| 15 | [SRS compliance](./SRS-COMPLIANCE.md) | Requirement-by-requirement compliance checklist |

## Quick reference

- **Application**: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4
- **Database**: PostgreSQL 17 via Prisma ORM
- **Roles**: Administrator, Resident, Security Guard, Maintenance Staff
- **Screens**: 55 routes across a public area and four role consoles
- **Demo credentials**: see [Installation](./installation.md#demo-credentials)

## Diagrams

All diagrams are written in [Mermaid](https://mermaid.js.org/) inside the Markdown
files, so they render directly on GitHub and in most Markdown viewers and remain
editable as text rather than being flattened into images.
