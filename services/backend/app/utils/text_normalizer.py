"""
Shared text normalizer for Tennis Abstract match history.

This module provides deterministic, model-agnostic text normalization
that is used by both display and inference parsers.
"""

import re
from typing import List


def normalize_text(text: str) -> List[str]:
    """
    Normalize raw pasted text into clean, line-based format.
    
    This function:
    - Trims leading/trailing whitespace
    - Preserves tabs (for tab-separated data)
    - Collapses multiple spaces (but preserves tabs)
    - Removes empty lines
    
    Args:
        text: Raw pasted text from user
        
    Returns:
        List of normalized lines (non-empty only)
    
    Note: Tabs are preserved because Tennis Abstract data is tab-separated.
    The parser needs tabs to properly split columns.
    """
    if not text:
        return []
    
    # Split into lines
    lines = text.split('\n')
    
    normalized_lines = []
    for line in lines:
        # Trim leading/trailing whitespace
        line = line.rstrip()  # Only strip trailing, preserve leading tabs
        
        # Skip empty lines
        if not line.strip():
            continue
        
        # If line contains tabs, preserve them (tab-separated format)
        # Only collapse multiple spaces, but keep tabs intact
        if '\t' in line:
            # For tab-separated: normalize spaces within fields, but keep tabs
            # Split by tabs, normalize spaces in each field, then rejoin
            parts = line.split('\t')
            normalized_parts = []
            for part in parts:
                # Normalize spaces within the field (collapse multiple spaces)
                normalized_part = re.sub(r' +', ' ', part.strip())
                normalized_parts.append(normalized_part)
            line = '\t'.join(normalized_parts)
        else:
            # For space-separated: collapse multiple spaces
            line = re.sub(r' +', ' ', line.strip())
        
        normalized_lines.append(line)
    
    return normalized_lines
