"""
Staking strategy implementations for betting backtesting.
"""


def flat_stake(bankroll: float, stake_units: float, **kwargs) -> float:
    """
    Flat staking: bet a fixed amount regardless of edge.
    
    Args:
        bankroll: Current bankroll
        stake_units: Fixed stake amount
        **kwargs: Ignored
    
    Returns:
        Stake amount (capped at bankroll)
    """
    return min(stake_units, bankroll)


def kelly_fraction(bankroll: float, prob: float, odds: float, fraction: float = 1.0, **kwargs) -> float:
    """
    Kelly Criterion staking with fractional Kelly.
    
    Formula: f = (prob * odds - 1) / (odds - 1) * fraction
    
    Args:
        bankroll: Current bankroll
        prob: Model probability
        odds: Decimal odds
        fraction: Kelly fraction (0.25 = quarter Kelly, 0.5 = half Kelly, etc.)
        **kwargs: Ignored
    
    Returns:
        Stake amount (capped at 3% of bankroll and bankroll itself)
    """
    if odds <= 1.0:
        return 0.0
    
    f = (prob * odds - 1) / (odds - 1)
    f *= fraction
    f = max(f, 0)  # No negative stakes
    
    # Cap at 3% of bankroll to avoid over-betting
    return min(f * bankroll, 0.03 * bankroll, bankroll)


def threshold_stake(bankroll: float, prob: float, prob_thr: float, max_stake: float = 5.0, **kwargs) -> float:
    """
    Scale stake linearly based on probability above threshold.
    
    Args:
        bankroll: Current bankroll
        prob: Model probability
        prob_thr: Probability threshold
        max_stake: Maximum stake amount
        **kwargs: Ignored
    
    Returns:
        Stake amount (scaled linearly from 0 to max_stake based on prob above threshold)
    """
    if prob < prob_thr:
        return 0.0
    
    # Scale linearly: (prob - prob_thr) / 0.2 maps to [0, 1] for typical range
    scale = min((prob - prob_thr) / 0.2, 1.0)
    stake = max_stake * scale
    return min(stake, bankroll)


def odds_weighted_stake(bankroll: float, odds: float, odds_thr: float, max_stake: float = 5.0, **kwargs) -> float:
    """
    Scale stake linearly based on odds above threshold.
    
    Args:
        bankroll: Current bankroll
        odds: Decimal odds
        odds_thr: Odds threshold
        max_stake: Maximum stake amount
        **kwargs: Ignored
    
    Returns:
        Stake amount (scaled linearly from 0 to max_stake based on odds above threshold)
    """
    if odds < odds_thr:
        return 0.0
    
    # Scale linearly: (odds - odds_thr) / 1.0 maps to [0, 1] for typical range
    scale = min((odds - odds_thr) / 1.0, 1.0)
    stake = max_stake * scale
    return min(stake, bankroll)


# Strategy registry
STRATEGIES = {
    'flat': flat_stake,
    'quarter_kelly': lambda b, p, o, **kw: kelly_fraction(b, p, o, fraction=0.25, **kw),
    'third_kelly': lambda b, p, o, **kw: kelly_fraction(b, p, o, fraction=0.33, **kw),
    'half_kelly': lambda b, p, o, **kw: kelly_fraction(b, p, o, fraction=0.5, **kw),
    'two_third_kelly': lambda b, p, o, **kw: kelly_fraction(b, p, o, fraction=0.66, **kw),
    'full_kelly': lambda b, p, o, **kw: kelly_fraction(b, p, o, fraction=1.0, **kw),
    'threshold_stake': threshold_stake,
    'odds_weighted_stake': odds_weighted_stake,
}


def get_strategy(name: str):
    """
    Get a staking strategy by name.
    
    Args:
        name: Strategy name (e.g., 'flat', 'half_kelly')
    
    Returns:
        Strategy function
    
    Raises:
        ValueError: If strategy name not found
    """
    if name not in STRATEGIES:
        raise ValueError(f"Unknown strategy: {name}. Available: {list(STRATEGIES.keys())}")
    return STRATEGIES[name]
