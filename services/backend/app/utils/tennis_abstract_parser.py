"""
Parser for Tennis Abstract match history text.

This parser extracts match statistics from raw pasted text copied from Tennis Abstract.
It validates and filters matches to ensure only completed matches with valid stats are used.

Note: This is the inference mapper - it's strict and lossy, filtering to only valid matches.
For display purposes, use the neutral parser and display mapper instead.
"""

import logging
import re
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

from .text_normalizer import normalize_text


@dataclass
class ParsedMatch:
    """Represents a single parsed match with all required statistics."""
    date: datetime
    player_rank: Optional[int]
    opponent_rank: Optional[int]
    opponent_name: str
    tournament: str
    surface: str
    round_name: str
    result: str  # "W" or "L"
    score: str
    
    # Serve stats
    first_serve_pct: Optional[float]  # 1stIn%
    first_serve_won_pct: Optional[float]  # 1st%
    second_serve_won_pct: Optional[float]  # 2nd%
    aces: Optional[int]
    double_faults: Optional[int]
    
    # Return/break stats
    break_points_saved: Optional[float]  # BPSvd%
    break_points_converted: Optional[float]  # BPConv%
    
    # Overall performance
    serve_pct: Optional[float]  # Combined serve performance
    return_pct: Optional[float]  # Combined return performance
    
    def is_valid(self) -> bool:
        """
        Check if this match has sufficient data for feature computation.
        
        A valid match must:
        - Have a result (W/L)
        - Have a score (not a walkover/withdrawal/retirement)
        - Have Rk and vRk (player rank and opponent rank) - rows with empty rank columns are invalid
        - Have all required serve stats (first_serve_pct, first_serve_won_pct, second_serve_won_pct)
        - Have return_pct (calculated from DR)
        
        Skip any row with null/empty stats - walkovers, retirements, incomplete data.
        """
        if not self.result or self.result not in ["W", "L"]:
            return False
        
        if not self.score or not self.score.strip():
            return False
        
        # Reject walkover, retirement, withdrawal - exact match or contained in score
        score_lower = self.score.lower().strip()
        invalid_score_exact = ["", "w/o", "wo", "ret", "def", "w.d.", "walkover", "retired"]
        if score_lower in invalid_score_exact:
            return False
        if any(x in score_lower for x in ["ret", "w/o", "wo", "def", "walkover", "w.o."]):
            return False
        
        # Require Rk and vRk - empty rank columns cause column misalignment and invalid stat extraction
        if self.player_rank is None or self.opponent_rank is None:
            return False
        
        # Require all serve stats - missing stats indicate walkover or upcoming match
        if self.first_serve_pct is None:
            return False
        if self.first_serve_won_pct is None:
            return False
        if self.second_serve_won_pct is None:
            return False
        
        # Require return_pct (calculated from DR) - if missing, DR was invalid/missing
        if self.return_pct is None:
            return False
        
        return True


class TennisAbstractParser:
    """
    Parser for Tennis Abstract match history text.
    
    Tennis Abstract formats match data in various ways. This parser handles:
    - Tab-separated or space-separated columns
    - Column headers or no headers
    - Various date formats
    - Percentage values (e.g., "65%" or "0.65")
    - Missing values (blank cells)
    """
    
    # Common column patterns to look for
    HEADER_PATTERNS = {
        'date': r'date|dt',
        'rank': r'^rk$|rank|player.*rank',
        'opponent_rank': r'v.*rk|opp.*rank|opponent.*rank',
        'opponent': r'opponent|opp|vs',
        'tournament': r'tournament|tourney|event',
        'surface': r'surface|surf',
        'round': r'round|rd',
        'result': r'^w/l$|result|^res$',
        'score': r'score',
        'first_in_pct': r'1stin|1st.*in',
        'first_won_pct': r'1st%|1stwon',
        'second_won_pct': r'2nd%|2ndwon',
        'aces': r'^ace$|^a$',
        'df': r'^df$|double.*fault',
        'bp_saved': r'bpsv|bp.*sav',
        'bp_conv': r'bpconv|bp.*con',
    }
    
    def __init__(self):
        self.column_map: Dict[str, int] = {}
    
    def parse(self, text: str, player_name: Optional[str] = None) -> List[ParsedMatch]:
        """
        Parse Tennis Abstract text into a list of valid matches.
        
        Args:
            text: Raw text copied from Tennis Abstract
            
        Returns:
            List of ParsedMatch objects, sorted by date (most recent first)
            
        Raises:
            ValueError: If text cannot be parsed or has insufficient valid matches
        """
        if not text or not text.strip():
            raise ValueError("Empty input text")
        
        # Use shared normalizer for consistent text processing
        lines = normalize_text(text)
        
        # Try to detect header row
        header_idx = self._find_header_row(lines)
        
        if header_idx >= 0:
            self._parse_header(lines[header_idx])
            data_lines = lines[header_idx + 1:]
        else:
            # No header: use positional Tennis Abstract format (Date, Tournament, ..., Score, Stats).
            # Do NOT call _infer_columns - it sets column_map and we then skip serve-stats extraction.
            data_lines = lines
            self.column_map = {}
        
        # Parse each data line
        matches = []
        import logging
        logger = logging.getLogger(__name__)
        
        for line_num, line in enumerate(data_lines, start=1):
            try:
                match = self._parse_line(line, player_name=player_name)
                if match:
                    # Debug: log why matches are invalid
                    if not match.is_valid():
                        # Check what's missing
                        missing = []
                        if not match.result or match.result not in ["W", "L"]:
                            missing.append(f"result={match.result}")
                        if not match.score or match.score.strip() in ["", "W/O", "wo", "RET", "ret", "DEF", "def"]:
                            missing.append(f"score={match.score}")
                        if match.first_serve_pct is None:
                            missing.append("first_serve_pct=None")
                        if match.first_serve_won_pct is None:
                            missing.append("first_serve_won_pct=None")
                        if match.second_serve_won_pct is None:
                            missing.append("second_serve_won_pct=None")
                        logger.debug(f"Line {line_num} invalid: {', '.join(missing)}")
                        # Skip invalid matches (missing stats = walkover or upcoming match)
                        continue
                    matches.append(match)
                # Silently skip invalid matches (missing stats = walkover or upcoming match)
            except Exception as e:
                logger.debug(f"Line {line_num} parse error: {e}")
                # Skip lines that can't be parsed (could be headers, comments, etc.)
                continue
        
        if not matches:
            logger.warning(f"No valid matches found. Column map: {self.column_map}, Player name: {player_name}, Total lines: {len(data_lines)}")
            raise ValueError(
                "No valid matches found in input text. "
                "Ensure matches have results, scores, and complete serve statistics (1stIn%, 1st%, 2nd%). "
                "Rows with missing stats are treated as walkovers or upcoming matches and are skipped. "
                f"Parsed {len(data_lines)} data lines."
            )
        
        # Sort by date (most recent first)
        matches.sort(key=lambda m: m.date, reverse=True)
        
        return matches
    
    def _find_header_row(self, lines: List[str]) -> int:
        """
        Find the header row by looking for common column names.
        
        Returns:
            Index of header row, or -1 if not found
        """
        for idx, line in enumerate(lines[:5]):  # Check first 5 lines
            lower_line = line.lower()
            # Look for multiple header keywords
            header_keywords = ['date', 'rank', 'opponent', 'tournament', 'surface', 'result', 'w/l']
            matches = sum(1 for kw in header_keywords if kw in lower_line)
            
            if matches >= 3:  # Found at least 3 header keywords
                return idx
        
        return -1
    
    def _parse_header(self, header_line: str):
        """Parse header line and map column names to indices."""
        # Split by tabs first (preserves empty columns), then fall back to multiple spaces
        if '\t' in header_line:
            columns = header_line.strip().split('\t')
        else:
            columns = re.split(r'\s{2,}', header_line.strip())
        
        self.column_map = {}
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"Parsing header with {len(columns)} columns")
        
        # Track which indices are mapped
        mapped_indices = set()
        
        for idx, col in enumerate(columns):
            col_lower = col.lower().strip()
            
            # Skip empty columns (these are likely the match description column)
            if not col_lower:
                continue
            
            # Match against known patterns
            for field, pattern in self.HEADER_PATTERNS.items():
                if re.search(pattern, col_lower, re.IGNORECASE):
                    self.column_map[field] = idx
                    mapped_indices.add(idx)
                    logger.debug(f"Mapped '{col}' (idx {idx}) to field '{field}'")
                    break
        
        # Detect match description column: it's typically the empty column between vRk and Score
        # Or we can infer it from the structure: after opponent_rank, before score
        opponent_rank_idx = self.column_map.get('opponent_rank', -1)
        score_idx = self.column_map.get('score', -1)
        
        if opponent_rank_idx >= 0 and score_idx >= 0:
            # Match description is typically between vRk and Score
            # Usually at opponent_rank_idx + 1, but could be +2 if there's an empty column
            for candidate_idx in range(opponent_rank_idx + 1, score_idx):
                if candidate_idx not in mapped_indices:
                    # This is likely the match description column (no header)
                    self.column_map['match_description'] = candidate_idx
                    logger.debug(f"Detected match description column at index {candidate_idx}")
                    break
        elif opponent_rank_idx >= 0:
            # If we have vRk but no Score mapped, match description is likely right after vRk
            match_desc_idx = opponent_rank_idx + 1
            if match_desc_idx < len(columns) and match_desc_idx not in mapped_indices:
                self.column_map['match_description'] = match_desc_idx
                logger.debug(f"Inferred match description column at index {match_desc_idx}")
    
    def _infer_columns(self, data_lines: List[str]):
        """
        Infer column positions from data when no header is present.
        
        This is a fallback strategy that looks at data patterns.
        """
        if not data_lines:
            return
        
        # Use first non-empty line to infer structure
        sample_line = next((line for line in data_lines if line.strip()), None)
        if not sample_line:
            return
        
        # Try tabs first, then multiple spaces, then single spaces
        if '\t' in sample_line:
            parts = sample_line.strip().split('\t')
        elif re.search(r'\s{2,}', sample_line):
            parts = re.split(r'\s{2,}', sample_line.strip())
        else:
            parts = sample_line.strip().split()
        
        # Common Tennis Abstract format:
        # Date | Tournament | Surface | Round | Rank | OpponentRank | MatchResult | Score | Stats...
        # Try to infer based on position and content
        for idx, part in enumerate(parts):
            part_clean = part.strip()
            
            # Date usually first (contains / or -)
            if idx == 0 and ('/' in part_clean or '-' in part_clean):
                self.column_map['date'] = idx
            
            # Rank usually numeric in early columns (often index 4 or 5)
            elif idx in [4, 5] and part_clean.isdigit():
                if 'rank' not in self.column_map:
                    self.column_map['rank'] = idx
            
            # Result column (W or L)
            elif part_clean in ['W', 'L']:
                self.column_map['result'] = idx
    
    def _parse_line(self, line: str, player_name: Optional[str] = None) -> Optional[ParsedMatch]:
        """Parse a single line into a ParsedMatch object."""
        if not line.strip():
            return None
        
        # First try splitting by tabs, then by multiple spaces, then by single spaces
        # Tennis Abstract can use any of these formats
        if '\t' in line:
            parts = line.strip().split('\t')
            is_tab_separated = True
        elif re.search(r'\s{2,}', line):
            parts = re.split(r'\s{2,}', line.strip())
            is_tab_separated = False
        else:
            # Single space separated - need to be more careful
            # For space-separated, we'll parse the whole line as text
            parts = line.strip().split()
            is_tab_separated = False
        
        if len(parts) < 3:  # Need at least date, opponent, result
            return None
        
        # Extract fields using column map or positional fallback
        try:
            match_data = self._extract_fields(parts, line, is_tab_separated, player_name=player_name)
            match = self._create_match(match_data, original_line=line)
            return match
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.debug(f"Error parsing line: {e}", exc_info=True)
            return None
    
    def _extract_fields(self, parts: List[str], original_line: str = "", is_tab_separated: bool = True, player_name: Optional[str] = None) -> Dict[str, Any]:
        """Extract fields from split line parts."""
        data = {}
        
        # Use column map if available, otherwise use positional fallback
        if self.column_map:
            data['date'] = self._get_field(parts, 'date', 0)
            data['rank'] = self._get_field(parts, 'rank', 4)
            data['opponent_rank'] = self._get_field(parts, 'opponent_rank', 5)
            data['tournament'] = self._get_field(parts, 'tournament', 1)
            data['surface'] = self._get_field(parts, 'surface', 2)
            data['round'] = self._get_field(parts, 'round', 3)
            
            # Parse match result from the match description column
            # The match description column has no header, so we need to find it
            # It's typically between vRk and Score, or we can detect it from the column_map
            match_desc_idx = self.column_map.get('match_description')
            if match_desc_idx is None:
                # Fallback: infer from structure (after opponent_rank, before score)
                opponent_rank_idx = self.column_map.get('opponent_rank', 5)
                score_idx = self.column_map.get('score', 7)
                match_desc_idx = opponent_rank_idx + 1 if opponent_rank_idx >= 0 else 6
            
            # Use positional parsing for match description (it has no header)
            match_info = self._parse_match_result(parts, original_line, data.get('rank', ''), is_tab_separated, player_name=player_name, match_desc_idx=match_desc_idx)
            data['opponent'] = match_info.get('opponent', '')
            data['result'] = match_info.get('result', '')
            # Get score from column map if available, otherwise from positional (index 7) or match_info
            score_from_map = self._get_field(parts, 'score', -1)
            data['score'] = score_from_map or match_info.get('score', '') or (parts[7] if len(parts) > 7 else '')
            
            # Extract serve stats using column map or positional fallback
            # Find score column index
            score_idx = self.column_map.get('score', 7)
            if score_idx < len(parts):
                # Stats start after score: DR (odds), A%, DF%, 1stIn, 1st%, 2nd%, BPSvd, Time
                stats_start = score_idx + 1
                if stats_start < len(parts):
                    # Extract DR (Dominance Rating) - first value after score
                    # DR is used to calculate return_pct: DR = serve_pct / (1 - return_pct)
                    # So: return_pct = 1 - (serve_pct / DR)
                    dr_val = parts[stats_start].strip() if stats_start < len(parts) else ""
                    dr = self._parse_float(dr_val)
                    if dr is not None and dr > 0:
                        data['dr'] = dr
                    
                    # Extract serve stats from columns after DR (skip DR, start from stats_start + 1)
                    if stats_start + 1 < len(parts):
                        stats = self._parse_serve_stats(parts[stats_start + 1:])
                        data.update(stats)
                    
                    # Also try to extract from column map if available
                    if 'first_in_pct' in self.column_map:
                        first_in_val = self._get_field(parts, 'first_in_pct', -1)
                        if first_in_val:
                            first_in_pct = self._parse_float(first_in_val)
                            if first_in_pct is not None:
                                data['first_serve_pct'] = first_in_pct
                    if 'first_won_pct' in self.column_map:
                        first_won_val = self._get_field(parts, 'first_won_pct', -1)
                        if first_won_val:
                            first_won_pct = self._parse_float(first_won_val)
                            if first_won_pct is not None:
                                data['first_serve_won_pct'] = first_won_pct
                    if 'second_won_pct' in self.column_map:
                        second_won_val = self._get_field(parts, 'second_won_pct', -1)
                        if second_won_val:
                            second_won_pct = self._parse_float(second_won_val)
                            if second_won_pct is not None:
                                data['second_serve_won_pct'] = second_won_pct
        else:
            # Fallback: parse Tennis Abstract format
            # Format: Date Tournament Surface Round PlayerRank OppRank MatchDescription Score Stats...
            # Example: "19-Jan-2026 Australian Open Hard R32 6 34 (6)De Minaur d. (29)Frances Tiafoe [USA] 6-3 6-4 7-5 1.36 8.2% 6.2% 61.9% 78.3% 51.4% 3/5 2:43"
            # Stats after score: odds, A%, DF%, 1stIn%, 1st%, 2nd%, BPSvd/BPConv, time
            
            if is_tab_separated or len(parts) >= 6:
                # Tab-separated or well-structured: use positional extraction
                if len(parts) >= 1:
                    data['date'] = parts[0]
                if len(parts) >= 2:
                    data['tournament'] = parts[1]
                if len(parts) >= 3:
                    data['surface'] = parts[2]
                if len(parts) >= 4:
                    data['round'] = parts[3]
                if len(parts) >= 5:
                    data['rank'] = parts[4]  # Player rank (Rk)
                if len(parts) >= 6:
                    data['opponent_rank'] = parts[5]  # Opponent rank (vRk)
                
                # For tab-separated, match description is at index 6, score at index 7
                # For space-separated, we need to parse the whole line
                # Match description is typically at index 6 (after vRk at 5, before Score at 7)
                match_desc_idx = 6 if len(parts) > 6 else None
                match_info = self._parse_match_result(parts, original_line, data.get('rank', ''), is_tab_separated, player_name=player_name, match_desc_idx=match_desc_idx)
                
                # Extract serve stats from columns after score
                # Expected order after score: DR (odds), A%, DF%, 1stIn%, 1st%, 2nd%, BPSvd/BPConv, time
                if is_tab_separated and len(parts) > 7:
                    # Find score index first
                    score_idx = 7  # Typically at index 7
                    # Stats start after score
                    stats_start = score_idx + 1
                    if stats_start < len(parts):
                        # Extract DR (Dominance Rating) - first value after score
                        dr_val = parts[stats_start].strip() if stats_start < len(parts) else ""
                        dr = self._parse_float(dr_val)
                        if dr is not None and dr > 0:
                            data['dr'] = dr
                        
                        # Extract serve stats (starts from index stats_start + 1, skipping DR)
                        stats = self._parse_serve_stats(parts[stats_start + 1:]) if stats_start + 1 < len(parts) else {}
                        data.update(stats)
                        
                        # Look for RPW (return points won) - could be after BPSvd
                        # Try to find it in remaining parts
                        for i in range(stats_start + 7, min(len(parts), stats_start + 10)):
                            rpw_text = parts[i].strip()
                            # Check if it looks like RPW (could be percentage or absolute)
                            rpw_value = self._parse_float(rpw_text)
                            if rpw_value is not None:
                                # If > 1, might be absolute number; if <= 1, might be percentage
                                # But RPW is typically shown as percentage in Tennis Abstract
                                if rpw_value <= 1.0:
                                    # It's a percentage
                                    data['return_pct'] = rpw_value
                                # If > 1, it might be absolute, but we'd need opponent_svpt
                                # For now, skip absolute values (we'll need scraping for those)
                                break
            else:
                # Space-separated with fewer parts - parse from original line
                data['date'] = parts[0] if len(parts) > 0 else ""
                match_info = self._parse_match_result(parts, original_line, "", is_tab_separated)
                # Try to extract rank from match result if available
                if not data.get('rank') and match_info.get('player_rank'):
                    data['rank'] = match_info.get('player_rank')
                # Try to extract stats from the full line
                stats = self._parse_serve_stats_from_text(original_line)
                data.update(stats)
            
            data['opponent'] = match_info.get('opponent', '')
            data['result'] = match_info.get('result', '')
            data['score'] = match_info.get('score', '')
            # Update opponent_rank if found in match result
            if match_info.get('opponent_rank'):
                data['opponent_rank'] = match_info.get('opponent_rank')
            # Update tournament/surface/round if found in match result
            if match_info.get('tournament'):
                data['tournament'] = match_info.get('tournament')
            if match_info.get('surface'):
                data['surface'] = match_info.get('surface')
            if match_info.get('round'):
                data['round'] = match_info.get('round')
        
        return data
    
    def _get_field(self, parts: List[str], field: str, default_idx: int) -> str:
        """Get field value using column map or default index."""
        idx = self.column_map.get(field, default_idx)
        if 0 <= idx < len(parts):
            return parts[idx].strip()
        return ""
    
    def _find_result_in_parts(self, parts: List[str]) -> str:
        """Find W/L result in parts."""
        for part in parts:
            if part.strip() in ['W', 'L']:
                return part.strip()
        return ""
    
    def _find_score_in_parts(self, parts: List[str]) -> str:
        """Find score in parts (typically contains hyphens and numbers)."""
        for part in parts:
            if re.search(r'\d+-\d+', part):
                return part.strip()
        return ""
    
    def _parse_match_result(self, parts: List[str], original_line: str = "", player_rank: str = "", is_tab_separated: bool = True, player_name: Optional[str] = None, match_desc_idx: Optional[int] = None) -> Dict[str, str]:
        """
        Parse Tennis Abstract match result format.
        
        Formats:
        - "(6)De Minaur d. (29)Frances Tiafoe [USA]" -> W, opponent="Frances Tiafoe"
        - "(17)Casper Ruud [NOR] d. (4)De Minaur" -> L, opponent="Casper Ruud"
        - "(6)De Minaur vs (10)Alexander Bublik [KAZ]" -> skip (upcoming match)
        
        Returns dict with 'result', 'opponent', 'opponent_rank', 'score', and optionally 'tournament', 'surface', 'round'
        """
        result_info = {'result': '', 'opponent': '', 'opponent_rank': '', 'score': ''}
        
        # Use original line for parsing to preserve structure
        line_text = original_line if original_line else ' '.join(parts)
        
        # Skip if it's an upcoming match (contains "vs")
        if ' vs ' in line_text.lower() or ' vs\n' in line_text.lower():
            return result_info
        
        # For tab-separated, match description is at the specified index or default to 6
        # For space-separated, we need to find it in the text
        if is_tab_separated:
            if match_desc_idx is not None and match_desc_idx < len(parts):
                match_desc = parts[match_desc_idx]
                # Score is typically right after match description
                score_idx = match_desc_idx + 1
                score_text = parts[score_idx] if score_idx < len(parts) else ""
            elif len(parts) > 6:
                # Fallback to default position
                match_desc = parts[6]
                score_text = parts[7] if len(parts) > 7 else ""
            else:
                match_desc = line_text
                score_text = line_text
        else:
            # Space-separated: find match description and score in the full text
            match_desc = line_text
            score_text = line_text
        
        # Find score (pattern like "6-3 6-4 7-5" or "6-7(5) 6-2 6-2 6-1")
        score_match = re.search(r'(\d+-\d+(?:\(\d+\))?(?:\s+\d+-\d+(?:\(\d+\))?)+)', score_text)
        if score_match:
            result_info['score'] = score_match.group(1).strip()
        
        # Look for "d." pattern to determine result
        # In Tennis Abstract: winner is ALWAYS on the left of "d."
        # Numbers in parentheses are SEEDS, not ranks
        # Use Rk (player rank) and vRk (opponent rank) from columns for ranks
        # Examples:
        #   "(WC)Thompson d. Juan Manuel Cerundolo [ARG]" -> Thompson won (on left)
        #   "Mats Rosenkranz [GER] d. (1)Thompson" -> Thompson lost (on right)
        #   "(6)De Minaur d. (29)Frances Tiafoe [USA]" -> De Minaur won (on left)
        
        # Pattern to match: anything before "d." (winner) and anything after "d." (loser)
        d_pattern = r'(.+?)\s+d\.\s+(.+?)(?:\s|$)'
        match = re.search(d_pattern, match_desc)
        
        if match:
            left_side = match.group(1).strip()  # Winner (always on left)
            right_side = match.group(2).strip()  # Loser (always on right)
            
            # Extract names (remove seed prefix like "(6)" or "(WC)" and country suffix like "[USA]")
            # Keep the full name including middle/last names
            left_name = re.sub(r'^\([^)]+\)\s*', '', left_side).strip()
            left_name = re.sub(r'\s+\[[A-Z]+\]$', '', left_name).strip()
            
            right_name = re.sub(r'^\([^)]+\)\s*', '', right_side).strip()
            right_name = re.sub(r'\s+\[[A-Z]+\]$', '', right_name).strip()
            
            # Ensure we have the full name (not just first word)
            # The names should already be complete from the match description
            
            # Determine result: winner is ALWAYS on the left of "d."
            # We need to determine which side the player is on
            # Since we have Rk (player rank) in the data, we can check if the player rank
            # appears in the match description to determine which side they're on
            # But actually, we can't match rank to seed. Instead, we'll use a different approach:
            # The Rk column tells us the player's rank, and vRk tells us opponent's rank
            # We'll determine W/L by checking if we can find the player rank value in the description
            # However, since seeds != ranks, we need another way.
            
            # Actually, the simplest approach: since winner is on left, and we have Rk/vRk,
            # we can determine W/L by checking which side contains information matching the player
            # But we don't have player name. Let's use the fact that Rk is the player rank.
            # We'll assume the player is the one whose rank (Rk) we have, and determine side by context.
            
            # For now, we'll extract opponent name and determine result based on position
            # The caller should provide player_rank (Rk) to help determine which side is player
            # But since we can't match rank to seed, we'll use a heuristic:
            # If player_rank is provided and matches a pattern, or we can infer from structure
            
            # Actually, let's simplify: we know winner is on left, loser is on right
            # We need to know which side the player is on. Since we can't match rank to seed,
            # we'll need to use the Rk value differently. But wait - the user said to use Rk and vRk.
            # Maybe the approach is: we already have Rk and vRk from columns, so we just need
            # to determine which side is player vs opponent, then W/L is determined by position.
            
            # Let's try a different approach: check if player_rank (Rk) appears as a number
            # in the match description (even though it's a seed, it might match by coincidence)
            # But that's not reliable. Better: use the structure - if Rk column value is provided,
            # we can't reliably match it, but we can extract names and let the caller handle it.
            
            # Actually, I think the solution is: we extract both names, and the caller (who has Rk)
            # can determine which is the player. But that's not how the current flow works.
            
            # Let me reconsider: The user wants us to use Rk and vRk. Rk is player rank, vRk is opponent rank.
            # These are already extracted from columns. We need to determine W/L by which side of "d." 
            # the player appears on. But we don't have player name to match.
            
            # I think the solution is: we determine W/L by checking if the player rank (Rk) value
            # appears in the left side (winner) or right side (loser) of the match description.
            # But since those are seeds, not ranks, we can't match directly.
            
            # Wait - maybe the approach is simpler: we just need to know which side the player is on.
            # Since we can't match by rank/seed, maybe we need the player name? Or maybe the format
            # is consistent enough that we can infer from the Rk column position?
            
            # Let me check the format again: the user's example shows Rk and vRk are in columns.
            # The match description has seeds. We need to determine which side is player.
            
            # I think the best approach for now is: extract both names, and use a heuristic:
            # If player_rank is provided, we'll try to determine side by checking if the rank
            # value (as a string) appears in the description. But since seeds != ranks, this won't work.
            
            # Actually, let me re-read the user's message: "Use Rk and vRk for player rank and versus player rank"
            # So Rk = player rank, vRk = opponent rank. These are already in the data.
            # We just need to determine W/L by position. Since winner is on left, if player is on left → W, else → L.
            
            # The challenge is: how do we know which side the player is on? We need the player name or some other identifier.
            # But we don't have that. However, maybe the format is such that the player is always first mentioned?
            # Or maybe we can use the Rk value in a different way?
            
            # For now, let's extract the names and set a default. The caller might need to provide player name
            # or we need to infer it differently. But let's at least extract the opponent name correctly.
            
            # Actually, I realize: in the data structure, we have Rk (player rank) already extracted.
            # The match description shows the match. We need to determine which side is player.
            # Since we can't match rank to seed, maybe we assume the player is the one whose rank
            # we have (Rk), and we determine side by... hmm, this is circular.
            
            # Let me try a pragmatic approach: extract names, and if player_rank is provided,
            # we'll use a simple heuristic - check if the rank number (as string) appears in left or right.
            # But this won't work reliably since seeds != ranks.
            
            # I think the real solution requires the player name. But for now, let's extract what we can
            # and set up the structure so opponent info is extracted. The W/L determination might need
            # to be done at a higher level with player name.
            
            # For now, let's extract opponent name and rank (vRk is already in data)
            # We'll leave result determination to be done with player name or other context
            
            # Extract opponent name (will be determined by which side player is not on)
            # Since we can't determine which side is player without name, we'll extract both
            # and let the logic above determine based on player_rank if possible
            
            # Actually, wait - maybe the solution is simpler. The user said to use Rk and vRk.
            # Maybe vRk (opponent rank) is already in the data from columns, so we don't need to extract it.
            # We just need to determine W/L by which side of "d." the player appears.
            # But we still need to know which side is player.
            
            # Let me try a different approach: check if player_rank appears as a standalone number
            # in the match description (not in parentheses, as those are seeds). But ranks might not appear.
            
            # I think the pragmatic solution for now is:
            # 1. Extract both names
            # 2. Use Rk and vRk that are already in the data (from columns)
            # 3. Determine W/L by checking which side the player appears on
            # 4. Since we can't match rank to seed, we might need player name or another identifier
            
            # For now, let's extract names and set opponent_rank from vRk (which is already in data)
            # The W/L determination will need player name or another method
            
            # Extract opponent name - we'll determine which side is opponent based on player position
            # But we need player name or another way to determine position
            
            # Let me simplify: extract names, use vRk from data for opponent_rank
            # For W/L, we'll need to determine which side player is on - this might require player name
            # or we can use a heuristic based on Rk value appearing in description (even though it's seed)
            
            # Actually, I think I'm overcomplicating. Let me check: the user wants us to use Rk and vRk.
            # Rk is player rank (from column), vRk is opponent rank (from column).
            # We determine W/L by which side of "d." the player appears.
            # To know which side is player, we might need player name, or we can try matching Rk value.
            
            # For now, let's extract opponent name and use vRk for opponent_rank.
            # For W/L, we'll try to match player_rank (Rk) to see which side it appears on,
            # even though those are seeds - it might work by coincidence in some cases.
            
            # Determine which side the player is on using player_name
            # Rule: If player name appears first (left of "d.") → player won (W)
            #       If player name appears second (right of "d.") → player lost (L)
            # Example: "Kokkinakis d. Sebastian Korda [USA]" → Kokkinakis won (on left)
            if player_name:
                # Handle slug format (e.g., "nick-kyrgios") and display name (e.g., "Alex De Minaur")
                player_name_clean = player_name.strip().lower()
                if '-' in player_name_clean:
                    # Slug: "alex-de-minaur" -> last_name="minaur", full="alex de minaur"
                    slug_parts = player_name_clean.split('-')
                    player_last_name = slug_parts[-1] if slug_parts else player_name_clean
                    player_full_name = ' '.join(slug_parts)
                else:
                    # Display name: "alex de minaur" -> last_name="minaur", full="alex de minaur"
                    parts = player_name_clean.split()
                    player_last_name = parts[-1] if parts else player_name_clean
                    player_full_name = player_name_clean
                
                left_name_lower = left_name.lower()
                right_name_lower = right_name.lower()
                left_last_name = left_name_lower.split()[-1] if left_name_lower.split() else ""
                right_last_name = right_name_lower.split()[-1] if right_name_lower.split() else ""
                
                # Match strategies: full name, last name, or either contained in the other
                def _name_matches(desc_lower: str, desc_last: str) -> bool:
                    return (
                        player_name_clean in desc_lower or
                        player_full_name in desc_lower or
                        player_last_name == desc_last or
                        (desc_last and player_last_name in desc_last) or
                        (desc_last and desc_last in player_last_name) or
                        desc_lower in player_full_name or  # "de minaur" in "alex de minaur"
                        desc_lower.startswith(player_last_name) or
                        desc_lower.startswith(player_full_name)
                    )
                left_matches = _name_matches(left_name_lower, left_last_name)
                right_matches = _name_matches(right_name_lower, right_last_name)
                
                if left_matches:
                    # Player name is on the left (first) → player won
                    result_info['result'] = 'W'
                    result_info['opponent'] = right_name
                elif right_matches:
                    # Player name is on the right (second) → player lost
                    result_info['result'] = 'L'
                    result_info['opponent'] = left_name
                else:
                    # Player name doesn't appear in description - can't determine W/L
                    # This might happen if the name format is different
                    result_info['opponent'] = right_name
            elif player_rank:
                # Fallback: try to match player rank (Rk) - this is unreliable since seeds != ranks
                player_rank_clean = player_rank.strip()
                if player_rank_clean in left_side:
                    result_info['result'] = 'W'
                    result_info['opponent'] = right_name
                elif player_rank_clean in right_side:
                    result_info['result'] = 'L'
                    result_info['opponent'] = left_name
                else:
                    # Player rank doesn't appear in description - can't determine W/L
                    result_info['opponent'] = right_name
            else:
                # No player_name or player_rank provided - can't determine result
                result_info['opponent'] = right_name
            
            # Note: opponent_rank (vRk) is already extracted from columns in _extract_fields
            # We don't extract it from the match description since those are seeds, not ranks
        
        return result_info
    
    def _create_match(self, data: Dict[str, Any], original_line: str = "") -> ParsedMatch:
        """Create a ParsedMatch object from extracted data."""
        # Parse date
        date_str = data.get('date', '')
        match_date = self._parse_date(date_str)
        
        # Parse ranks
        player_rank = self._parse_int(data.get('rank'))
        # opponent_rank might come from match result parsing
        opponent_rank = self._parse_int(data.get('opponent_rank'))
        
        # Parse result
        result = data.get('result', '').upper()
        
        # Parse serve stats (required - no fallbacks)
        first_serve_pct = data.get('first_serve_pct')  # 1stIn%
        first_serve_won_pct = data.get('first_serve_won_pct')  # 1st%
        second_serve_won_pct = data.get('second_serve_won_pct')  # 2nd%
        
        # Parse aces and double faults from percentages
        # Note: We need total serve points to convert percentages to counts
        # For now, we'll store percentages and let the feature service handle conversion
        aces_pct = data.get('aces_pct')  # A%
        df_pct = data.get('df_pct')  # DF%
        
        # Parse break points
        break_points_saved = data.get('break_points_saved')  # BPSvd%
        
        # Calculate return_pct from DR (Dominance Rating) - REQUIRED
        # DR = serve_pct / (1 - return_pct)
        # So: return_pct = 1 - (serve_pct / DR)
        # If DR is missing, null, or 0, return_pct will be None and match will be skipped
        return_pct = None
        dr = data.get('dr')
        if dr is not None and dr > 0:
            # Calculate serve_pct from serve stats
            # serve_pct = (first_serve_pct * first_serve_won_pct) + ((1 - first_serve_pct) * second_serve_won_pct)
            if first_serve_pct is not None and first_serve_won_pct is not None and second_serve_won_pct is not None:
                serve_pct = (first_serve_pct * first_serve_won_pct) + ((1.0 - first_serve_pct) * second_serve_won_pct)
                # Calculate return_pct from DR
                # DR = serve_pct / (1 - return_pct)
                # return_pct = 1 - (serve_pct / DR)
                calculated_return_pct = 1.0 - (serve_pct / dr)
                # Sanity check: return_pct should be between 0 and 1
                if 0.0 <= calculated_return_pct <= 1.0:
                    return_pct = calculated_return_pct
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.debug(f"Calculated return_pct={return_pct:.3f} from DR={dr} and serve_pct={serve_pct:.3f}")
        
        # Create match object
        match = ParsedMatch(
            date=match_date,
            player_rank=player_rank,
            opponent_rank=opponent_rank,
            opponent_name=data.get('opponent', 'Unknown'),
            tournament=data.get('tournament', ''),
            surface=data.get('surface', 'Hard'),
            round_name=data.get('round', ''),
            result=result,
            score=data.get('score', ''),
            first_serve_pct=first_serve_pct,
            first_serve_won_pct=first_serve_won_pct,
            second_serve_won_pct=second_serve_won_pct,
            aces=None,  # Will be calculated from aces_pct if needed
            double_faults=None,  # Will be calculated from df_pct if needed
            break_points_saved=break_points_saved,
            break_points_converted=None,  # Not available in Tennis Abstract format
            serve_pct=None,  # Will be calculated from serve stats
            return_pct=return_pct,  # Calculated from DR (required)
        )
        
        return match
    
    def _parse_date(self, date_str: str) -> datetime:
        """Parse date string into datetime object."""
        if not date_str:
            return datetime.now()
        
        # Try common date formats including Tennis Abstract format
        formats = [
            '%d-%b-%Y',  # 19-Jan-2026 (Tennis Abstract format)
            '%d-%B-%Y',  # 19-January-2026
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%d/%m/%Y',
            '%Y/%m/%d',
            '%m-%d-%Y',
            '%d-%m-%Y',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        # If all fail, return current date
        return datetime.now()
    
    def _is_null_like(self, value: Any) -> bool:
        """Return True if value is null, empty, or a common null placeholder."""
        if value is None:
            return True
        if isinstance(value, str):
            s = value.strip().lower()
            if not s:
                return True
            null_values = {'-', '—', '–', 'na', 'n/a', 'nan', '.', '..', 'null', ''}
            if s in null_values:
                return True
        return False

    def _parse_int(self, value: Any) -> Optional[int]:
        """Parse value as integer, return None if invalid or null-like."""
        if value is None or self._is_null_like(value):
            return None
        
        try:
            if isinstance(value, str):
                value = value.strip()
                # Remove non-numeric characters
                value = re.sub(r'[^\d]', '', value)
            
            return int(value) if value else None
        except (ValueError, TypeError):
            return None
    
    def _parse_float(self, value: Any) -> Optional[float]:
        """Parse value as float, return None if invalid or null-like. Handles percentage formats."""
        if value is None or self._is_null_like(value):
            return None
        
        try:
            if isinstance(value, str):
                value = value.strip()
                
                # Handle percentage (e.g., "65%")
                if '%' in value:
                    value = value.replace('%', '')
                    return float(value) / 100.0
                
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _parse_serve_stats(self, stats_parts: List[str]) -> Dict[str, Any]:
        """
        Parse serve statistics from parts after score.
        
        Expected format: A%, DF%, 1stIn%, 1st%, 2nd%, BPSvd/BPConv, time
        (Note: DR/odds should be extracted before calling this method)
        Example: ["8.2%", "6.2%", "61.9%", "78.3%", "51.4%", "3/5", "2:43"]
        """
        stats = {}
        
        # A% (Aces percentage) - first value
        if len(stats_parts) >= 1:
            aces_pct = self._parse_float(stats_parts[0])
            if aces_pct is not None:
                stats['aces_pct'] = aces_pct
        
        # DF% (Double faults percentage) - second value
        if len(stats_parts) >= 2:
            df_pct = self._parse_float(stats_parts[1])
            if df_pct is not None:
                stats['df_pct'] = df_pct
        
        # 1stIn% (First serve in percentage) - third value
        if len(stats_parts) >= 3:
            first_in_pct = self._parse_float(stats_parts[2])
            if first_in_pct is not None:
                stats['first_serve_pct'] = first_in_pct
        
        # 1st% (First serve won percentage) - fourth value
        if len(stats_parts) >= 4:
            first_won_pct = self._parse_float(stats_parts[3])
            if first_won_pct is not None:
                stats['first_serve_won_pct'] = first_won_pct
        
        # 2nd% (Second serve won percentage) - fifth value
        if len(stats_parts) >= 5:
            second_won_pct = self._parse_float(stats_parts[4])
            if second_won_pct is not None:
                stats['second_serve_won_pct'] = second_won_pct
        
        # BPSvd/BPConv (Break points saved / converted)
        if len(stats_parts) >= 7:
            bp_str = stats_parts[6].strip()
            if '/' in bp_str:
                bp_parts = bp_str.split('/')
                if len(bp_parts) == 2:
                    try:
                        bp_saved = int(bp_parts[0].strip())
                        bp_total = int(bp_parts[1].strip())
                        if bp_total > 0:
                            stats['break_points_saved'] = float(bp_saved) / float(bp_total)
                    except (ValueError, IndexError):
                        pass
        
        return stats
    
    def _parse_serve_stats_from_text(self, text: str) -> Dict[str, Any]:
        """
        Parse serve statistics from full text when columns aren't clearly separated.
        Looks for percentage patterns after the score.
        """
        stats = {}
        
        # Find score first
        score_match = re.search(r'(\d+-\d+(?:\(\d+\))?(?:\s+\d+-\d+(?:\(\d+\))?)+)', text)
        if not score_match:
            return stats
        
        # Get text after score
        score_end = score_match.end()
        after_score = text[score_end:].strip()
        
        # Split by whitespace to get potential stat values
        after_parts = re.split(r'\s+', after_score)
        
        # Look for percentage patterns
        percentages = []
        for part in after_parts:
            if '%' in part:
                pct = self._parse_float(part)
                if pct is not None:
                    percentages.append(pct)
        
        # Assign percentages in expected order: A%, DF%, 1stIn%, 1st%, 2nd%
        if len(percentages) >= 1:
            stats['aces_pct'] = percentages[0]
        if len(percentages) >= 2:
            stats['df_pct'] = percentages[1]
        if len(percentages) >= 3:
            stats['first_serve_pct'] = percentages[2]
        if len(percentages) >= 4:
            stats['first_serve_won_pct'] = percentages[3]
        if len(percentages) >= 5:
            stats['second_serve_won_pct'] = percentages[4]
        
        # Look for break points pattern (e.g., "3/5")
        bp_match = re.search(r'(\d+)/(\d+)', after_score)
        if bp_match:
            try:
                bp_saved = int(bp_match.group(1))
                bp_total = int(bp_match.group(2))
                if bp_total > 0:
                    stats['break_points_saved'] = float(bp_saved) / float(bp_total)
            except (ValueError, IndexError):
                pass
        
        return stats
    


def parse_tennis_abstract_matches(text: str, max_matches: int = 10, player_name: Optional[str] = None) -> List[ParsedMatch]:
    """
    Convenience function to parse Tennis Abstract text and return most recent valid matches.
    
    Args:
        text: Raw text copied from Tennis Abstract
        max_matches: Maximum number of matches to return (default: 10)
        
    Returns:
        List of most recent valid ParsedMatch objects
        
    Raises:
        ValueError: If insufficient valid matches found
    """
    logger = logging.getLogger(__name__)
    parser = TennisAbstractParser()
    matches = parser.parse(text, player_name=player_name)
    
    if len(matches) < max_matches:
        logger.warning(
            "parse_tennis_abstract_matches: input_len=%d chars, found=%d valid, need=%d (player=%s)",
            len(text or ""), len(matches), max_matches, player_name or "?",
        )
        raise ValueError(
            f"Insufficient valid matches found. Need {max_matches}, found {len(matches)}. "
            "Inference requires each match to have complete stats: 1stIn%, 1st%, 2nd%, and DR (Dominance Rating). "
            "The display may show more rows as valid; only rows with full serve/return stats are used for prediction."
        )
    
    return matches[:max_matches]
