"""
Currency configuration and constants for the Velo application.
Defines supported currencies with their symbols and names.
"""

from typing import Dict, List, NamedTuple


class CurrencyInfo(NamedTuple):
    """Currency information structure"""

    code: str
    symbol: str
    name: str


# Mainstream supported currencies
SUPPORTED_CURRENCIES: List[CurrencyInfo] = [
    CurrencyInfo("USD", "$", "US Dollar"),
    CurrencyInfo("EUR", "€", "Euro"),
    CurrencyInfo("GBP", "£", "British Pound"),
    CurrencyInfo("JPY", "¥", "Japanese Yen"),
    CurrencyInfo("KRW", "₩", "South Korean Won"),
    CurrencyInfo("SGD", "S$", "Singapore Dollar"),
    CurrencyInfo("CNY", "¥", "Chinese Yuan"),
    CurrencyInfo("CAD", "C$", "Canadian Dollar"),
    CurrencyInfo("AUD", "A$", "Australian Dollar"),
]

# Default currency
DEFAULT_CURRENCY = "USD"

# Create lookup dictionaries for easy access
CURRENCY_CODES: List[str] = [curr.code for curr in SUPPORTED_CURRENCIES]
CURRENCY_MAP: Dict[str, CurrencyInfo] = {
    curr.code: curr for curr in SUPPORTED_CURRENCIES
}


def is_supported_currency(currency_code: str) -> bool:
    """Check if a currency code is supported"""
    return currency_code.upper() in CURRENCY_CODES


def get_currency_info(currency_code: str) -> CurrencyInfo:
    """Get currency information by code"""
    currency_code = currency_code.upper()
    if currency_code not in CURRENCY_MAP:
        raise ValueError(f"Unsupported currency: {currency_code}")
    return CURRENCY_MAP[currency_code]


def get_currency_symbol(currency_code: str) -> str:
    """Get currency symbol by code"""
    return get_currency_info(currency_code).symbol


def get_currency_name(currency_code: str) -> str:
    """Get currency name by code"""
    return get_currency_info(currency_code).name
