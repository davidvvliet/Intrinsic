---
title: "How to Build a DCF Model from SEC Filings"
date: "2026-03-12"
description: "A step-by-step guide to building a discounted cash flow model using SEC 10-K and 10-Q data, including which line items to use and how to structure projections."
readTime: "10 min read"
---

## Why SEC Filings Are the Right Starting Point for a DCF

A DCF model is only as good as the historical data it's built on. Revenue growth rates, margin trajectories, capex intensity, and working capital dynamics are all backward-looking inputs that inform forward projections. If those historical numbers are wrong or inconsistently sourced, the model is wrong from the ground up.

SEC filings — specifically the 10-K (annual report) and 10-Q (quarterly report) — are the most reliable source of financial data for public companies. They're audited, legally required to be accurate, and structured in a format that makes systematic extraction possible. Every public company filing with the SEC reports income statement, balance sheet, and cash flow data in a standardized structure.

This is a step-by-step guide to building a DCF model from that data.

## Step 1: Pull the Income Statement

The income statement is the backbone of your revenue and margin projections. From the 10-K, extract the following for at least five years of history (ten years gives you a clearer picture of the business cycle):

- **Revenue** (or "Net Sales" / "Net Revenue" depending on the company)
- **Cost of Goods Sold** (or "Cost of Revenue")
- **Gross Profit**
- **Operating Expenses** — R&D, SG&A, and any other operating line items reported separately
- **Operating Income** (EBIT)
- **Depreciation and Amortization** (often disclosed in the cash flow statement or footnotes)
- **Interest Expense**
- **Tax Expense** and **Effective Tax Rate**
- **Net Income**

The SEC's XBRL tagging means these line items have standardized labels across companies, which makes automated extraction highly reliable. For manual extraction, the income statement appears in Item 8 of the 10-K (Financial Statements and Supplementary Data).

## Step 2: Pull the Cash Flow Statement

The cash flow statement gives you the data you can't derive purely from the income statement:

- **Depreciation and Amortization** (non-cash add-back in operating activities)
- **Capital Expenditures** (in investing activities, typically labeled "Purchases of property, plant and equipment")
- **Changes in Working Capital** (increases in accounts receivable, inventory, accounts payable)
- **Free Cash Flow** — you'll calculate this as Operating Cash Flow minus Capex

FCF is what the DCF actually values. Getting the components right matters.

## Step 3: Pull the Balance Sheet

You need selected balance sheet items for working capital calculations and to understand the capital structure:

- **Cash and cash equivalents**
- **Accounts Receivable**
- **Inventory** (if applicable)
- **Accounts Payable**
- **Total Debt** (short-term and long-term debt)
- **Shares Outstanding** (for equity value per share calculation at the end)

## Step 4: Build the Revenue Projection

With historical revenue data in hand, calculate year-over-year growth rates for each period. Look for:

- The trend line: is growth accelerating, decelerating, or stable?
- The business cycle: does the company have cyclical revenue, and where are we in that cycle?
- Management guidance: the 10-K and earnings releases typically include forward guidance or discussion of growth drivers in the MD&A (Management Discussion and Analysis) section

A common approach is to project a near-term growth rate (years 1-3) based on guidance and current trends, then step it down gradually to a long-term sustainable growth rate (typically GDP-level, 2-3%) over the forecast period.

## Step 5: Project Margins

Using the historical gross margin and EBIT margin data, project margins forward. Key questions:

- Are margins expanding or contracting, and why?
- Is the company investing heavily in R&D or SG&A that might compress near-term margins but drive future growth?
- How does the company's margin profile compare to peers?

Most DCF models project EBIT margin (or EBITDA margin) directly rather than projecting each expense line independently.

## Step 6: Calculate Free Cash Flow

From your projected income statement, calculate free cash flow for each year of the forecast period:

**EBIT × (1 - Tax Rate) = NOPAT**

**NOPAT + D&A - Capex - Change in Working Capital = Free Cash Flow to Firm**

Capex is typically projected as a percentage of revenue based on historical intensity. Working capital changes are derived from assumptions about receivables days, inventory days, and payables days.

## Step 7: Calculate the Discount Rate (WACC)

WACC is the weighted average cost of capital — the rate at which you discount future cash flows back to present value.

**WACC = (E/V × Ke) + (D/V × Kd × (1 - T))**

Where:
- **E/V** = equity as a percentage of total capital (from current market cap and total debt)
- **Ke** = cost of equity, calculated using CAPM: risk-free rate + beta × equity risk premium
- **D/V** = debt as a percentage of total capital
- **Kd** = cost of debt (pre-tax), approximated by interest expense / total debt
- **T** = effective tax rate

The risk-free rate is typically the current 10-year US Treasury yield. The equity risk premium is the expected excess return of equities over the risk-free rate — historical estimates cluster around 4-6%. Beta is available from financial data providers and reflects the company's historical price volatility relative to the market.

## Step 8: Calculate Terminal Value

The terminal value captures the value of all cash flows beyond the explicit forecast period. Two common methods:

**Gordon Growth Model:**
Terminal Value = FCF in final year × (1 + g) / (WACC - g)

Where g is the perpetuity growth rate, typically 2-3% for mature businesses.

**Exit Multiple Method:**
Terminal Value = EBITDA in final year × exit EV/EBITDA multiple

The exit multiple is benchmarked against where peers trade today. Both methods have merits; many practitioners calculate both and triangulate.

Terminal value typically accounts for 60-80% of total enterprise value in a DCF, which is why WACC and the terminal growth rate assumptions have an outsized impact on valuation.

## Step 9: Discount and Sum

Discount each year's free cash flow and the terminal value back to present value using WACC:

**PV = FCF / (1 + WACC)^n**

Sum all present values to get Enterprise Value. Then:

**Equity Value = Enterprise Value + Cash - Total Debt**

**Equity Value per Share = Equity Value / Shares Outstanding**

Compare this to the current stock price to assess whether the stock is trading above or below your intrinsic value estimate.

## Step 10: Sensitivity Analysis

No DCF output should be presented without a sensitivity table. At minimum, show how the equity value per share changes across a range of WACC assumptions and terminal growth rates — a standard 5×5 table is conventional.

The range of outputs from a sensitivity table tells you more than any single number. If your base case implies 20% upside but the sensitivity table shows that reasonable changes in assumptions produce valuations between 30% downside and 80% upside, the model is telling you the value is highly sensitive to assumptions you're uncertain about.

## The Manual vs. Automated Approach

The process above is the same whether you build the model manually or use an automated tool. The difference is how long step 1 through step 3 takes.

Manually, extracting five years of clean financials from SEC filings takes a few hours at minimum — longer if the company's reporting has changed formats, if there are restatements, or if line items need to be normalized across periods.

Automated tools pull from SEC XBRL data directly, populate the three statements instantly, and have the historical foundation of the model ready in seconds. The analytical work — projections, WACC, terminal value, sensitivity — still requires human judgment. But it starts from an accurate, current, fully-sourced set of historical data.

## Where the Real Work Is

The DCF mechanics are not where analysts create value. The mechanics are learnable and largely systematic. The value comes from having a view on the business — a differentiated opinion on the growth rate, the margin trajectory, or the appropriate discount rate — that the market hasn't fully priced.

That view requires reading the full 10-K, understanding the MD&A, analyzing competitors' filings, listening to earnings calls, and building conviction over time. Automated modeling handles the data infrastructure. The research is still on you.
