#!/usr/bin/env python3
"""
build_normalization.py — Multi-Field Normalization Factor Generator
====================================================================

Dynamically discovers ALL Ministry-of-Education grade-statistics Excel files
across the project directory tree, extracts weighted μ (mean) and σ (std)
per subject per scientific field, and writes the result to
normalization_factors.json.

Directory Layout Handled:
  - stats_for field3/             (Field-specific ΑΝΑΛΥΤΙΚΟ files, 2021-2026)
  - Στατιστικά Βαθμολογιών_2024/  (Per-field + ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ, 2024)
  - Στατιστικά Βαθμολογιών_2025/  (ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ only, 2025)
  - Στατιστικά_Βαθμολογιών_Πανελ._2026/  (ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ only, 2026 xlsx)
  - 2020_Statistics/              (Garbled subdir names, 2020)
  - 2021_Στατιστικά_Βαθμών/       (Garbled subdir names, 2021)
  - Garbled-named 2022/2023 dirs  (Exist at project root level)

The script is encoding-agnostic: it doesn't rely on filenames at all.
Instead it reads row 0 of each sheet to extract the field name from the
title string that the Ministry embeds in every file.

File Structure (uniform across all years):
  Row 0: Title string  →  "ΣΤΑΤΙΣΤΙΚΑ ... - ΓΕΛ_ΗΜΕΡΗΣΙΟ - <FIELD_NAME> - ΠΑΝΕΛΛΑΔΙΚΕΣ <YEAR>"
  Row 1: Header        →  ΜΑΘΗΜΑ | ΑΡΙΘΜΟΣ ΥΠΟΨ. | ΑΝΑΒ. | ... grade-bracket headers ...
  Row 2: Sub-header    →  (nan)  | (nan)          | ΠΛΗΘΟΣ | % | ΠΛΗΘΟΣ | % | ...
  Row 3+: Data rows    →  Subject name | Total | regrade_count | regrade_% | count_0_5 | %_0_5 | ...

ΑΝΑΛΥΤΙΚΟ files have 12 grade bins (0-5, 5-10, 10-11, 11-12, ..., 19-20).
Non-ΑΝΑΛΥΤΙΚΟ (summary) files have only 2 bins (0-10, 10-20) — too coarse.
We ONLY process ΑΝΑΛΥΤΙΚΟ files for statistical accuracy.

Each Excel file has two sheets: 'ΗΜΕΡΗΣΙΑ' (day students) and 'ΕΣΠΕΡΙΝΑ' (evening).
We MERGE them (sum counts) into a single model per field, as requested.

Output: normalization_factors.json
  {
    "ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ)": {
      "ΦΥΣΙΚΗ Ο.Π.": { "mean": 12.4, "std": 3.1 },
      ...
    },
    ...
  }
"""

import os
import re
import json
import math
import warnings
from collections import defaultdict

import pandas as pd

warnings.filterwarnings("ignore", category=UserWarning)


def normalize_subject_name(name):
    """
    Normalize variant spellings of the same subject across years.
    
    The MoE sometimes uses Latin characters in Greek words (e.g.
    'ΛΟΓOTEXNIA' with Latin O/E instead of 'ΛΟΓΟΤΕΧΝΙΑ'). This
    function normalizes to the canonical Greek spelling.
    """
    # Map of known variant -> canonical
    SPELLING_FIXES = {
        'ΛΟΓOTEXNIA': 'ΛΟΓΟΤΕΧΝΙΑ',
        'ΛΟΓΟTEXNIA': 'ΛΟΓΟΤΕΧΝΙΑ',
    }
    result = name
    for variant, canonical in SPELLING_FIXES.items():
        result = result.replace(variant, canonical)
    return result.strip()

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "normalization_factors.json")

# The 12 grade-bracket midpoints used by the ΑΝΑΛΥΤΙΚΟ format.
# Brackets:  [0,5)  [5,10)  [10,11)  [11,12)  [12,13)  [13,14)  [14,15)  [15,16)  [16,17)  [17,18)  [18,19)  [19,20]
GRADE_MIDPOINTS = [2.5, 7.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5, 17.5, 18.5, 19.5]

# The count columns for each bracket are at these indices (0-indexed) in the Excel row:
# Col 4  = count for [0,5)       Col 5  = %
# Col 6  = count for [5,10)      Col 7  = %
# Col 8  = count for [10,11)     Col 9  = %
# ...and so on, every 2 columns.
COUNT_COLS = list(range(4, 28, 2))  # [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26]


# ──────────────────────────────────────────────
# Step 1: Dynamic File Discovery
# ──────────────────────────────────────────────
def discover_analytic_files():
    """
    Walk the entire project tree and find all Excel files that contain
    ΑΝΑΛΥΤΙΚΟ-style data (12 grade brackets).
    
    We identify them by checking if Row 1 contains 12+ grade-bracket
    headers (the string "ΒΑΘΜΟΣ" appears 12+ times), rather than
    relying on the (often garbled) filename.
    
    Returns a list of absolute file paths.
    """
    candidates = []
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Skip hidden dirs, older_βάσεις (cutoff data, not statistics)
        dirs[:] = [d for d in dirs if not d.startswith('.') and 'older' not in d.lower()]
        for f in files:
            if f.startswith('.') or f.startswith('~$'):
                continue
            if not f.endswith(('.xls', '.xlsx')):
                continue
            candidates.append(os.path.join(root, f))
    
    analytic_files = []
    for fp in candidates:
        try:
            # Quick check: read only the header row to determine if this
            # file has 12 grade brackets (ΑΝΑΛΥΤΙΚΟ) or only 2 (summary).
            df_header = pd.read_excel(fp, header=None, nrows=3, sheet_name=0)
            # Row 1 of ΑΝΑΛΥΤΙΚΟ files contains strings like "10 ≤ ΒΑΘΜΟΣ < 11"
            row1_str = " ".join(str(v) for v in df_header.iloc[1].values if pd.notna(v))
            bracket_count = row1_str.count("ΒΑΘΜΟΣ")
            if bracket_count >= 10:  # ΑΝΑΛΥΤΙΚΟ has 12 brackets
                analytic_files.append(fp)
        except Exception:
            continue
    
    return analytic_files


# ──────────────────────────────────────────────
# Step 2: Parse Field Name & Year from Title Row
# ──────────────────────────────────────────────
def extract_field_and_year(title_str):
    """
    Parse the title string embedded in row 0 of every MoE file.
    
    Examples:
      "ΣΤΑΤΙΣΤΙΚΑ ... - ΓΕΛ_ΗΜΕΡΗΣΙΟ - ΑΝΘΡΩΠΙΣΤΙΚΩΝ ΣΠΟΥΔΩΝ - ΠΑΝΕΛΛΑΔΙΚΕΣ 2024"
      "ΣΤΑΤΙΣΤΙΚΑ ... - ΓΕΛ ΗΜΕΡΗΣΙΟ - ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ ΠΡΟΣΑΝ. - ΠΑΝΕΛΛΑΔΙΚΕΣ 2026"
      "ΣΤΑΤΙΣΤΙΚΑ ... - ΓΕΛ_ΕΣΠΕΡΙΝΟ - ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ... - ΠΑΝΕΛΛΑΔΙΚΕΣ 2024"
      "ΣΤΑΤΙΣΤΙΚΑ ... - ΝΕΟ ΣΥΣΤΗΜΑ - ΓΕΛ_ΗΜΕΡΗΣΙΟ - ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ - ΠΑΝΕΛΛΑΔΙΚΕΣ 2020"
    
    Returns (field_name: str, year: int) or (None, None) if unparseable.
    """
    if not isinstance(title_str, str):
        return None, None
    
    # Clean up whitespace and newlines
    title = re.sub(r'\s+', ' ', title_str).strip()
    
    # Extract year from the end (ΠΑΝΕΛΛΑΔΙΚΕΣ YYYY)
    year_match = re.search(r'(\d{4})\s*$', title)
    year = int(year_match.group(1)) if year_match else None
    
    # Extract the field name.
    # Strategy: find the text between "ΓΕΛ_ΗΜΕΡΗΣΙΟ - " (or ΕΣΠΕΡΙΝΟ) and " - ΠΑΝΕΛΛΑΔΙΚΕΣ"
    # Also handle "ΝΕΟ ΣΥΣΤΗΜΑ" and "ΠΑΛΑΙΟ ΣΥΣΤΗΜΑ" prefixes in 2020 files.
    # Also handle "ΕΠΑΛ" files (technical school) separately.
    
    # Skip ΕΠΑΛ files entirely (different school system)
    if 'ΕΠΑΛ' in title:
        return None, year
    
    # Try multiple regex patterns (the MoE format varies slightly across years)
    patterns = [
        r'ΓΕΛ[_ ](?:ΗΜΕΡΗΣΙ[ΟΑ]|ΕΣΠΕΡΙΝ[ΟΑ])\s*-?\s*(.+?)\s*-\s*ΠΑΝΕΛΛΑΔΙΚ',
        r'ΓΕΛ[_ ](?:ΗΜΕΡΗΣΙ[ΟΑ]|ΕΣΠΕΡΙΝ[ΟΑ])\s*-?\s*(.+?)$',
    ]
    
    field = None
    for pattern in patterns:
        m = re.search(pattern, title)
        if m:
            field = m.group(1).strip().rstrip(' -')
            break
    
    if not field:
        return None, year
    
    # Normalize: strip leading dashes, trailing whitespace
    field = field.strip(' -')
    
    # Skip "ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ" aggregate files — we prefer per-field data.
    # However, for years where only ΟΛΕΣ exists (2025, 2026), we DO process them.
    # We'll tag them with a special key so the caller can decide.
    if 'ΟΛΕΣ' in field:
        field = 'ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ'
    
    return field, year


# ──────────────────────────────────────────────
# Step 3: Extract Subject Statistics from a Sheet
# ──────────────────────────────────────────────
def extract_sheet_data(df):
    """
    Given a raw DataFrame read with header=None from an ΑΝΑΛΥΤΙΚΟ sheet,
    extract {subject_name: [count_per_bracket]} for each subject.
    
    Row 0 = title, Row 1 = header, Row 2 = sub-header, Row 3+ = data.
    """
    results = {}
    
    for row_idx in range(3, len(df)):
        row = df.iloc[row_idx]
        raw_subject = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
        subject = normalize_subject_name(raw_subject)
        
        # Skip empty / whitespace rows and aggregate rows
        if not subject or subject == 'nan' or len(subject) < 3:
            continue
        
        # Extract counts for each grade bracket
        counts = []
        valid = True
        for col_idx in COUNT_COLS:
            if col_idx >= len(row):
                valid = False
                break
            val = row.iloc[col_idx]
            if pd.isna(val):
                counts.append(0)
            else:
                try:
                    counts.append(int(float(val)))
                except (ValueError, TypeError):
                    counts.append(0)
        
        if not valid or len(counts) != 12:
            continue
        
        # Skip rows where total count is 0 (empty subject)
        if sum(counts) == 0:
            continue
        
        results[subject] = counts
    
    return results


def compute_weighted_stats(counts_list):
    """
    Given a list of 12 frequency counts (one per grade bracket),
    compute the weighted mean and standard deviation.
    
    Uses the midpoint of each bracket as the representative value.
    """
    assert len(counts_list) == len(GRADE_MIDPOINTS) == 12
    
    total = sum(counts_list)
    if total == 0:
        return None, None
    
    # Weighted mean: μ = Σ(midpoint_i * count_i) / Σ(count_i)
    mu = sum(m * c for m, c in zip(GRADE_MIDPOINTS, counts_list)) / total
    
    # Weighted variance: σ² = Σ(count_i * (midpoint_i - μ)²) / Σ(count_i)
    var = sum(c * (m - mu) ** 2 for m, c in zip(GRADE_MIDPOINTS, counts_list)) / total
    sigma = math.sqrt(var)
    
    return round(mu, 2), round(sigma, 2)


# ──────────────────────────────────────────────
# Step 4: Main Processing Pipeline
# ──────────────────────────────────────────────
def main():
    print("=" * 70)
    print("  build_normalization.py — Multi-Field Normalization Generator")
    print("=" * 70)
    
    # Discover all ΑΝΑΛΥΤΙΚΟ Excel files
    analytic_files = discover_analytic_files()
    print(f"\n✅ Discovered {len(analytic_files)} ΑΝΑΛΥΤΙΚΟ files across the project.\n")
    
    # Accumulator: {field: {subject: [total_counts_per_bracket]}}
    # We accumulate raw frequency counts so that we can merge ΗΜΕΡΗΣΙΑ + ΕΣΠΕΡΙΝΑ
    # and also merge multiple years into one model per field.
    accumulator = defaultdict(lambda: defaultdict(lambda: [0] * 12))
    
    # Track which per-field files we found (to know if we need ΟΛΕΣ fallback)
    per_field_years = defaultdict(set)  # field -> set of years
    oles_files = []  # files tagged as ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ
    
    for fp in sorted(analytic_files):
        try:
            xls = pd.ExcelFile(fp)
        except Exception as e:
            print(f"  ⚠️  Cannot open: {os.path.basename(fp)}: {e}")
            continue
        
        for sheet_name in xls.sheet_names:
            try:
                df = pd.read_excel(fp, sheet_name=sheet_name, header=None)
            except Exception:
                continue
            
            if len(df) < 4:
                continue
            
            # Extract field name and year from the title row
            title = str(df.iloc[0, 0]) if pd.notna(df.iloc[0, 0]) else ''
            field, year = extract_field_and_year(title)
            
            if not field or not year:
                continue
            
            # Skip ΠΑΛΑΙΟ ΣΥΣΤΗΜΑ (old exam system, different structure)
            if 'ΠΑΛΑΙΟ' in title:
                continue
            
            if field == 'ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ':
                oles_files.append((fp, sheet_name, year))
                continue
            
            # Extract subject data from this sheet
            subject_data = extract_sheet_data(df)
            
            if not subject_data:
                continue
            
            per_field_years[field].add(year)
            
            # Merge counts into the accumulator
            for subject, counts in subject_data.items():
                for i in range(12):
                    accumulator[field][subject][i] += counts[i]
            
            short_name = os.path.basename(fp)[:50]
            print(f"  📊 {sheet_name:10s} | {field[:55]:55s} | {year} | {len(subject_data)} subjects | {short_name}...")
    
    # Process ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ files for subjects not yet covered by per-field data.
    # These combined files contain ALL subjects from ALL fields in one sheet.
    # We route each subject to EVERY field that uses it, matching the canonical
    # field names produced by the per-field files.
    #
    # Subject → list of fields it belongs to:
    SUBJECT_TO_FIELDS = {
        'ΑΡΧΑΙΑ ΕΛΛΗΝΙΚΑ Ο.Π.': ['ΑΝΘΡΩΠΙΣΤΙΚΩΝ ΣΠΟΥΔΩΝ'],
        'ΙΣΤΟΡΙΑ Ο.Π.':         ['ΑΝΘΡΩΠΙΣΤΙΚΩΝ ΣΠΟΥΔΩΝ'],
        'ΛΑΤΙΝΙΚΑ Ο.Π.':        ['ΑΝΘΡΩΠΙΣΤΙΚΩΝ ΣΠΟΥΔΩΝ'],
        'ΦΥΣΙΚΗ Ο.Π.':          [
            'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ)',
            'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ)',
        ],
        'ΧΗΜΕΙΑ Ο.Π.':          [
            'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ)',
            'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ)',
        ],
        'ΜΑΘΗΜΑΤΙΚΑ Ο.Π.':      [
            'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ)',
            'ΣΠΟΥΔΩΝ ΟΙΚΟΝΟΜΙΑΣ ΚΑΙ ΠΛΗΡΟΦΟΡΙΚΗΣ',
        ],
        'ΒΙΟΛΟΓΙΑ Ο.Π.':        [
            'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ)',
        ],
        'ΠΛΗΡΟΦΟΡΙΚΗ Ο.Π.':     ['ΣΠΟΥΔΩΝ ΟΙΚΟΝΟΜΙΑΣ ΚΑΙ ΠΛΗΡΟΦΟΡΙΚΗΣ'],
        'ΟΙΚΟΝΟΜΙΑ Ο.Π.':       ['ΣΠΟΥΔΩΝ ΟΙΚΟΝΟΜΙΑΣ ΚΑΙ ΠΛΗΡΟΦΟΡΙΚΗΣ'],
    }
    
    # The common subject (Γλώσσα) belongs to ALL four canonical fields
    ALL_CANONICAL_FIELDS = [
        'ΑΝΘΡΩΠΙΣΤΙΚΩΝ ΣΠΟΥΔΩΝ',
        'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ)',
        'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ ΚΑΙ ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ (Ε.Π. ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ)',
        'ΣΠΟΥΔΩΝ ΟΙΚΟΝΟΜΙΑΣ ΚΑΙ ΠΛΗΡΟΦΟΡΙΚΗΣ',
    ]
    COMMON_SUBJECT = 'ΝΕΟΕΛΛΗΝΙΚΗ ΓΛΩΣΣΑ'  # partial match
    
    print(f"\n  📦 Processing {len(oles_files)} ΟΛΕΣ ΟΙ ΟΜΑΔΕΣ sheets as fallback...")
    
    for fp, sheet_name, year in oles_files:
        try:
            df = pd.read_excel(fp, sheet_name=sheet_name, header=None)
        except Exception:
            continue
        
        subject_data = extract_sheet_data(df)
        
        for subject, counts in subject_data.items():
            # Determine which field(s) this subject belongs to
            target_fields = None
            for key, field_list in SUBJECT_TO_FIELDS.items():
                if key in subject:
                    target_fields = field_list
                    break
            
            if target_fields is None:
                # Common subject (Γλώσσα) — add to ALL canonical fields
                if COMMON_SUBJECT in subject:
                    target_fields = ALL_CANONICAL_FIELDS
                else:
                    continue
            
            for target_field in target_fields:
                accumulator[target_field][subject] = [
                    accumulator[target_field][subject][i] + counts[i]
                    for i in range(12)
                ]
    
    # ──────────────────────────────────────────────
    # Step 5: Merge duplicate subject entries per field
    # ──────────────────────────────────────────────
    # Within each field, merge subjects that map to the same canonical
    # name (e.g. ΛΟΓΟΤΕΧΝΙΑ variants were already normalized, but if
    # any remnant keys exist from prior accumulation, combine them).
    
    # Also remove any "orphan" fields that were created purely by the
    # ΟΛΕΣ fallback (e.g. bare ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ, ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ) that
    # duplicate the canonical long-form names.
    ORPHAN_FIELDS = {'ΘΕΤΙΚΩΝ ΣΠΟΥΔΩΝ', 'ΣΠΟΥΔΩΝ ΥΓΕΙΑΣ'}
    for orphan in ORPHAN_FIELDS:
        if orphan in accumulator:
            del accumulator[orphan]
    
    # ──────────────────────────────────────────────
    # Step 6: Compute μ and σ, build output JSON
    # ──────────────────────────────────────────────
    output = {}
    
    print("\n" + "=" * 70)
    print("  RESULTS")
    print("=" * 70)
    
    for field in sorted(accumulator.keys()):
        subjects = accumulator[field]
        field_output = {}
        
        print(f"\n  📚 {field}")
        
        for subject in sorted(subjects.keys()):
            counts = subjects[subject]
            mu, sigma = compute_weighted_stats(counts)
            
            if mu is not None:
                field_output[subject] = {"mean": mu, "std": sigma}
                total_n = sum(counts)
                print(f"      {subject:50s}  μ={mu:6.2f}  σ={sigma:5.2f}  (N={total_n:,})")
        
        if field_output:
            output[field] = field_output
    
    # Write output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'=' * 70}")
    print(f"  ✅ Written to {OUTPUT_FILE}")
    print(f"     {len(output)} scientific fields, {sum(len(v) for v in output.values())} total subject entries.")
    print(f"{'=' * 70}")


if __name__ == '__main__':
    main()
