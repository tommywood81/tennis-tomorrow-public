"""
Display mapper for Tennis Abstract match history.

Converts neutral parsed rows into display-friendly format for UI.
This layer prioritizes user trust and clarity - never silently drops rows.
"""

from typing import List, Dict, Any
from .neutral_parser import NeutralParsedRow


def map_to_display(rows: List[NeutralParsedRow], has_header: bool) -> Dict[str, Any]:
    """
    Map neutral parsed rows to display format.
    
    Args:
        rows: List of neutral parsed rows
        has_header: Whether the original text had a header row
        
    Returns:
        Dictionary with:
        - table_rows: List of formatted row objects
        - summary: Dict with counts (total_rows, valid_matches, ignored_rows)
    """
    # Filter out header rows for display
    data_rows = [r for r in rows if not r.is_header]
    
    table_rows = []
    valid_count = 0
    ignored_count = 0
    
    for row in data_rows:
        # Determine if this row will be ignored by inference
        will_be_ignored = (
            row.is_walkover or
            row.is_retirement or
            row.is_upcoming or
            row.is_incomplete or
            len(row.parse_errors) > 0
        )
        
        if not will_be_ignored:
            valid_count += 1
        else:
            ignored_count += 1
        
        # Format row for display
        display_row = {
            'row_index': row.row_index,
            'fields': row.fields,
            'is_ignored': will_be_ignored,
            'ignore_reasons': _get_ignore_reasons(row),
            'original_line': row.original_line,
        }
        
        table_rows.append(display_row)
    
    return {
        'table_rows': table_rows,
        'summary': {
            'total_rows': len(data_rows),
            'valid_matches': valid_count,
            'ignored_rows': ignored_count,
            'has_header': has_header,
        }
    }


def _get_ignore_reasons(row: NeutralParsedRow) -> List[str]:
    """Get list of reasons why this row will be ignored."""
    reasons = []
    
    if row.is_walkover:
        reasons.append("Walkover")
    if row.is_retirement:
        reasons.append("Retirement")
    if row.is_upcoming:
        reasons.append("Upcoming match")
    if row.is_incomplete:
        reasons.append("Incomplete data")
    if row.parse_errors:
        reasons.extend(row.parse_errors)
    
    return reasons
