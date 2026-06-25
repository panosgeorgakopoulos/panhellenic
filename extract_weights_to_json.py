import json
import glob
import re
from bs4 import BeautifulSoup

SUBJECT_MAP = {
    'Νεοελληνική Γλώσσα και Λογοτεχνία': 'glossa',
    'Αρχαία Ελληνικά': 'arxaia',
    'Ιστορία': 'istoria',
    'Λατινικά': 'latinika',
    'Φυσική': 'fysiki',
    'Χημεία': 'ximeia',
    'Μαθηματικά': 'mathimatika',
    'Βιολογία': 'viologia',
    'Πληροφορική': 'pliroforiki',
    'Οικονομία': 'oikonomia'
}

def extract_weights():
    files = glob.glob('weights/sintelestes_barititas*.php')
    
    weights_data = {
        "special_school_weights": {}
    }
    
    for file_path in files:
        # Determine the field ID from the filename
        match_field = re.search(r'barititas(\d)\.php', file_path)
        field_id = match_field.group(1) if match_field else "1"

        with open(file_path, 'rb') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
            
        links = soup.find_all('a', href=re.compile(r'sxoli\.php\?sxoli=(\d+)'))
        
        for link in links:
            match = re.search(r'sxoli\.php\?sxoli=(\d+)', link.get('href'))
            if not match:
                continue
            school_id = match.group(1)
            school_name = link.get_text(strip=True)
            
            center = link.find_next_sibling('center')
            if not center:
                continue
                
            tables = center.find_all('table')
            school_weights = {}
            for t in tables:
                rows = t.find_all('tr')
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) >= 2:
                        subj_text = cells[0].get_text(strip=True)
                        weight_text = cells[-1].get_text(strip=True)
                        
                        for greek_name, json_key in SUBJECT_MAP.items():
                            if greek_name in subj_text:
                                try:
                                    val = float(weight_text.replace(',', '.'))
                                    school_weights[json_key] = val / 100.0
                                except ValueError:
                                    pass
                                break
                        else:
                            if weight_text.replace('.', '', 1).isdigit():
                                try:
                                    val = float(weight_text.replace(',', '.'))
                                    school_weights[subj_text] = val / 100.0
                                except ValueError:
                                    pass

            if school_weights:
                if school_id not in weights_data["special_school_weights"]:
                    weights_data["special_school_weights"][school_id] = {}
                weights_data["special_school_weights"][school_id][field_id] = school_weights
                
    with open('weights_data.json', 'w', encoding='utf-8') as f:
        json.dump(weights_data, f, ensure_ascii=False, indent=2)
    print(f"Extracted weights for {len(weights_data['special_school_weights'])} schools.")

if __name__ == '__main__':
    extract_weights()
