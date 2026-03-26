---
title: "10-K vs 10-Q: What Analysts Need to Know"
date: "2026-03-16"
description: "The 10-K and 10-Q are the two most important SEC filings for financial modeling. Here's what each contains, how they differ, and which data points to pull from each."
readTime: "7 min read"
---

## The Two Filings That Matter Most

Every public company in the United States is required to file periodic financial reports with the Securities and Exchange Commission. Of the dozens of filing types, two contain the data that drives financial modeling: the 10-K (annual report) and the 10-Q (quarterly report).

If you're building financial models, running valuations, or doing equity research, these are your primary data sources. Everything else — earnings press releases, investor presentations, Bloomberg data — is either derived from these filings or supplementary to them.

## What's in a 10-K

The 10-K is filed once per year, typically within 60 days of the fiscal year-end for large accelerated filers (companies with a public float above $700 million). It's the most comprehensive public disclosure a company makes.

**Part I:**
- **Item 1: Business.** Description of the company's operations, products, markets, and competitive landscape. This is where you understand what the company actually does.
- **Item 1A: Risk Factors.** Legally required disclosure of material risks. Often boilerplate, but changes between years can signal new concerns.
- **Item 2: Properties.** Physical assets and facilities.
- **Item 3: Legal Proceedings.** Pending litigation that could be material.

**Part II:**
- **Item 5: Market for Registrant's Common Equity.** Stock performance, dividends, and share repurchase data.
- **Item 6: Selected Financial Data.** (Removed for fiscal years ending after 2021 under SEC rule changes, but older filings still contain it.)
- **Item 7: Management's Discussion and Analysis (MD&A).** This is the most analytically valuable section after the financials themselves. Management explains the drivers behind the numbers — why revenue grew or declined, what affected margins, what they expect going forward.
- **Item 8: Financial Statements.** The audited income statement, balance sheet, cash flow statement, statement of stockholders' equity, and all accompanying footnotes. This is where model data comes from.

**Key characteristic:** 10-K financials are **audited** by an independent accounting firm. The auditor's opinion is included in the filing. This is the highest level of assurance available for public company financial data.

## What's in a 10-Q

The 10-Q is filed for the first three quarters of the fiscal year (the fourth quarter is covered by the 10-K). Large accelerated filers must file within 40 days of the quarter-end.

The 10-Q contains:

- **Financial Statements.** Income statement, balance sheet, and cash flow statement for the quarter and year-to-date.
- **MD&A.** Quarterly discussion of results, typically shorter than the 10-K version.
- **Quantitative and Qualitative Disclosures About Market Risk.** Interest rate exposure, currency risk, etc.

**Key difference:** 10-Q financials are **reviewed**, not audited. A review provides "limited assurance" — the auditor checks for obvious issues but doesn't perform the full procedures of an audit. In practice, the data is still highly reliable, but the distinction matters for understanding the confidence level.

## The Practical Differences for Modeling

| | **10-K** | **10-Q** |
|---|---|---|
| **Frequency** | Annual | Quarterly (Q1, Q2, Q3) |
| **Assurance level** | Audited | Reviewed |
| **Financial detail** | Full footnotes, segment data, detailed schedules | Condensed footnotes, less granular |
| **MD&A depth** | Comprehensive — full year discussion | Shorter — quarter-focused |
| **Filing deadline** | 60 days (large accelerated) | 40 days (large accelerated) |
| **Best for** | Building the initial model, annual updates | Quarterly model updates, tracking trends |

## What to Pull from the 10-K

When building a financial model from scratch, the 10-K is your starting point. Extract:

**Income statement (5-10 years):**
Revenue, COGS, gross profit, R&D, SG&A, operating income, interest expense, tax expense, net income. The 10-K typically presents two to three years of comparative data; for longer histories, you need older filings.

**Balance sheet:**
Cash, accounts receivable, inventory, PP&E, total assets, accounts payable, short-term debt, long-term debt, total equity, shares outstanding.

**Cash flow statement:**
Operating cash flow, depreciation and amortization, capital expenditures, acquisitions, debt issuance and repayment, share repurchases, dividends.

**Footnotes — don't skip these:**
- **Revenue recognition policies** — how the company recognizes revenue matters for projections
- **Debt schedules** — maturity dates, interest rates, covenants
- **Lease obligations** — especially post-ASC 842
- **Segment reporting** — revenue and operating income by business segment, critical for companies with diverse operations
- **Stock-based compensation** — affects diluted share count and is a real economic cost

## What to Pull from the 10-Q

For quarterly updates to an existing model:

**Quarterly income statement data.** Revenue, margins, and expense trends. The 10-Q shows both the quarter and year-to-date figures. To get a single quarter's data when only year-to-date is reported, subtract the prior year-to-date from the current one.

**Updated balance sheet.** Cash position, debt levels, and working capital as of the quarter-end. These change meaningfully within the year and affect your valuation.

**Cash flow year-to-date.** Track capex run-rate, working capital trends, and cash generation against your annual model assumptions.

**MD&A for guidance changes.** Companies often update forward guidance or discuss changing conditions in the quarterly MD&A. These inform your projection assumptions.

## How XBRL Makes This Extractable

Since 2009, the SEC has required public companies to file financial data in XBRL (eXtensible Business Reporting Language). Each financial line item is tagged with a standardized identifier — for example, `us-gaap:Revenues` for revenue, `us-gaap:NetIncomeLoss` for net income.

This tagging means the data in both 10-K and 10-Q filings is machine-readable. Automated tools can extract specific line items across companies and time periods without parsing the document text. The XBRL taxonomy has approximately 17,000 standard elements, covering virtually every financial line item a company might report.

The practical result: pulling five years of revenue data for Microsoft, Apple, and Google doesn't require reading three sets of filings manually. The XBRL tags make it a structured data query.

## Common Pitfalls

**Don't mix audited and unaudited data without noting it.** If your model uses 10-K data for annual periods and 10-Q data for the most recent quarter, be aware that the quarterly data has a lower assurance level. This rarely causes issues in practice, but it's worth knowing.

**Watch for restatements.** When a company restates prior financials, the restated numbers appear in subsequent filings. If you're pulling historical data from the original filing rather than the most recent one, you might be using pre-restatement numbers. Automated extraction from the latest filing avoids this.

**Quarter isolation requires math.** If a company reports Q3 year-to-date revenue of $15 billion and Q2 year-to-date revenue of $10 billion, Q3 standalone revenue is $5 billion. Some companies report quarterly figures directly; others only report year-to-date. Check before assuming.

**Fiscal year ≠ calendar year.** Microsoft's fiscal year ends in June. Apple's ends in September. Walmart's ends in January. When comparing companies or building timelines, always check the fiscal year-end date in the 10-K header.

## Using Both Filings Together

The most effective approach for financial modeling uses both filings:

1. **Build the model from 10-K data.** Use the annual filing for the historical foundation — it has the most detail, the highest assurance level, and the most comprehensive footnotes.

2. **Update quarterly from 10-Q data.** When a new 10-Q drops, update the model with current-year actuals and revise projections based on the latest trends and guidance.

3. **Read the MD&A in both.** The 10-K MD&A gives you the full-year narrative. The 10-Q MD&A tells you what's changing within the year. Together, they give you the most complete picture of management's view of the business.

4. **Re-baseline annually.** When the new 10-K is filed, re-pull the full dataset. The annual filing may include restated figures, updated segment reporting, or revised historical data that supersedes what was in the quarterly filings.

This cycle — annual build, quarterly update — is the standard workflow for maintaining coverage models. Automating the data extraction step means the quarterly update takes minutes instead of hours.
