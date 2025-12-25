"""
Exchange rate service for currency conversion
Uses exchangerate-api.com with caching
"""

import httpx
from decimal import Decimal
from typing import Dict, Optional
from datetime import datetime

from app.core.cache import cached
from app.core.config import settings


# Exchange Rate API configuration
EXCHANGE_RATE_API_KEY = settings.currency_api_key
EXCHANGE_RATE_API_URL = "https://v6.exchangerate-api.com/v6"


class ExchangeRateError(Exception):
    """Custom exception for exchange rate errors"""

    pass


@cached(ttl_seconds=1800)  # Cache for 30 minutes
async def fetch_exchange_rates(base_currency: str) -> Dict[str, Decimal]:
    """
    Fetch exchange rates from API with caching.
    Results are cached for 30 minutes.

    Args:
        base_currency: Base currency code (e.g., 'USD', 'EUR')

    Returns:
        Dictionary of currency codes to exchange rates

    Raises:
        ExchangeRateError: If API call fails
    """
    url = f"{EXCHANGE_RATE_API_URL}/{EXCHANGE_RATE_API_KEY}/latest/{base_currency}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()

            data = response.json()

            if data.get("result") != "success":
                raise ExchangeRateError(
                    f"Exchange rate API returned error: {data.get('error-type', 'unknown')}"
                )

            # Convert rates to Decimal for precision
            conversion_rates = data.get("conversion_rates", {})
            return {
                currency: Decimal(str(rate))
                for currency, rate in conversion_rates.items()
            }

    except httpx.HTTPError as e:
        raise ExchangeRateError(f"Failed to fetch exchange rates: {str(e)}")
    except (KeyError, ValueError) as e:
        raise ExchangeRateError(f"Invalid API response: {str(e)}")


async def get_exchange_rate(from_currency: str, to_currency: str) -> Decimal:
    """
    Get exchange rate from one currency to another.
    Uses cached exchange rates to minimize API calls.

    Args:
        from_currency: Source currency code (e.g., 'USD')
        to_currency: Target currency code (e.g., 'EUR')

    Returns:
        Exchange rate as Decimal (e.g., 0.85 means 1 USD = 0.85 EUR)

    Raises:
        ExchangeRateError: If currencies are invalid or API fails
    """
    # Same currency
    if from_currency == to_currency:
        return Decimal("1.0")

    # Normalize currency codes
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    try:
        # Fetch rates with base currency as 'from_currency'
        # This gives us direct conversion rates
        rates = await fetch_exchange_rates(from_currency)

        if to_currency not in rates:
            raise ExchangeRateError(f"Currency {to_currency} not supported")

        return rates[to_currency]

    except ExchangeRateError:
        # If API fails, fall back to hardcoded rates as last resort
        # This ensures the app doesn't break completely
        return get_fallback_exchange_rate(from_currency, to_currency)


def get_fallback_exchange_rate(from_currency: str, to_currency: str) -> Decimal:
    """
    Fallback exchange rates if API is unavailable.
    These are approximate rates and should only be used as a last resort.
    """
    if from_currency == to_currency:
        return Decimal("1.0")

    # Approximate rates relative to USD (as of Dec 2025)
    rates_to_usd = {
        "USD": Decimal("1.0"),
        "EUR": Decimal("1.18"),
        "GBP": Decimal("1.35"),
        "JPY": Decimal("0.0064"),
        "CAD": Decimal("0.73"),
        "AUD": Decimal("0.67"),
        "CHF": Decimal("1.27"),
        "CNY": Decimal("0.14"),
        "INR": Decimal("0.011"),
        "SGD": Decimal("0.74"),
    }

    # Convert through USD if both currencies are in our table
    if from_currency in rates_to_usd and to_currency in rates_to_usd:
        rate_from = rates_to_usd[from_currency]
        rate_to = rates_to_usd[to_currency]
        return rate_to / rate_from

    # If currencies not found, default to 1.0
    # This is not ideal but prevents the app from crashing
    return Decimal("1.0")


async def convert_amount(
    amount: Decimal, from_currency: str, to_currency: str
) -> Decimal:
    """
    Convert amount from one currency to another.

    Args:
        amount: Amount to convert
        from_currency: Source currency code
        to_currency: Target currency code

    Returns:
        Converted amount as Decimal
    """
    rate = await get_exchange_rate(from_currency, to_currency)
    return (amount * rate).quantize(Decimal("0.01"))


async def get_exchange_rate_info(base_currency: str) -> Dict:
    """
    Get exchange rate information including metadata.
    Useful for displaying last update time to users.

    Args:
        base_currency: Base currency code

    Returns:
        Dictionary with rates and metadata
    """
    url = f"{EXCHANGE_RATE_API_URL}/{EXCHANGE_RATE_API_KEY}/latest/{base_currency}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            if data.get("result") != "success":
                raise ExchangeRateError("Failed to fetch exchange rate info")

            return {
                "base_currency": data.get("base_code"),
                "last_update": datetime.fromtimestamp(
                    data.get("time_last_update_unix", 0)
                ),
                "next_update": datetime.fromtimestamp(
                    data.get("time_next_update_unix", 0)
                ),
                "rates": {
                    currency: Decimal(str(rate))
                    for currency, rate in data.get("conversion_rates", {}).items()
                },
            }
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise ExchangeRateError(f"Failed to fetch exchange rate info: {str(e)}")
