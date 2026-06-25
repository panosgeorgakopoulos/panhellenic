import json
import statistics

with open('schools.json', 'r', encoding='utf-8') as f:
    schools = json.load(f)

for school in schools:
    history = school.get('history', {})
    bases = [v for k, v in history.items() if v and isinstance(v, (int, float)) and v > 0]
    
    if len(bases) > 1:
        var = statistics.stdev(bases)
        school['historical_variance'] = int(round(var))
    else:
        school['historical_variance'] = 150 # default baseline for new schools

with open('schools.json', 'w', encoding='utf-8') as f:
    json.dump(schools, f, ensure_ascii=False, indent=4)
