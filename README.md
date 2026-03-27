<div align="center">
  <img src="frontend/public/icon.svg" width="48" height="48" />
  <h1>Intrinsic</h1>
  <p>AI-powered financial modeling with verified SEC data.</p>
  <a href="https://www.runintrinsic.com">runintrinsic.com</a>
</div>

---

## What It Is

Intrinsic combines a natural language AI interface with a fully functional spreadsheet workspace. Describe what you need — "build a DCF for Apple using 5 years of historical data" — and Intrinsic builds a real, editable model populated with verified numbers from SEC filings.

The output is a working spreadsheet with live formulas. Users retain full control: override any cell, change assumptions, add scenarios, reformat, export.

## What It Does

- **Build financial models** — DCF, LBO, comparable company analysis, three-statement models, operating forecasts
- **Pull verified data** — directly from SEC EDGAR (10-K and 10-Q) via XBRL tagging; covers all ~7,000 SEC-filing companies
- **Edit via natural language** — change assumptions, add sensitivity tables, extend historical data, insert sheets
- **Upload existing models** — import `.xlsx` or `.csv` files with formatting and formulas preserved
- **Templates** — built-in DCF, LBO, and comps templates; save any workspace as a custom template

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | CSS Modules |
| State | Zustand |
| Auth | WorkOS |
| Payments | Stripe |
| Data | SEC EDGAR (XBRL) |

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── pricing/                  # Pricing page (Stripe checkout)
│   ├── onboarding/               # Sign-up flow
│   ├── dashboard/                # App (auth required)
│   │   ├── components/
│   │   │   └── Spreadsheet/      # Spreadsheet engine, formula computation, charts
│   │   └── stores/
│   │       └── spreadsheetStore.ts
│   ├── blog/                     # Resources / blog
│   │   ├── lib/posts.ts          # Reads .md files, parses frontmatter
│   │   ├── page.tsx              # Blog index
│   │   ├── [slug]/page.tsx       # Individual posts
│   │   └── posts/                # Markdown blog posts
│   └── components/               # Navbar, MobileNavbar, Footer
├── proxy.ts                      # WorkOS auth middleware
└── public/                       # Static assets, SVGs, images
backend/
```

## Pricing

| Plan | Price | Limits |
|---|---|---|
| Free | $0/month | 100 messages/month, 1 workspace, core templates |
| Pro | $29/month · $23/month (yearly) | Unlimited models, workspaces, all templates, Export to Excel |

## URLs

| | |
|---|---|
| Landing | https://www.runintrinsic.com |
| Pricing | https://www.runintrinsic.com/pricing |
| Sign up | https://www.runintrinsic.com/onboarding |
| Dashboard | https://www.runintrinsic.com/dashboard |
| Blog | https://www.runintrinsic.com/blog |

## Adding a Blog Post

Drop a `.md` file in `frontend/app/blog/posts/` with this frontmatter:

```md
---
title: "Post Title"
date: "2026-03-27"
description: "Short description for cards and SEO."
readTime: "6 min read"
---
```

The filename becomes the URL slug. No config, no imports, no routing changes needed.
