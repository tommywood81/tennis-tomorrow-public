"""
Tennis Abstract scraper service for backend.

This service scrapes Tennis Abstract match statistics including return percentages
by fetching opponent serve stats for each match.
"""

import time
import random
import re
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from urllib.parse import quote
import requests
from bs4 import BeautifulSoup
from dataclasses import dataclass


@dataclass
class ScrapedMatch:
    """Scraped match data with return percentage."""
    date: str
    tournament: str
    surface: str
    round: str
    opponent: str
    result: str  # "W" or "L"
    score: str
    player_rank: Optional[int]
    opponent_rank: Optional[int]
    # Serve stats
    first_serve_pct: Optional[float]  # 1stIn%
    first_serve_won_pct: Optional[float]  # 1st%
    second_serve_won_pct: Optional[float]  # 2nd%
    # Return stats (calculated from opponent)
    return_pct: Optional[float]  # 100 - opponent_serve_pct
    opponent_serve_pct: Optional[float]  # From opponent's page
    # Raw text for pasting
    raw_text: str


class TennisAbstractScraperService:
    """
    Service for scraping Tennis Abstract match statistics.
    
    Handles rate limiting and mimics normal browser traffic.
    """
    
    BASE_URL = "https://www.tennisabstract.com"
    
    # User agents to rotate
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    ]
    
    def __init__(self, min_delay: float = 2.0, max_delay: float = 5.0):
        """
        Initialize scraper with rate limiting.
        
        Args:
            min_delay: Minimum delay between requests (seconds)
            max_delay: Maximum delay between requests (seconds)
        """
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.session = requests.Session()
        self._last_request_time = 0
        self._request_count = 0
        
    def _get_headers(self) -> Dict[str, str]:
        """Get randomized headers to mimic normal browser traffic."""
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0",
        }
    
    def _rate_limit(self):
        """Enforce rate limiting between requests."""
        current_time = time.time()
        time_since_last = current_time - self._last_request_time
        
        delay = random.uniform(self.min_delay, self.max_delay)
        
        if time_since_last < delay:
            sleep_time = delay - time_since_last
            time.sleep(sleep_time)
        
        self._last_request_time = time.time()
        self._request_count += 1
        
        # Every 10 requests, add extra delay
        if self._request_count % 10 == 0:
            extra_delay = random.uniform(3.0, 8.0)
            time.sleep(extra_delay)
    
    def _fetch_page(self, url: str, retries: int = 3) -> Optional[BeautifulSoup]:
        """Fetch and parse a page with retries and error handling."""
        self._rate_limit()
        
        for attempt in range(retries):
            try:
                response = self.session.get(url, headers=self._get_headers(), timeout=10)
                response.raise_for_status()
                
                if "blocked" in response.text.lower() or response.status_code == 403:
                    time.sleep(random.uniform(10.0, 20.0))
                    continue
                
                return BeautifulSoup(response.content, 'html.parser')
                
            except requests.exceptions.RequestException as e:
                if attempt < retries - 1:
                    wait_time = (attempt + 1) * 5
                    time.sleep(wait_time)
                else:
                    raise Exception(f"Failed to fetch {url}: {e}")
        
        return None
    
    def _normalize_player_name(self, name: str) -> str:
        """Normalize player name for Tennis Abstract URL."""
        name = name.strip()
        name = re.sub(r'\s+', '', name)  # Remove spaces
        return name
    
    def _get_player_url(self, player_name: str) -> str:
        """Get Tennis Abstract URL for a player."""
        normalized = self._normalize_player_name(player_name)
        encoded_name = quote(normalized)
        return f"{self.BASE_URL}/cgi-bin/player.cgi?p={encoded_name}"
    
    def _parse_table_header(self, table) -> Dict[str, int]:
        """Parse table header to get column name -> index mapping."""
        header_map = {}
        header_row = table.find('tr')
        if not header_row:
            return header_map
        
        cells = header_row.find_all(['th', 'td'])
        vrk_idx = None
        score_idx = None
        
        for idx, cell in enumerate(cells):
            header_text = cell.get_text(strip=True).lower()
            
            if 'date' in header_text or (header_text == '' and 'date' not in header_map):
                if 'date' not in header_map:
                    header_map['date'] = idx
            elif 'tournament' in header_text:
                header_map['tournament'] = idx
            elif 'surface' in header_text:
                header_map['surface'] = idx
            elif header_text in ['rd', 'round', 'rnd']:
                header_map['round'] = idx
            elif header_text == 'rk':
                header_map['rk'] = idx
            elif header_text in ['vrk', 'v rk', 'opp rk']:
                header_map['vrk'] = idx
                vrk_idx = idx
            elif 'score' in header_text:
                header_map['score'] = idx
                score_idx = idx
            elif header_text in ['1stin', '1st in', 'first in', '1stin%']:
                header_map['1stin'] = idx
            elif header_text in ['1st%', '1st', 'first%', '1st won%']:
                header_map['1st%'] = idx
            elif header_text in ['2nd%', '2nd', 'second%', '2nd won%']:
                header_map['2nd%'] = idx
            elif header_text in ['a%', 'aces%', 'ace%', 'aces']:
                header_map['a%'] = idx
            elif header_text in ['df%', 'double fault%', 'df', 'double faults']:
                header_map['df%'] = idx
            elif header_text in ['dr', 'odds', 'decimal odds']:
                header_map['dr'] = idx
            elif header_text in ['bpsvd', 'bp saved', 'bps', 'bp saved%']:
                header_map['bpsvd'] = idx
            elif header_text in ['rpw', 'return points won', 'return won', 'rpw%']:
                header_map['rpw'] = idx
            elif header_text == 'time':
                header_map['time'] = idx
        
        # Handle empty column between vRk and Score (match description)
        if vrk_idx is not None and score_idx is not None:
            match_col_idx = vrk_idx + 1
            if match_col_idx < score_idx:
                header_map['match'] = match_col_idx
        
        return header_map
    
    def _get_cell_value(self, cells: List, header_map: Dict[str, int], key: str, default=None):
        """Get cell value by column name."""
        if key not in header_map:
            return default
        idx = header_map[key]
        if idx < len(cells):
            return cells[idx].get_text(strip=True)
        return default
    
    def _parse_date(self, date_text: str) -> Optional[datetime]:
        """Parse date from various formats."""
        date_text = date_text.strip()
        formats = [
            "%Y-%m-%d",
            "%m/%d/%Y",
            "%d-%m-%Y",
            "%d-%b-%Y",
            "%b %d, %Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_text, fmt)
            except ValueError:
                continue
        
        return None
    
    def _parse_int(self, text: str) -> Optional[int]:
        """Parse integer, handling non-numeric text."""
        text = re.sub(r'[^\d]', '', text)
        return int(text) if text else None
    
    def _parse_percentage(self, text: str) -> Optional[float]:
        """Parse percentage value (e.g., "65%" or "0.65")."""
        text = text.strip().replace('%', '')
        try:
            value = float(text)
            if value > 1:
                return value / 100.0
            return value
        except ValueError:
            return None
    
    def _parse_match_result(self, text: str, player_name: str = "") -> Tuple[Optional[str], Optional[str], str]:
        """Parse match result text to extract W/L, opponent name, and score."""
        text = text.strip()
        score = ""
        
        if " vs " in text.lower() or "v " in text.lower():
            return None, None, ""
        
        score_match = re.search(r'(\d+-\d+(?:\s+\(\d+\))?(?:\s+\d+-\d+(?:\s+\(\d+\))?)*)', text)
        if score_match:
            score = score_match.group(1)
            text = text[:score_match.start()].strip()
        
        d_match = re.search(r'(.+?)\s+d\.\s+(.+?)(?:\s|$)', text, re.IGNORECASE)
        if d_match:
            left = d_match.group(1).strip()
            right = d_match.group(2).strip()
            
            left_clean = re.sub(r'^\([^)]+\)\s*', '', left).strip()
            left_clean = re.sub(r'\s+\[[A-Z]+\]$', '', left_clean).strip()
            right_clean = re.sub(r'^\([^)]+\)\s*', '', right).strip()
            right_clean = re.sub(r'\s+\[[A-Z]+\]$', '', right_clean).strip()
            
            player_normalized = self._normalize_player_name(player_name).lower()
            left_normalized = self._normalize_player_name(left_clean).lower()
            right_normalized = self._normalize_player_name(right_clean).lower()
            
            if player_normalized in left_normalized:
                result = "W"
                opponent = right_clean
            elif player_normalized in right_normalized:
                result = "L"
                opponent = left_clean
            else:
                result = None
                opponent = right_clean
            
            return result, opponent, score
        
        return None, None, score
    
    def _get_opponent_serve_pct(self, opponent_name: str, match_date: str, player_name: str) -> Optional[float]:
        """Get opponent's serve percentage for a specific match."""
        opponent_url = self._get_player_url(opponent_name)
        soup = self._fetch_page(opponent_url)
        
        if not soup:
            return None
        
        table = soup.find('table')
        if not table:
            return None
        
        header_map = self._parse_table_header(table)
        rows = table.find_all('tr')[1:]
        
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 1:
                continue
            
            row_date_text = self._get_cell_value(cells, header_map, 'date', '')
            if not row_date_text:
                continue
            
            row_date = self._parse_date(row_date_text)
            
            if row_date and row_date.strftime("%Y-%m-%d") == match_date:
                match_text = self._get_cell_value(cells, header_map, 'match', '')
                if not match_text:
                    if 'vrk' in header_map and 'score' in header_map:
                        vrk_idx = header_map['vrk']
                        score_idx = header_map['score']
                        for i in range(vrk_idx + 1, score_idx):
                            if i < len(cells):
                                text = cells[i].get_text(strip=True)
                                if text and ('d.' in text.lower() or 'vs' in text.lower() or len(text) > 5):
                                    match_text = text
                                    break
                
                player_normalized = self._normalize_player_name(player_name).lower()
                
                if match_text and player_normalized in match_text.lower():
                    first_serve_in_pct = None
                    first_serve_won_pct = None
                    second_serve_won_pct = None
                    
                    first_in_text = self._get_cell_value(cells, header_map, '1stin', '')
                    if first_in_text:
                        first_serve_in_pct = self._parse_percentage(first_in_text)
                    
                    first_won_text = self._get_cell_value(cells, header_map, '1st%', '')
                    if first_won_text:
                        first_serve_won_pct = self._parse_percentage(first_won_text)
                    
                    second_won_text = self._get_cell_value(cells, header_map, '2nd%', '')
                    if second_won_text:
                        second_serve_won_pct = self._parse_percentage(second_won_text)
                    
                    if first_serve_in_pct is not None and first_serve_won_pct is not None and second_serve_won_pct is not None:
                        serve_pct = (first_serve_in_pct * first_serve_won_pct) + ((1 - first_serve_in_pct) * second_serve_won_pct)
                        return serve_pct
        
        return None
    
    def scrape_player_matches(self, player_name: str, max_matches: int = 15) -> Tuple[List[ScrapedMatch], str]:
        """
        Scrape player's matches with return percentages.
        
        Args:
            player_name: Player name (e.g., "Novak Djokovic")
            max_matches: Maximum number of matches to scrape (default: 15)
            
        Returns:
            Tuple of (list of ScrapedMatch objects, raw text for pasting)
        """
        player_url = self._get_player_url(player_name)
        soup = self._fetch_page(player_url)
        
        if not soup:
            raise Exception(f"Failed to fetch player page for {player_name}")
        
        table = soup.find('table')
        if not table:
            raise Exception(f"No match table found on player page for {player_name}")
        
        header_map = self._parse_table_header(table)
        matches_data = []
        rows = table.find_all('tr')[1:]
        
        raw_lines = []
        
        for i, row in enumerate(rows[:max_matches]):
            cells = row.find_all(['td', 'th'])
            if len(cells) < 6:
                continue
            
            try:
                date_text = self._get_cell_value(cells, header_map, 'date', '')
                if not date_text:
                    continue
                
                date_obj = self._parse_date(date_text)
                if not date_obj:
                    continue
                
                tournament = self._get_cell_value(cells, header_map, 'tournament', '')
                surface = self._get_cell_value(cells, header_map, 'surface', '')
                round_name = self._get_cell_value(cells, header_map, 'round', '')
                
                rk_text = self._get_cell_value(cells, header_map, 'rk', '')
                vrk_text = self._get_cell_value(cells, header_map, 'vrk', '')
                player_rank = self._parse_int(rk_text)
                opponent_rank = self._parse_int(vrk_text)
                
                match_text = self._get_cell_value(cells, header_map, 'match', '')
                if not match_text:
                    if 'vrk' in header_map and 'score' in header_map:
                        vrk_idx = header_map['vrk']
                        score_idx = header_map['score']
                        for j in range(vrk_idx + 1, score_idx):
                            if j < len(cells):
                                text = cells[j].get_text(strip=True)
                                if text and ('d.' in text.lower() or 'vs' in text.lower() or len(text) > 5):
                                    match_text = text
                                    break
                
                if not match_text:
                    continue
                
                result, opponent, score = self._parse_match_result(match_text, player_name)
                
                if not result or not opponent:
                    continue
                
                if not score:
                    score = self._get_cell_value(cells, header_map, 'score', '')
                
                first_serve_pct = None
                first_serve_won_pct = None
                second_serve_won_pct = None
                
                first_in_text = self._get_cell_value(cells, header_map, '1stin', '')
                if first_in_text:
                    first_serve_pct = self._parse_percentage(first_in_text)
                
                first_won_text = self._get_cell_value(cells, header_map, '1st%', '')
                if first_won_text:
                    first_serve_won_pct = self._parse_percentage(first_won_text)
                
                second_won_text = self._get_cell_value(cells, header_map, '2nd%', '')
                if second_won_text:
                    second_serve_won_pct = self._parse_percentage(second_won_text)
                
                # Skip if missing required serve stats
                if first_serve_pct is None or first_serve_won_pct is None or second_serve_won_pct is None:
                    continue
                
                # Get opponent's serve percentage
                opponent_serve_pct = self._get_opponent_serve_pct(opponent, date_obj.strftime("%Y-%m-%d"), player_name)
                return_pct = None
                if opponent_serve_pct is not None:
                    return_pct = 1.0 - opponent_serve_pct
                
                # Build raw text line (tab-separated, matching Tennis Abstract format)
                # Note: return_pct is not in Tennis Abstract format, so we can't include it in raw_text
                # It will be calculated from opponent stats when parsing
                raw_line_parts = [
                    date_obj.strftime("%d-%b-%Y"),
                    tournament,
                    surface,
                    round_name,
                    str(player_rank) if player_rank else "",
                    str(opponent_rank) if opponent_rank else "",
                    match_text,  # Match description
                    score,
                    self._get_cell_value(cells, header_map, 'dr', ''),  # Odds
                    self._get_cell_value(cells, header_map, 'a%', ''),  # Aces%
                    self._get_cell_value(cells, header_map, 'df%', ''),  # DF%
                    f"{first_serve_pct*100:.1f}%" if first_serve_pct else "",  # 1stIn%
                    f"{first_serve_won_pct*100:.1f}%" if first_serve_won_pct else "",  # 1st%
                    f"{second_serve_won_pct*100:.1f}%" if second_serve_won_pct else "",  # 2nd%
                    self._get_cell_value(cells, header_map, 'bpsvd', ''),  # BPSvd
                    self._get_cell_value(cells, header_map, 'time', ''),  # Time
                ]
                raw_line = "\t".join(raw_line_parts)
                raw_lines.append(raw_line)
                
                # Store return_pct in a comment at the end (for parser to extract)
                # Format: [RETURN_PCT:0.XXX] - parser can extract this
                if return_pct is not None:
                    raw_line_with_return = raw_line + f"\t[RETURN_PCT:{return_pct:.4f}]"
                    # Update the last line in raw_lines
                    raw_lines[-1] = raw_line_with_return
                
                match_data = ScrapedMatch(
                    date=date_obj.strftime("%Y-%m-%d"),
                    tournament=tournament,
                    surface=surface,
                    round=round_name,
                    opponent=opponent,
                    result=result,
                    score=score,
                    player_rank=player_rank,
                    opponent_rank=opponent_rank,
                    first_serve_pct=first_serve_pct,
                    first_serve_won_pct=first_serve_won_pct,
                    second_serve_won_pct=second_serve_won_pct,
                    return_pct=return_pct,
                    opponent_serve_pct=opponent_serve_pct,
                    raw_text=raw_line,
                )
                
                matches_data.append(match_data)
                
            except Exception as e:
                continue
        
        raw_text = "\n".join(raw_lines)
        return matches_data, raw_text


def get_tennis_abstract_scraper_service() -> TennisAbstractScraperService:
    """Get singleton instance of scraper service."""
    return TennisAbstractScraperService(min_delay=2.0, max_delay=5.0)
