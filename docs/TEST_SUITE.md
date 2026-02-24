# Test Suite Documentation

## Overview

Comprehensive test suite for display parsing, text normalization, neutral parsing, and inference pipeline.

## Test Files

### 1. `test_text_normalizer.py`
**Purpose**: Tests the shared text normalizer used by both display and inference parsers.

**Coverage**:
- ✅ Basic normalization
- ✅ Trimming whitespace
- ✅ Collapsing multiple spaces
- ✅ Converting tabs to spaces
- ✅ Handling mixed delimiters
- ✅ Removing empty lines
- ✅ Empty input handling
- ✅ Order preservation
- ✅ Deterministic behavior
- ✅ Tennis Abstract format handling

**Run**: `python services/backend/tests/test_text_normalizer.py`

### 2. `test_neutral_parser.py`
**Purpose**: Tests the neutral parser that never drops rows and attaches metadata.

**Coverage**:
- ✅ Never drops rows (preserves all input)
- ✅ Header detection
- ✅ Walkover detection
- ✅ Upcoming match detection
- ✅ Fields preserved as strings
- ✅ Row order preserved
- ✅ No header parsing
- ✅ Incomplete row detection
- ✅ Metadata attached to all rows
- ✅ Original line preserved

**Run**: `python services/backend/tests/test_neutral_parser.py`

### 3. `test_display_mapper.py`
**Purpose**: Tests the display mapper that formats rows for UI.

**Coverage**:
- ✅ Basic mapping
- ✅ Accurate counts (total, valid, ignored)
- ✅ Ignore reasons correctly set
- ✅ Valid rows not ignored
- ✅ Fields preserved
- ✅ Row index preserved
- ✅ Ignore reasons extraction
- ✅ All valid rows scenario
- ✅ All invalid rows scenario

**Run**: `python services/backend/tests/test_display_mapper.py`

### 4. `test_display_parsing_endpoint.py`
**Purpose**: Integration tests for the display parsing API endpoint.

**Coverage**:
- ✅ Basic endpoint functionality
- ✅ Summary accuracy
- ✅ Table rows correctly formatted
- ✅ Ignored rows flagged
- ✅ Valid rows not ignored
- ✅ Empty input handling
- ✅ No header parsing
- ✅ All rows preserved (never dropped)
- ✅ Error handling

**Run**: `python services/backend/tests/test_display_parsing_endpoint.py`

**Note**: Requires FastAPI TestClient and app initialization.

### 5. `test_inference_pipeline.py`
**Purpose**: Tests the canonical inference pipeline with `feature_mode`.

**Coverage**:
- ✅ `feature_mode="frozen"` uses Nov-14 features
- ✅ `feature_mode="fresh"` uses user-entered matches
- ✅ Invalid `feature_mode` raises error
- ✅ Frozen vs fresh produce different results
- ✅ `override_used` correctly derived
- ✅ Prediction structure correct
- ✅ Features structure correct

**Run**: `python services/backend/tests/test_inference_pipeline.py`

**Note**: Requires model and feature services to be initialized.

## Running All Tests

### Individual Test Files
```bash
# Text normalizer
python services/backend/tests/test_text_normalizer.py

# Neutral parser
python services/backend/tests/test_neutral_parser.py

# Display mapper
python services/backend/tests/test_display_mapper.py

# Display parsing endpoint (requires app)
python services/backend/tests/test_display_parsing_endpoint.py

# Inference pipeline (requires services)
python services/backend/tests/test_inference_pipeline.py
```

### Using pytest
```bash
# Run all tests
pytest services/backend/tests/

# Run specific test file
pytest services/backend/tests/test_text_normalizer.py

# Run with verbose output
pytest services/backend/tests/ -v

# Run specific test function
pytest services/backend/tests/test_text_normalizer.py::test_normalize_basic
```

## Test Coverage Summary

| Component | Unit Tests | Integration Tests | Coverage |
|-----------|------------|-------------------|----------|
| Text Normalizer | ✅ 10 tests | - | High |
| Neutral Parser | ✅ 11 tests | - | High |
| Display Mapper | ✅ 9 tests | - | High |
| Display Endpoint | - | ✅ 9 tests | High |
| Inference Pipeline | ✅ 7 tests | - | Medium* |

*Inference pipeline tests require model/feature services - may need mocking for CI/CD.

## Key Test Scenarios

### Display Parsing Flow
1. **Raw text** → Normalizer → **Normalized lines**
2. **Normalized lines** → Neutral Parser → **Neutral rows with metadata**
3. **Neutral rows** → Display Mapper → **Formatted table rows**
4. **Formatted rows** → API Response → **JSON with summary**

### Inference Flow
1. **Request** → `run_inference(feature_mode="frozen"|"fresh")`
2. **Feature loading** based on `feature_mode`
3. **Model prediction** with features
4. **Response** with `feature_mode` and `override_used`

## Edge Cases Covered

- ✅ Empty input
- ✅ Header-only input
- ✅ All rows invalid
- ✅ Mixed valid/invalid rows
- ✅ Tab vs space delimiters
- ✅ Walkovers and retirements
- ✅ Upcoming matches
- ✅ Incomplete data
- ✅ No header rows
- ✅ Invalid `feature_mode`

## Test Data

All tests use realistic Tennis Abstract match history format:
- Tab-separated columns
- Header row with column names
- Match descriptions with player names
- Serve statistics (A%, DF%, 1stIn%, 1st%, 2nd%)
- Walkovers (W/O)
- Upcoming matches (vs)

## Next Steps

1. **CI/CD Integration**: Add pytest to CI pipeline
2. **Mock Services**: Create mocks for model/feature services for faster tests
3. **E2E Tests**: Add end-to-end tests for full user flow
4. **Performance Tests**: Test with large datasets (100+ matches)
5. **Error Scenarios**: Add more edge case tests
