import pandas as pd
import json
import glob
import os

def main():
    # 1. Parse Excel to build a mapping of school_id (string) -> list of ints (fields)
    # Using 2025 as the authoritative source for current fields
    file_path = 'older_βάσεις/gel-2025.xls'
    print(f"Reading {file_path}...")
    df = pd.read_excel(file_path, header=None, skiprows=3)
    
    # Col 0: ΚΩΔΙΚΟΣ ΣΧΟΛΗΣ, Col 4: ΕΠΙΣΤΗΜΟΝΙΚΑ ΠΕΔΙΑ
    field_mapping = {}
    
    for idx, row in df.iterrows():
        code = row[0]
        fields_str = row[4]
        
        if pd.isna(code) or pd.isna(fields_str):
            continue
            
        try:
            code_str = str(int(code))
        except ValueError:
            continue
        
        # Split by comma and convert to int
        fields_list = []
        for f in str(fields_str).replace('/', ',').split(','):
            f = f.strip()
            if f.isdigit():
                fields_list.append(int(f))
                
        if fields_list:
            field_mapping[code_str] = fields_list
            
    print(f"Extracted field mappings for {len(field_mapping)} unique schools.")
    
    # 2. Update JSON files
    for json_file in ['schools.json', 'schools_data_final.json']:
        if not os.path.exists(json_file):
            print(f"File {json_file} not found. Skipping.")
            continue
            
        print(f"Updating {json_file}...")
        with open(json_file, 'r', encoding='utf-8') as f:
            try:
                schools = json.load(f)
            except json.JSONDecodeError:
                print(f"Failed to decode {json_file}. Skipping.")
                continue
            
        updated_count = 0
        for school in schools:
            sid = str(school.get('id', ''))
            if sid in field_mapping:
                school['fields'] = field_mapping[sid]
                updated_count += 1
            else:
                # If not found in mapping, log it and default to empty
                # print(f"Warning: School ID {sid} ({school.get('name')}) not found in Excel mapping.")
                if 'fields' not in school:
                    school['fields'] = []
                    
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(schools, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully updated {updated_count} schools in {json_file}\n")

if __name__ == '__main__':
    main()
