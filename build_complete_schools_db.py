import pandas as pd
import glob
import re
import json
import os

def parse_fields(field_str):
    if pd.isna(field_str):
        return []
    field_str = str(field_str).replace(' ', '')
    if '/' in field_str:
        return [int(f) for f in field_str.split('/') if f.isdigit()]
    elif ',' in field_str:
        return [int(f) for f in field_str.split(',') if f.isdigit()]
    else:
        try:
            return [int(field_str)]
        except:
            return []

def get_base_score(val):
    if pd.isna(val):
        return 0
    try:
        # Handle cases where points are float or strings
        return int(float(str(val).replace(',', '.')))
    except:
        return 0

def get_code(val):
    try:
        return str(int(val)).zfill(4)
    except:
        return str(val).zfill(4)

def find_columns(df):
    cols = {}
    for i in range(5):
        row_vals = [str(x).strip() for x in df.iloc[i].values]
        for idx, val in enumerate(row_vals):
            if 'ΚΩΔΙΚΟΣ ΣΧΟΛΗΣ' in val: cols['code'] = idx
            if 'ΙΔΡΥΜΑ' in val: cols['inst'] = idx
            if 'ΟΝΟΜΑ ΣΧΟΛΗΣ' in val: cols['name'] = idx
            if 'ΕΙΔΟΣ ΘΕΣΗΣ' in val: cols['cat'] = idx
            if 'ΕΠΙΣΤΗΜΟΝΙΚΑ ΠΕΔΙΑ' in val: cols['fields'] = idx
            if 'ΒΑΘΜΟΣ ΤΕΛΕΥΤΑΙΟΥ' in val: cols['base'] = idx
        if len(cols) >= 6:
            break
    return cols

def build_db():
    files = glob.glob('older_βάσεις/*.xls')
    file_years = []
    
    for f in files:
        m = re.search(r'202\d', f)
        if m:
            file_years.append((int(m.group(0)), f))
            
    file_years.sort(key=lambda x: x[0], reverse=True) # newest first
    
    if not file_years:
        print("No base score excel files found.")
        return
        
    schools_dict = {}
    
    latest_year, latest_file = file_years[0]
    print(f"Parsing base schools from {latest_year} ({latest_file})...")
    
    df_latest = pd.read_excel(latest_file, header=None)
    cols = find_columns(df_latest)
    
    if len(cols) < 6:
        print(f"Could not find all required columns in {latest_file}. Found: {cols}")
        return
        
    df_gen = df_latest[df_latest[cols['cat']].astype(str).str.contains('ΓΕΝ', na=False, case=False, regex=True)]
    df_gen = df_gen.dropna(subset=[cols['code']])
    
    for _, row in df_gen.iterrows():
        code = get_code(row[cols['code']])
        base_score = get_base_score(row[cols['base']])
        fields = parse_fields(row[cols['fields']])
        
        schools_dict[code] = {
            "id": code,
            "name": str(row[cols['name']]).strip(),
            "institution": str(row[cols['inst']]).strip(),
            "base_score": base_score,
            "fields": fields,
            "history": {
                str(latest_year): base_score
            }
        }
        
    print(f"Found {len(schools_dict)} schools in the latest year.")
    
    for year, f in file_years[1:]:
        print(f"Parsing historical data from {year} ({f})...")
        try:
            df_old = pd.read_excel(f, header=None)
            c = find_columns(df_old)
            if 'cat' not in c or 'code' not in c or 'base' not in c:
                print(f"Missing essential columns in {f}. Found: {c}")
                continue
                
            df_old_gen = df_old[df_old[c['cat']].astype(str).str.contains('ΓΕΝ', na=False, case=False, regex=True)]
            df_old_gen = df_old_gen.dropna(subset=[c['code']])
            
            for _, row in df_old_gen.iterrows():
                code = get_code(row[c['code']])
                base_score = get_base_score(row[c['base']])
                
                if code in schools_dict and base_score > 0:
                    schools_dict[code]["history"][str(year)] = base_score
        except Exception as e:
            print(f"Error parsing {f}: {e}")

    schools_list = list(schools_dict.values())
    schools_list.sort(key=lambda x: x["name"])
    
    with open('schools_data_final.json', 'w', encoding='utf-8') as f:
        json.dump(schools_list, f, ensure_ascii=False, indent=4)
        
    print(f"Successfully wrote {len(schools_list)} schools to schools_data_final.json")

if __name__ == '__main__':
    build_db()
