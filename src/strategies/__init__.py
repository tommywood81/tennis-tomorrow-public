"""
Betting staking strategies for backtesting.

Each strategy function takes:
- bankroll: Current bankroll amount
- prob: Model probability for the bet
- odds: Decimal odds for the bet
- **kwargs: Additional parameters (prob_thr, odds_thr, max_stake, etc.)

Returns: Stake amount (float)
"""

from .staking import (
    flat_stake,
    kelly_fraction,
    threshold_stake,
    odds_weighted_stake,
    get_strategy,
    STRATEGIES,
)

__all__ = [
    'flat_stake',
    'kelly_fraction',
    'threshold_stake',
    'odds_weighted_stake',
    'get_strategy',
    'STRATEGIES',
]
