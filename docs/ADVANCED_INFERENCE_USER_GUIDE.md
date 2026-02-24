# Advanced Inference - User Guide

## What is Advanced Inference?

Advanced Inference allows you to override the model's last-10 match features with custom recent form data from Tennis Abstract. This lets you see how the model's prediction changes when using the most up-to-date match history instead of the frozen Nov-14 snapshot.

## When to Use Advanced Inference

Use Advanced Inference when:
- You want to test how recent form affects predictions
- Players have had significant recent results not in the Nov-14 snapshot
- You want to experiment with "what-if" scenarios using custom match data
- You need the most current assessment of player form

Use Standard Inference when:
- You want consistent, reproducible predictions
- Recent form is already captured in the Nov-14 snapshot
- You're comparing predictions over time

## How to Use

### Step 1: Navigate to Advanced Inference
Click "Advanced Inference" in the navigation menu.

### Step 2: Select Players
Use the autocomplete fields to select:
- Player One
- Player Two
- Surface (Hard, Clay, or Grass)

### Step 3: Get Tennis Abstract Data

For each player:

1. Go to [Tennis Abstract](http://www.tennisabstract.com/)
2. Search for the player
3. Navigate to their match history page
4. Copy the recent matches table (last 10+ completed matches)
5. Paste into the corresponding text area in the Advanced Inference page

**Important:** 
- You need at least 10 completed matches per player
- Only matches with results (W/L) and scores are counted
- Walkovers, retirements, and withdrawals are filtered out

### Step 4: Run Prediction

Click "Run Advanced Prediction" button.

The system will:
1. Parse your pasted match history
2. Validate you have enough valid matches
3. Run standard prediction (frozen features)
4. Run advanced prediction (custom last-10 features)
5. Calculate the probability delta

### Step 5: Interpret Results

You'll see three result boxes:

#### Standard Prediction (Left)
- Uses frozen Nov-14 features
- Same as the regular Inference page
- Baseline for comparison

#### Advanced Prediction (Right)
- Uses your custom last-10 matches
- All other features remain frozen
- Shows impact of recent form

#### Probability Delta (Bottom)
- Shows difference: Advanced - Standard
- **Positive delta:** Custom features increase Player One's win probability
- **Negative delta:** Custom features decrease Player One's win probability
- **Zero delta:** No change

## Example Tennis Abstract Data Format

Here's what Tennis Abstract match data typically looks like:

```
2025-01-15	10	Djokovic N.	25	Australian Open	Hard	SF	W	6-3 6-4
2025-01-10	10	Federer R.	15	Australian Open	Hard	QF	L	4-6 3-6
2025-01-05	10	Nadal R.	8	Brisbane	Hard	F	W	7-6 6-4
...
```

The parser will extract:
- Date
- Player rank
- Opponent name
- Opponent rank
- Tournament
- Surface
- Round
- Result (W/L)
- Score

## Tips for Best Results

1. **Use recent data:** The more recent the matches, the more relevant the prediction

2. **Include variety:** Mix of different opponents and surfaces (if available)

3. **Quality over quantity:** 10-15 recent matches are usually sufficient

4. **Check for errors:** If prediction fails, check:
   - Do you have 10+ valid matches?
   - Are all matches completed (no "W/O", "RET", "DEF")?
   - Is the data properly formatted?

## What Gets Overridden?

**Overridden (Last-10 Sequence Features):**
- Recent serve performance
- Recent return performance
- Recent opponent quality
- Recent win/loss pattern
- Match recency weights

**Frozen (Static Features):**
- Career statistics
- Head-to-head records
- Player rankings (Nov-14)
- Age and experience metrics
- Long-term trends

## Limitations

1. **Parser limitations:**
   - Basic format support (may need clean copy/paste)
   - Limited to match results, not detailed stats
   - Requires manual data entry

2. **Feature scope:**
   - Only last-10 matches overridden
   - Static features remain frozen
   - Model calibration based on Nov-14 cutoff

3. **Data quality:**
   - Depends on Tennis Abstract data availability
   - Requires user to provide accurate data
   - No validation against actual Tennis Abstract database

## FAQ

**Q: Why do I need 10 matches?**
A: The model is trained on 10-match sequences. Fewer matches would require padding and reduce prediction quality.

**Q: Can I use data from any tennis website?**
A: Currently optimized for Tennis Abstract format. Other sources may work if format is similar (tab-separated with date, opponent, result, score).

**Q: Will this affect standard predictions?**
A: No. Standard inference is completely separate and unchanged.

**Q: How accurate are advanced predictions?**
A: Accuracy depends on data quality and how representative the custom matches are. The model uses the same architecture and weights as standard inference.

**Q: Can I save predictions for comparison?**
A: Not currently. This is a potential future enhancement.

**Q: What if the delta is very small?**
A: Small delta means recent form doesn't significantly change the prediction. This could indicate:
- Recent form is consistent with historical performance
- Static features (career stats, H2H) dominate the prediction
- Recent matches don't show significant deviation

**Q: What if the delta is very large?**
A: Large delta indicates recent form significantly differs from frozen snapshot. This could mean:
- Player is in exceptional or poor form
- Significant recent upsets or wins
- Change in playing conditions or style

## Need Help?

If you encounter issues:
1. Check the error message for specific guidance
2. Verify your Tennis Abstract data is complete
3. Ensure you have 10+ valid completed matches
4. Try the Standard Inference page to verify players exist in database

## Technical Details

For technical implementation details, see:
- `docs/ADVANCED_INFERENCE_IMPLEMENTATION.md`
