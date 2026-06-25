import json
import statistics
import glob
import pandas as pd
import numpy as np
import os

def calculate_trend(bases):
    """
    Calculate a weighted trend score.
    Positive means bases are trending up.
    Negative means bases are trending down.
    """
    if len(bases) < 2:
        return 0
    
    # We assign more weight to recent year-over-year changes
    # For example if bases is sorted from oldest to newest:
    changes = [bases[i] - bases[i-1] for i in range(1, len(bases))]
    
    # Weights for changes (more recent = higher weight)
    # E.g., for 5 changes: [1, 2, 3, 4, 5]
    weights = list(range(1, len(changes) + 1))
    weighted_sum = sum(c * w for c, w in zip(changes, weights))
    total_weight = sum(weights)
    
    return round(weighted_sum / total_weight, 2)

def enrich_schools():
    with open('schools.json', 'r', encoding='utf-8') as f:
        schools = json.load(f)

    # Calculate Volatility & Trend
    for school in schools:
        history = school.get('history', {})
        # Sort by year to ensure correct chronological order
        sorted_years = sorted(history.keys())
        bases = [history[y] for y in sorted_years if history[y] and isinstance(history[y], (int, float)) and history[y] > 0]
        
        # Volatility
        if len(bases) > 1:
            var = statistics.stdev(bases)
            school['volatility_index'] = int(round(var))
        else:
            school['volatility_index'] = 150 # default baseline for new schools
            
        # Trend
        school['trend_score'] = calculate_trend(bases)

    # Competitive Clustering
    for school in schools:
        # Get the most recent base
        history = school.get('history', {})
        sorted_years = sorted(history.keys())
        recent_bases = [history[y] for y in sorted_years if history[y] and isinstance(history[y], (int, float)) and history[y] > 0]
        
        if not recent_bases:
            school['alternatives_ids'] = []
            continue
            
        latest_base = recent_bases[-1]
        alternatives = []
        
        for other_school in schools:
            if school['id'] == other_school['id']:
                continue
                
            other_history = other_school.get('history', {})
            other_sorted_years = sorted(other_history.keys())
            other_recent_bases = [other_history[y] for y in other_sorted_years if other_history[y] and isinstance(other_history[y], (int, float)) and other_history[y] > 0]
            
            if other_recent_bases:
                other_latest_base = other_recent_bases[-1]
                if abs(latest_base - other_latest_base) <= 400:
                    alternatives.append(other_school['id'])
                    
        school['alternatives_ids'] = alternatives

    with open('schools.json', 'w', encoding='utf-8') as f:
        json.dump(schools, f, ensure_ascii=False, indent=4)
        
    print("Schools enriched with Volatility, Trend, and Competitive Clustering!")

def extract_normalization_factors():
    # Setup intervals mapping based on the Greek MoE excel format
    # The columns in excel represent percentage of students in these ranges
    intervals = {
        '0 ≤ ΒΑΘΜΟΣ < 5': 2.5,
        '5 ≤ ΒΑΘΜΟΣ < 10': 7.5,
        '10 ≤ ΒΑΘΜΟΣ < 11': 10.5,
        '11 ≤ ΒΑΘΜΟΣ < 12': 11.5,
        '12 ≤ ΒΑΘΜΟΣ < 13': 12.5,
        '13 ≤ ΒΑΘΜΟΣ < 14': 13.5,
        '14 ≤ ΒΑΘΜΟΣ < 15': 14.5,
        '15 ≤ ΒΑΘΜΟΣ < 16': 15.5,
        '16 ≤ ΒΑΘΜΟΣ < 17': 16.5,
        '17 ≤ ΒΑΘΜΟΣ < 18': 17.5,
        '18 ≤ ΒΑΘΜΟΣ < 19': 18.5,
        '19 ≤ ΒΑΘΜΟΣ <= 20': 19.5
    }
    
    files = glob.glob('stats/*.xls*')
    
    normalization_data = {}
    
    for file in files:
        year_str = [s for s in file.split('_') if s.replace('.xls','').replace('.xlsx','').isdigit()]
        if not year_str:
            continue
        year = year_str[-1].split('.')[0]
        
        try:
            # Skip first row and use the second row as headers to capture '0 ≤ ΒΑΘΜΟΣ < 5' etc.
            df = pd.read_excel(file, header=1)
            
            # Initialize year data
            normalization_data[year] = {}
            
            for index, row in df.iterrows():
                subject_name = str(row.iloc[0]).strip()
                if pd.isna(subject_name) or subject_name == 'nan' or subject_name == 'ΜΑΘΗΜΑ':
                    continue
                    
                total_percentage = 0
                expected_value = 0
                expected_value_sq = 0
                
                # Try to map columns that match our intervals
                # Note: In the MoE excel, percentages are in the '%' columns following the 'ΠΛΗΘΟΣ' columns.
                
                for col_name in intervals.keys():
                    if col_name in df.columns:
                        col_idx = df.columns.get_loc(col_name)
                        # The % is usually the next column (+1)
                        pct_val = row.iloc[col_idx + 1] 
                        
                        try:
                            # Clean pct_val (remove commas if present, replace with dot)
                            if isinstance(pct_val, str):
                                pct_val = pct_val.replace(',', '.')
                            pct_float = float(pct_val) / 100.0
                            midpoint = intervals[col_name]
                            
                            expected_value += midpoint * pct_float
                            expected_value_sq += (midpoint ** 2) * pct_float
                            total_percentage += pct_float
                        except Exception as e:
                            pass
                
                if total_percentage > 0:
                    # Normalize in case percentages don't add perfectly to 100%
                    mean = expected_value / total_percentage
                    var = (expected_value_sq / total_percentage) - (mean ** 2)
                    std = np.sqrt(var) if var > 0 else 0
                    
                    normalization_data[year][subject_name] = {
                        "mean": round(mean, 2),
                        "std": round(std, 2)
                    }
        except Exception as e:
            print(f"Error processing {file}: {e}")

    with open('normalization_factors.json', 'w', encoding='utf-8') as f:
        json.dump(normalization_data, f, ensure_ascii=False, indent=4)
        
    print("Normalization Factors calculated and saved to normalization_factors.json!")

if __name__ == "__main__":
    enrich_schools()
    extract_normalization_factors()
