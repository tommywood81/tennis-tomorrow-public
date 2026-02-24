"""
Display fine-tuner for Tennis Abstract match history.

Applies cosmetic improvements to parsed display data before sending to frontend.
Runs after base formatting (neutral_parser + display_mapper).
"""

from typing import Dict, Any, List


def fine_tune_display(display_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fine-tune display data for frontend presentation.

    - Trims whitespace in each field
    - Strips trailing empty fields per row
    - Adds comma-separated formatted_line for display
    """
    table_rows = display_data.get("table_rows", [])
    tuned_rows = []

    for row in table_rows:
        fields = row.get("fields", [])
        trimmed = _tune_fields(fields)
        formatted_line = ", ".join(f for f in trimmed if f)
        tuned_rows.append({**row, "fields": trimmed, "formatted_line": formatted_line})

    return {**display_data, "table_rows": tuned_rows}


def _tune_fields(fields: List[str]) -> List[str]:
    """Trim whitespace and strip trailing empty fields."""
    trimmed = [str(f).strip() if f else "" for f in fields]
    while len(trimmed) > 1 and trimmed[-1] == "":
        trimmed.pop()
    return trimmed
