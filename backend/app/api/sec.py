import httpx
import json
from pathlib import Path
from typing import Optional

# SEC API requires a User-Agent header with contact info
SEC_USER_AGENT = "Intrinsic contact@runintrinsic.com"
SEC_BASE_URL = "https://data.sec.gov"

# Path to local company tickers JSON (same directory as this file)
TICKERS_JSON_PATH = Path(__file__).parent / "company_tickers.json"

# Cache for ticker -> CIK mapping
_ticker_to_cik: dict[str, int] = {}
_ticker_to_name: dict[str, str] = {}


def load_company_tickers() -> None:
    """
    Load company tickers from local JSON file and cache them.
    Call this on startup.
    """
    global _ticker_to_cik, _ticker_to_name

    if _ticker_to_cik:
        return  # Already loaded

    with open(TICKERS_JSON_PATH, "r") as f:
        data = json.load(f)

    # Build lookup maps
    # Format: {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}, ...}
    for entry in data.values():
        ticker = entry["ticker"].upper()
        _ticker_to_cik[ticker] = entry["cik_str"]
        _ticker_to_name[ticker] = entry["title"]

    print(f"[SEC] Loaded {len(_ticker_to_cik)} company tickers")


def get_cik(ticker: str) -> Optional[int]:
    """Get CIK number for a ticker symbol."""
    return _ticker_to_cik.get(ticker.upper())


def get_company_name(ticker: str) -> Optional[str]:
    """Get company name for a ticker symbol."""
    return _ticker_to_name.get(ticker.upper())


def format_cik(cik: int) -> str:
    """Format CIK as 10-digit zero-padded string."""
    return str(cik).zfill(10)


async def get_company_facts(ticker: str) -> Optional[dict]:
    """
    Fetch company facts (financial data) from SEC API.
    Returns the full facts response or None if not found.
    """
    cik = get_cik(ticker)
    if not cik:
        return None

    url = f"{SEC_BASE_URL}/api/xbrl/companyfacts/CIK{format_cik(cik)}.json"

    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={"User-Agent": SEC_USER_AGENT}
        )

        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()


# Mapping of common metric names to possible XBRL tags
# SEC filings use different tag names depending on the company
METRIC_MAPPINGS = {
    # Income Statement
    "revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
        "TotalRevenuesAndOtherIncome",
    ],
    "cost_of_revenue": [
        "CostOfRevenue",
        "CostOfGoodsAndServicesSold",
        "CostOfGoodsSold",
        "CostOfSales",
    ],
    "gross_profit": [
        "GrossProfit",
    ],
    "operating_income": [
        "OperatingIncomeLoss",
    ],
    "net_income": [
        "NetIncomeLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
        "ProfitLoss",
    ],
    "eps": [
        "EarningsPerShareBasic",
    ],
    "eps_diluted": [
        "EarningsPerShareDiluted",
    ],
    # Balance Sheet
    "total_assets": [
        "Assets",
    ],
    "current_assets": [
        "AssetsCurrent",
    ],
    "total_liabilities": [
        "Liabilities",
    ],
    "current_liabilities": [
        "LiabilitiesCurrent",
    ],
    "stockholders_equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    "cash": [
        "CashAndCashEquivalentsAtCarryingValue",
        "Cash",
    ],
    "total_debt": [
        "LongTermDebt",
        "LongTermDebtAndCapitalLeaseObligations",
        "DebtCurrent",
    ],
    "shares_outstanding": [
        "CommonStockSharesOutstanding",
        "WeightedAverageNumberOfSharesOutstandingBasic",
    ],
    # Cash Flow Statement
    "operating_cash_flow": [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
    "capex": [
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "PaymentsToAcquireProductiveAssets",
    ],
    "depreciation": [
        "DepreciationDepletionAndAmortization",
        "DepreciationAndAmortization",
        "Depreciation",
    ],
    "free_cash_flow": [
        "FreeCashFlow",  # Some companies report this directly
    ],
}

# Statement shortcuts that expand to multiple metrics
STATEMENT_SHORTCUTS = {
    "income_statement": [
        "revenue", "cost_of_revenue", "gross_profit", "operating_income",
        "net_income", "eps", "eps_diluted"
    ],
    "balance_sheet": [
        "total_assets", "current_assets", "total_liabilities", "current_liabilities",
        "stockholders_equity", "cash", "total_debt", "shares_outstanding"
    ],
    "cash_flow_statement": [
        "operating_cash_flow", "capex", "depreciation", "free_cash_flow"
    ],
}


def expand_metrics(metrics: list[str]) -> list[str]:
    """
    Expand statement shortcuts into individual metrics.
    Deduplicates while preserving order.
    """
    expanded = []
    for m in metrics:
        if m in STATEMENT_SHORTCUTS:
            expanded.extend(STATEMENT_SHORTCUTS[m])
        else:
            expanded.append(m)
    # Dedupe preserving order
    return list(dict.fromkeys(expanded))


def extract_metric(facts: dict, metric: str, periods: str = "annual") -> list[dict]:
    """
    Extract a specific metric from company facts.

    Args:
        facts: The full company facts response from SEC
        metric: One of the keys in METRIC_MAPPINGS (e.g., "revenue", "net_income")
        periods: "annual" for 10-K data, "quarterly" for 10-Q data

    Returns:
        List of {year, quarter (if quarterly), value, filed} dicts, sorted by date desc
    """
    us_gaap = facts.get("facts", {}).get("us-gaap", {})

    # Try each possible tag name for this metric
    tag_names = METRIC_MAPPINGS.get(metric, [metric])

    for tag_name in tag_names:
        if tag_name not in us_gaap:
            continue

        tag_data = us_gaap[tag_name]

        # Get USD values (most financial metrics are in USD)
        units = tag_data.get("units", {})
        values = units.get("USD", [])

        # For EPS and shares, might be in "shares" or pure numbers
        if not values:
            values = units.get("shares", [])
        if not values:
            values = units.get("pure", [])

        if not values:
            continue

        # Filter by period type
        # FY = Full Year (annual), Q1/Q2/Q3/Q4 = Quarterly
        results = []
        seen = set()  # Dedupe by (fy, fp)

        for entry in values:
            fy = entry.get("fy")  # Fiscal year
            fp = entry.get("fp")  # Fiscal period (FY, Q1, Q2, Q3, Q4)
            val = entry.get("val")
            filed = entry.get("filed")

            if fy is None or fp is None or val is None:
                continue

            # Filter by annual vs quarterly
            if periods == "annual" and fp != "FY":
                continue
            if periods == "quarterly" and fp == "FY":
                continue

            # Dedupe - keep most recently filed
            key = (fy, fp)
            if key in seen:
                continue
            seen.add(key)

            result = {
                "year": fy,
                "value": val,
                "filed": filed,
            }
            if periods == "quarterly":
                result["quarter"] = fp

            results.append(result)

        if results:
            # Sort by year (and quarter if applicable) descending
            results.sort(key=lambda x: (x["year"], x.get("quarter", "FY")), reverse=True)
            return results

    return []


async def get_financial_data(
    ticker: str,
    metrics: list[str],
    periods: str = "annual",
    limit_years: int = 5
) -> dict:
    """
    Get financial data for a company.

    Args:
        ticker: Stock ticker symbol (e.g., "AAPL")
        metrics: List of metrics to fetch. Can include statement shortcuts like
                 "income_statement", "balance_sheet", "cash_flow_statement"
        periods: "annual" or "quarterly"
        limit_years: Maximum number of years/periods to return (default 5)

    Returns:
        {
            "ticker": "AAPL",
            "company_name": "Apple Inc.",
            "data": {
                "revenue": [{"year": 2024, "value": 383285000000, "filed": "2024-11-01"}, ...],
                "net_income": [...],
            },
            "errors": ["metric_name_not_found", ...]  # Any metrics that couldn't be found
        }
    """
    company_name = get_company_name(ticker)
    if not company_name:
        return {
            "ticker": ticker,
            "error": f"Unknown ticker: {ticker}"
        }

    facts = await get_company_facts(ticker)
    if not facts:
        return {
            "ticker": ticker,
            "company_name": company_name,
            "error": "Could not fetch SEC data for this company"
        }

    # Expand any statement shortcuts
    expanded_metrics = expand_metrics(metrics)

    result = {
        "ticker": ticker.upper(),
        "company_name": company_name,
        "data": {},
        "errors": []
    }

    for metric in expanded_metrics:
        metric_data = extract_metric(facts, metric, periods)
        if metric_data:
            # Limit to requested number of years/periods
            result["data"][metric] = metric_data[:limit_years]
        else:
            result["errors"].append(f"{metric} not found")

    # Log data returned to LLM
    print(f"[SEC] Data for {ticker.upper()}:", flush=True)
    print(json.dumps(result, indent=2), flush=True)

    return result
