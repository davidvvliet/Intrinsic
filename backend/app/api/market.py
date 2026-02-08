import yfinance as yf
import json


def get_stock_quote(ticker: str) -> dict:
    """
    Get current stock price and market data for a ticker.
    Uses Yahoo Finance via yfinance library.
    """
    try:
        stock = yf.Ticker(ticker.upper())
        info = stock.info

        # Handle case where ticker is invalid
        if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
            return {
                "ticker": ticker.upper(),
                "error": f"Could not find data for ticker: {ticker}"
            }

        result = {
            "ticker": ticker.upper(),
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "price_to_book": info.get("priceToBook"),
            "dividend_yield": info.get("dividendYield"),
            "52_week_high": info.get("fiftyTwoWeekHigh"),
            "52_week_low": info.get("fiftyTwoWeekLow"),
            "50_day_avg": info.get("fiftyDayAverage"),
            "200_day_avg": info.get("twoHundredDayAverage"),
            "beta": info.get("beta"),
            "volume": info.get("volume"),
            "avg_volume": info.get("averageVolume"),
        }

        # Log data returned to LLM
        print(f"[MARKET] Quote for {ticker.upper()}:", flush=True)
        print(json.dumps(result, indent=2), flush=True)

        return result

    except Exception as e:
        return {
            "ticker": ticker.upper(),
            "error": str(e)
        }
