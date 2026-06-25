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
                        # Extract text from innermost elements or direct text
                        subj_text = cells[0].get_text(strip=True)
                        weight_text = cells[-1].get_text(strip=True)
                        
                        # sometimes text is nested deeply
                        # let's try to map the subject
                        for greek_name, json_key in SUBJECT_MAP.items():
                            if greek_name in subj_text:
                                try:
                                    # Convert 30 (percent) to 0.30
                                    val = float(weight_text.replace(',', '.'))
                                    school_weights[json_key] = val / 100.0
                                except ValueError:
                                    pass
                                break
                        else:
                            # Handling special subjects (Eidikou mathimata)
                            # E.g. "Αγγλικά", "Ελεύθερο Σχέδιο"
                            if weight_text.replace('.', '', 1).isdigit():
                                try:
                                    val = float(weight_text.replace(',', '.'))
                                    # Just use the greek name as key if not found
                                    # Or a slugified version
                                    school_weights[subj_text] = val / 100.0
                                except ValueError:
                                    pass

            if school_weights:
                weights_data["special_school_weights"][school_id] = school_weights
                
    with open('weights_data.json', 'w', encoding='utf-8') as f:
        json.dump(weights_data, f, ensure_ascii=False, indent=2)
    print(f"Extracted weights for {len(weights_data['special_school_weights'])} schools.")

if __name__ == '__main__':
    extract_weights()
