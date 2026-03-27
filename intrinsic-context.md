# Intrinsic — Product Context

## What Intrinsic Is

Intrinsic is an AI-powered financial modeling platform. It combines a natural language AI interface with a fully functional spreadsheet workspace. Users describe what they want in plain English — "build a DCF for Apple using 5 years of historical data", "add a sensitivity table for the discount rate", "update revenue growth to reflect Q3 guidance" — and Intrinsic builds or edits the model in a real, editable spreadsheet.

The product is **not** a PDF generator, a locked template, or a chatbot that returns financial summaries. The output is a working spreadsheet with live formulas. Users retain full control: they can override any cell, change any assumption, add rows, reformat, and stress-test scenarios — everything a normal spreadsheet allows.

Intrinsic is built by **MarketRadar Intelligence, Corp.**

---

## Core Value Proposition

Building a three-statement financial model from SEC filings manually takes 8–40 hours depending on experience — the majority of which is data entry and cross-referencing, not analysis. Intrinsic eliminates that portion.

The division is clean:
- **Intrinsic handles:** data extraction, statement construction, formula linking, model structure, updates when new filings drop
- **The analyst handles:** growth assumptions, margin judgment, WACC inputs, terminal value rationale, conviction on the business

The goal is to compress the time from "I want to analyze this company" to "I have a working model with real data" from days to minutes — without removing the analyst from the analytical decisions.

---

## Data

Intrinsic pulls financial data directly from **SEC EDGAR** — specifically 10-K (annual) and 10-Q (quarterly) filings. All US public companies are legally required to file these reports, and since 2009 they must be submitted in **XBRL format**, which tags every line item with a standardized machine-readable identifier.

This matters because:
- **Primary source** — the data is audited and comes directly from company filings, not from a data vendor's interpretation of them
- **No middleman** — Bloomberg, FactSet, Capital IQ, and Refinitiv all ultimately source from SEC filings too; Intrinsic removes the subscription fee and the intermediary
- **Standardized extraction** — XBRL tags allow consistent extraction across all ~7,000 SEC-filing companies, even when companies change how they present line items
- **Automatic updates** — models can update when new filings drop without manual re-entry

Intrinsic also provides **real-time stock quotes** for use in models.

---

## Model Types

| Model | Description |
|---|---|
| **DCF** | Discounted cash flow valuation — revenue/margin projections, WACC, terminal value, equity value per share |
| **LBO** | Leveraged buyout — debt schedules, amortization, returns waterfall, IRR |
| **Comps** | Comparable company analysis / trading comps — EV/EBITDA, P/E, EV/Revenue across sectors |
| **Three-statement** | Integrated income statement, balance sheet, and cash flow statement from SEC data |
| **Budget / Operating forecast** | Forward-looking financial planning and scenario modeling |

Any of these can be built from a single natural language instruction. The AI can also modify existing models — change an assumption, add a scenario, extend the historical data range, insert new rows or sheets.

---

## Spreadsheet Features

The spreadsheet workspace is a full-featured editor, not a display layer. Key capabilities:

**Cell & Data**
- Three cell types: text, number, formula
- Full formula engine with computed values (and error propagation)
- Cross-sheet formula references
- Number formats: automatic, text, number, percent, scientific, accounting, financial, currency, currencyRounded, date, time, datetime, duration
- Cell formatting: bold, italic, strikethrough, underline, text color, fill color

**Navigation & Structure**
- Multiple sheets per workspace (tabs)
- Multiple workspaces (separate modeling projects)
- Freeze rows and columns (per-sheet)
- Column widths (per-sheet)
- Scroll position memory (per-sheet)

**Editing**
- Undo/redo with full delta history (data + format)
- Copy/paste with animated range indicators
- Find/search across the spreadsheet
- Highlighted cell references (clicking a cell ref in the AI chat navigates to that cell)

**Visualization**
- Charts (per-sheet, configurable)

**Import / Export**
- Upload Excel (.xlsx) or CSV files — preserves formulas, bold, colors, number formats, cell styles
- Export to Excel (Pro plan)
- Save any workspace as a reusable template

**Templates**
- Built-in professional templates: DCF, LBO, trading comps
- Custom templates: users can upload their own `.xlsx` and save as template

---

## Pricing

| Plan | Price | Key Limits |
|---|---|---|
| **Free** | $0/month | 100 messages/month, 1 workspace, core valuation templates |
| **Pro** | $29/month or $23/month (yearly — save 20%) | Unlimited models, unlimited workspaces, all templates, AI analysis and insights, Export to Excel |

Billing is handled via **Stripe** (checkout sessions + billing portal). Authentication via **WorkOS**.

---

## Target Users

- **Buy-side analysts** — covering large universes (30–80 companies), need fast model construction and quarterly updates without dedicated data-entry time
- **Sell-side equity researchers** — publish quickly after earnings; automated models update the moment new filings drop
- **PE/VC professionals** — evaluate targets and build comparables during deal processes without dedicating associate time to data entry
- **Finance students** — build rigorous, real-data models without years of practice building from scratch manually
- **Portfolio managers** — run scenario analysis and stress-test assumptions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | CSS Modules |
| State management | Zustand (`spreadsheetStore`) |
| Auth | WorkOS (`@workos-inc/authkit-nextjs`) |
| Payments | Stripe |
| Formula engine | Custom (recalculateAll / recalculateDirty) |
| Data source | SEC EDGAR (XBRL) |

---

## URLs

| Page | URL |
|---|---|
| Landing | https://www.runintrinsic.com |
| Pricing | https://www.runintrinsic.com/pricing |
| Resources / Blog | https://www.runintrinsic.com/blog |
| Sign up | https://www.runintrinsic.com/onboarding |
| Sign in | https://www.runintrinsic.com/login |
| Dashboard (auth required) | https://www.runintrinsic.com/dashboard |

---

## Messaging & Tone

The product communicates in a direct, technical tone suited to professional analysts. No fluff, no hype. The core message is:

> **Let Intrinsic do the legwork, you make the decisions.**

Supporting messages:
- "Automated financial modeling with verified SEC data"
- "Unlock intrinsic value"
- The AI handles construction. The analyst handles judgment.
- Real data. Real formulas. Full control.

Content (blog posts, landing page copy) emphasizes real, citable data — analyst time studies, spreadsheet error research (Panko, KPMG), SEC filing statistics, CFA Institute surveys. The brand avoids vague AI marketing language and speaks to practitioners.

---

## What Intrinsic Is Not

- **Not a data terminal** — it doesn't replace Bloomberg or FactSet for data browsing, news, or fixed income. It builds models.
- **Not a locked template** — the output is fully editable. No black boxes.
- **Not a financial advisor** — it builds models from reported data. It does not recommend trades or provide investment advice.
- **Not a replacement for analyst judgment** — growth assumptions, WACC inputs, margin views, and conviction on the business remain with the user. The AI removes the construction work, not the thinking.
