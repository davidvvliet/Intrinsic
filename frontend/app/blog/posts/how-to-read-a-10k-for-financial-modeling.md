---
title: "How Do You Read a 10-K for Financial Modeling?"
date: "2026-03-15"
description: "A practical guide to navigating an SEC 10-K filing and extracting the financial data you need to build a financial model — including which sections matter most."
readTime: "8 min read"
---

## What Is a 10-K?

A 10-K is the annual report that every US public company is legally required to file with the Securities and Exchange Commission. It contains the company's audited financial statements for the full fiscal year, along with management's discussion of results, risk factors, business descriptions, and extensive footnotes.

For financial modeling, the 10-K is the primary source document. It's the most complete and audited picture of a company's finances that exists. Understanding how to navigate it efficiently is a foundational skill for anyone building equity research models.

The average 10-K runs 30,000 to 60,000 words. You don't read all of it every time. This guide covers which parts matter for modeling and what to look for in each.

## The Structure of a 10-K

10-Ks follow a standardized format mandated by the SEC. The key sections for financial modeling are:

**Item 1 — Business**
A description of the company's business, products, markets, and competitive position. Read this to understand the revenue model before you start projecting.

**Item 1A — Risk Factors**
Legally required disclosure of risks that could materially affect the business. Often boilerplate, but sometimes contains meaningful disclosures about specific business vulnerabilities.

**Item 7 — Management's Discussion and Analysis (MD&A)**
Management's explanation of financial results. This is the most analytically useful part of the 10-K for modeling. Read the MD&A before building projections.

**Item 8 — Financial Statements and Supplementary Data**
The actual financial statements: income statement, balance sheet, cash flow statement, and statement of stockholders' equity. Plus the footnotes.

**Item 9A — Controls and Procedures**
Auditor sign-off. If there are material weaknesses in internal controls, they'll be disclosed here. Relevant for model reliability.

## How to Navigate Item 7: The MD&A

The MD&A is where management explains what happened and why. For modeling, it tells you things the income statement can't:

**Revenue breakdown**: Most companies report revenue in aggregate on the income statement. The MD&A typically breaks it down by segment, product line, or geography. This is where you understand what's actually driving growth.

**Margin commentary**: Management will explain changes in gross margin or operating margin. These explanations tell you whether margin movements are structural (pricing power improving, cost structure changing) or one-time (commodity spike, one-time charge).

**Forward-looking statements**: Companies often provide guidance for the coming year in the MD&A or in the earnings release filed alongside the 10-K. Revenue guidance and margin expectations directly inform your near-term projections.

**Headcount and operating leverage**: Some companies disclose headcount trends. For high-fixed-cost businesses, understanding the relationship between headcount growth and revenue growth tells you a lot about operating leverage.

## How to Navigate Item 8: The Financial Statements

**Income Statement**

Pull these line items for at least five years (ten if you want to see through a full business cycle):

- Revenue
- Cost of Revenue (or Cost of Goods Sold)
- Gross Profit
- R&D Expense (if disclosed separately)
- SG&A Expense
- Operating Income (EBIT)
- Interest Expense
- Pre-tax Income
- Tax Expense
- Net Income
- Diluted EPS and diluted shares outstanding

**Balance Sheet**

Key items for working capital and capital structure:

- Cash and equivalents
- Accounts Receivable
- Inventory (if applicable)
- Total Current Assets
- Property, Plant and Equipment (net)
- Goodwill and Intangibles (note the amortization schedule in footnotes)
- Accounts Payable
- Total Debt (short and long-term; don't miss operating lease liabilities post-ASC 842)
- Shareholders' Equity

**Cash Flow Statement**

The cash flow statement often contains items not visible in the income statement:

- Depreciation and Amortization (in operating activities — the primary non-cash add-back)
- Stock-Based Compensation (non-cash; significant for tech companies)
- Capital Expenditures (in investing activities, labeled "Purchases of PP&E")
- Acquisitions (also in investing activities)
- Free cash flow is operating cash flow minus capex

## The Footnotes: Where Important Details Hide

The footnotes to the financial statements are where most analysts underinvest. They're dense and often dense for a reason.

**Revenue Recognition (ASC 606)**
How and when does the company recognize revenue? Subscription businesses, multi-year contracts, and software companies often have complex recognition rules. A change in recognition policy can make revenue look like it's growing when the underlying business isn't.

**Debt Schedule**
Note on long-term debt typically breaks out each debt tranche, the interest rate, and the maturity date. This is what you use to model interest expense accurately and assess refinancing risk.

**Lease Obligations**
Since ASC 842 (effective 2019), operating leases appear on the balance sheet. The footnotes show the maturity schedule. For retail, restaurant, or other asset-heavy businesses, lease obligations can be material.

**Goodwill and Impairment**
When a company acquires others, the purchase price above book value gets recorded as goodwill. If the acquisition underperforms, goodwill is written down — a non-cash charge that hits the income statement. The footnotes show the goodwill balance by segment.

**Segment Reporting**
If a company has multiple business segments, the segment footnote breaks out revenue, operating income, and sometimes assets by segment. This is often more useful for modeling than the consolidated financials.

## What to Look for When Building Projections

Once you've extracted the historical data, the modeling work begins. The 10-K gives you signals for every major projection:

**Revenue growth**: Historical growth rates from Item 8 combined with guidance and market discussion from Item 7.

**Gross margin**: Track the trend and read the MD&A explanation for any changes. Is the margin improvement structural (better pricing, higher mix of high-margin products) or temporary?

**Operating expenses**: Are R&D and SG&A growing faster or slower than revenue? This tells you whether the company has operating leverage or is investing ahead of growth.

**Capex intensity**: Capex as a percentage of revenue is relatively stable for most businesses. Large deviations (a new facility, a major technology investment) are discussed in the MD&A.

**Working capital**: Days Sales Outstanding, Days Inventory Outstanding, and Days Payable Outstanding can be derived from the balance sheet and income statement. Trends in these metrics affect free cash flow generation.

## Using Automated Tools to Extract 10-K Data

Doing this manually is time-consuming. A single 10-K — even after you know where to look — takes hours to extract comprehensively. Multiply that by five years of history across both the 10-K and trailing 10-Qs, and the data work alone becomes a multi-day exercise.

SEC filings are structured using XBRL tagging, which means every labeled financial figure can be extracted systematically by software. Automated financial modeling tools use XBRL to pull income statement, balance sheet, and cash flow data directly from EDGAR, bypassing the manual extraction step entirely.

The quality of the model output is the same — you're getting the same numbers from the same source — but the time to a working model drops from hours to seconds. The analyst can move directly to the analytical work: building projections, setting assumptions, and forming a view.

The 10-K is still worth reading. The MD&A, risk factors, and footnotes contain qualitative context that automated extraction doesn't capture. But the numerical data that populates the model doesn't need to be entered by hand.
