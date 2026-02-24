"""
Neutral parser for Tennis Abstract match history.

This parser extracts all rows from pasted text and attaches metadata
without dropping any rows. It is used by both display and inference layers.

Architecture:
- Normalizer (shared) → Neutral Parser → Display Mapper / Inference Mapper
"""

import re
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

from .text_normalizer import normalize_text


@dataclass
class NeutralParsedRow:
    """
    Represents a single parsed row with all values as strings.
    
    This is the neutral representation that both display and inference
    mappers consume. No rows are dropped at this stage.
    """
    row_index: int  # Original line number (0-based)
    fields: List[str]  # All field values as strings
    original_line: str  # Original normalized line
    
    # Metadata flags (determined without dropping the row)
    is_header: bool = False
    is_walkover: bool = False
    is_retirement: bool = False
    is_upcoming: bool = False
    is_incomplete: bool = False
    parse_errors: List[str] = None
    
    def __post_init__(self):
        if self.parse_errors is None:
            self.parse_errors = []


class NeutralTennisAbstractParser:
    """
    Neutral parser that never drops rows.
    
    This parser:
    - Splits rows into fields (as strings)
    - Preserves row order
    - Attaches metadata per row
    - Never drops rows (even invalid ones)
    """
    
    def __init__(self):
        self.column_map: Dict[str, int] = {}
        self.has_header = False
    
    def parse(self, text: str) -> List[NeutralParsedRow]:
        """
        Parse text into neutral rows with metadata.
        
        Args:
            text: Raw pasted text
            
        Returns:
            List of NeutralParsedRow objects (never empty, preserves all rows)
        """
        # Normalize text using shared normalizer
        normalized_lines = normalize_text(text)
        
        if not normalized_lines:
            return []
        
        rows = []
        
        # Detect header row
        header_idx = self._find_header_row(normalized_lines)
        
        if header_idx >= 0:
            self.has_header = True
            self._parse_header(normalized_lines[header_idx])
            data_start = header_idx + 1
        else:
            self.has_header = False
            data_start = 0
        
        # Parse all data rows (never drop any)
        for idx, line in enumerate(normalized_lines[data_start:], start=data_start):
            row = self._parse_line(line, idx)
            if row:
                rows.append(row)
        
        return rows
    
    def _find_header_row(self, lines: List[str]) -> int:
        """Find header row by looking for common column names."""
        for idx, line in enumerate(lines[:5]):  # Check first 5 lines
            lower_line = line.lower()
            header_keywords = ['date', 'rank', 'opponent', 'tournament', 'surface', 'result', 'w/l']
            matches = sum(1 for kw in header_keywords if kw in lower_line)
            
            if matches >= 3:  # Found at least 3 header keywords
                return idx
        
        return -1
    
    def _parse_header(self, header_line: str):
        """Parse header line and map column names to indices."""
        # Split by tabs first, then multiple spaces
        if '\t' in header_line:
            columns = header_line.split('\t')
        else:
            columns = re.split(r'\s{2,}', header_line)
        
        self.column_map = {}
        mapped_indices = set()
        
        for idx, col in enumerate(columns):
            col_lower = col.lower().strip()
            
            if not col_lower:
                continue
            
            # Map known patterns
            patterns = {
                'date': r'date|dt',
                'rank': r'^rk$|rank|player.*rank',
                'opponent_rank': r'v.*rk|opp.*rank|opponent.*rank',
                'tournament': r'tournament|tourney|event',
                'surface': r'surface|surf',
                'round': r'round|rd',
                'result': r'^w/l$|result|^res$',
                'score': r'score',
                'first_in_pct': r'1stin|1st.*in',
                'first_won_pct': r'1st%|1stwon',
                'second_won_pct': r'2nd%|2ndwon',
            }
            
            for field, pattern in patterns.items():
                if re.search(pattern, col_lower, re.IGNORECASE):
                    self.column_map[field] = idx
                    mapped_indices.add(idx)
                    break
        
        # Detect match description column (unnamed, between vRk and Score)
        opponent_rank_idx = self.column_map.get('opponent_rank', -1)
        score_idx = self.column_map.get('score', -1)
        
        if opponent_rank_idx >= 0 and score_idx >= 0:
            for candidate_idx in range(opponent_rank_idx + 1, score_idx):
                if candidate_idx not in mapped_indices:
                    self.column_map['match_description'] = candidate_idx
                    break
        elif opponent_rank_idx >= 0:
            match_desc_idx = opponent_rank_idx + 1
            if match_desc_idx < len(columns) and match_desc_idx not in mapped_indices:
                self.column_map['match_description'] = match_desc_idx
    
    def _parse_line(self, line: str, row_index: int) -> Optional[NeutralParsedRow]:
        """Parse a single line into a NeutralParsedRow."""
        if not line.strip():
            return None
        
        # Split into fields
        if '\t' in line:
            fields = line.split('\t')
        elif re.search(r'\s{2,}', line):
            fields = re.split(r'\s{2,}', line)
        else:
            fields = line.split()
        
        # Clean fields
        fields = [f.strip() for f in fields]
        
        # Determine metadata
        metadata = self._extract_metadata(fields, line)
        
        return NeutralParsedRow(
            row_index=row_index,
            fields=fields,
            original_line=line,
            **metadata
        )
    
    def _extract_metadata(self, fields: List[str], line: str) -> Dict[str, Any]:
        """
        Extract metadata flags without dropping the row.
        
        This determines what type of row this is, but doesn't filter it out.
        """
        metadata = {
            'is_header': False,
            'is_walkover': False,
            'is_retirement': False,
            'is_upcoming': False,
            'is_incomplete': False,
            'parse_errors': []
        }
        
        line_lower = line.lower()
        
        # Check for upcoming match
        if ' vs ' in line_lower or ' vs\n' in line_lower:
            metadata['is_upcoming'] = True
        
        # Check for walkover/retirement
        if any(marker in line_lower for marker in ['w/o', 'wo', 'walkover']):
            metadata['is_walkover'] = True
        
        if any(marker in line_lower for marker in ['ret', 'retirement', 'retired']):
            metadata['is_retirement'] = True
        
        # Check for incomplete data (missing required fields)
        # Required: date, at least some match info
        if len(fields) < 3:
            metadata['is_incomplete'] = True
            metadata['parse_errors'].append("Too few fields")
        
        # Rows with empty Rk or vRk are ignored by inference - align display count
        if self.column_map and not metadata['is_header']:
            for col_key, err_msg in [('rank', 'Missing Rk'), ('opponent_rank', 'Missing vRk')]:
                idx = self.column_map.get(col_key, -1)
                if idx >= 0 and idx < len(fields):
                    val = (fields[idx] or '').strip().lower()
                    null_like = not val or val in {'-', '—', '–', 'na', 'n/a', 'nan', '.'}
                    if null_like:
                        metadata['is_incomplete'] = True
                        metadata['parse_errors'].append(err_msg)
                        break
        
        # Check if it looks like a header row
        if self._looks_like_header(fields):
            metadata['is_header'] = True
        
        return metadata
    
    def _looks_like_header(self, fields: List[str]) -> bool:
        """Check if fields look like a header row."""
        if not fields:
            return False
        
        header_keywords = ['date', 'rank', 'opponent', 'tournament', 'surface', 'result', 'w/l']
        first_few = ' '.join(fields[:5]).lower()
        matches = sum(1 for kw in header_keywords if kw in first_few)
        
        return matches >= 2
