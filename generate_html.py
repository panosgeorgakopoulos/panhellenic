import json

with open('/Users/panosgeorgakopoulos/Downloads/panhellenic/schools_data_final.json', 'r', encoding='utf-8') as f:
    schools = json.load(f)

json_str = json.dumps(schools, ensure_ascii=False)

html_template = """<!DOCTYPE html>
<html lang="el">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Πανελλήνιες 2026 - Υπολογιστής & Πρόβλεψη Εισαγωγής (3ο Πεδίο)</title>
    <!-- Chart.js for data visualization -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --primary: #4F46E5;
            --primary-hover: #4338CA;
            --bg-color: #F3F4F6;
            --surface: #FFFFFF;
            --text-main: #1F2937;
            --text-muted: #6B7280;
            --border: #E5E7EB;
            --success: #10B981;
            --danger: #EF4444;
            --warning: #F59E0B;
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.6;
            padding: 2rem 1rem;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 2.5rem;
        }

        h1 {
            font-size: 2.5rem;
            color: var(--primary);
            margin-bottom: 0.5rem;
        }

        .subtitle {
            color: var(--text-muted);
            font-size: 1.1rem;
        }

        .card {
            background: var(--surface);
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            padding: 2rem;
            margin-bottom: 2rem;
        }

        .input-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .input-group {
            display: flex;
            flex-direction: column;
        }

        label {
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: var(--text-main);
        }

        input[type="number"], input[type="text"] {
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        input[type="number"]:focus, input[type="text"]:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }

        button.primary-btn {
            background-color: var(--primary);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        button.primary-btn:hover {
            background-color: var(--primary-hover);
        }

        .average-display {
            font-size: 1.25rem;
            font-weight: bold;
            color: var(--text-main);
            background: var(--bg-color);
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            border: 1px solid var(--border);
        }

        .filters {
            margin-bottom: 1.5rem;
        }

        .filters input {
            width: 100%;
            max-width: 400px;
        }

        .table-responsive {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th, td {
            padding: 1rem;
            border-bottom: 1px solid var(--border);
        }

        th {
            background-color: var(--bg-color);
            font-weight: 600;
            color: var(--text-muted);
            white-space: nowrap;
        }

        tbody tr:hover {
            background-color: #F8FAFC;
        }

        .badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.875rem;
            display: inline-block;
        }

        .text-success { color: var(--success); font-weight: bold; }
        .text-danger { color: var(--danger); font-weight: bold; }

        .bg-success { background-color: #D1FAE5; color: #065F46; }
        .bg-warning { background-color: #FEF3C7; color: #92400E; }
        .bg-danger { background-color: #FEE2E2; color: #991B1B; }

        .btn-sm {
            background: var(--bg-color);
            border: 1px solid var(--border);
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s;
        }

        .btn-sm:hover {
            background: #E2E8F0;
        }

        .accordion-row {
            display: none;
            background-color: #F8FAFC;
        }
        
        .accordion-row.active {
            display: table-row;
        }

        .chart-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 1rem;
            height: 300px;
        }

        @media (max-width: 768px) {
            h1 { font-size: 2rem; }
            .input-grid { grid-template-columns: 1fr; }
            .controls { flex-direction: column; align-items: stretch; }
            .average-display { text-align: center; }
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <h1>Πανελλήνιες 2026 - 3ο Πεδίο</h1>
        <p class="subtitle">Υπολογιστής Μορίων & Πρόβλεψη Εισαγωγής (Επιστήμες Υγείας & Ζωής)</p>
    </header>

    <div class="card">
        <div class="input-grid">
            <div class="input-group">
                <label for="gradeLang">Νεοελληνική Γλώσσα</label>
                <input type="number" id="gradeLang" min="0" max="20" step="0.1" value="18.5">
            </div>
            <div class="input-group">
                <label for="gradePhy">Φυσική</label>
                <input type="number" id="gradePhy" min="0" max="20" step="0.1" value="19.0">
            </div>
            <div class="input-group">
                <label for="gradeChem">Χημεία</label>
                <input type="number" id="gradeChem" min="0" max="20" step="0.1" value="18.8">
            </div>
            <div class="input-group">
                <label for="gradeBio">Βιολογία</label>
                <input type="number" id="gradeBio" min="0" max="20" step="0.1" value="19.2">
            </div>
        </div>

        <div class="controls">
            <button class="primary-btn" id="calcBtn">Υπολογισμός Μορίων & Πρόβλεψη</button>
            <div class="average-display" id="avgDisplay">Μέσος Όρος: 18.88</div>
        </div>
    </div>

    <div class="card">
        <div class="filters">
            <input type="text" id="searchInput" placeholder="Αναζήτηση σχολής ή πόλης (π.χ. Ιατρικής, Αθήνα)...">
        </div>

        <div class="table-responsive">
            <table id="resultsTable">
                <thead>
                    <tr>
                        <th>Σχολή</th>
                        <th>Ίδρυμα & Πόλη</th>
                        <th>Τα Μόρια σου</th>
                        <th>Βάση 2025</th>
                        <th>Απόκλιση</th>
                        <th>Πρόβλεψη (%)</th>
                        <th>Ενέργεια</th>
                    </tr>
                </thead>
                <tbody id="resultsBody">
                    <!-- Results will be injected here via JS -->
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    // 1. Data Structure containing all schools of the 3rd Field
    // Extracted exactly from official data (Weights & History 2020-2025)
    const schools = REPLACEME_JSON;

    let activeCharts = {}; // Store chart instances

    // 4. Data Science: Prediction Algorithm
    function calculatePrediction(userPoints, history) {
        const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
        const weights = [0.05, 0.05, 0.10, 0.20, 0.30, 0.30];
        
        let wma = 0;
        let wSum = 0;
        let validBases = [];

        // Calculate Weighted Moving Average based on available history
        for (let i = 0; i < years.length; i++) {
            let year = years[i];
            if (history[year] && history[year] > 0) {
                wma += history[year] * weights[i];
                wSum += weights[i];
                validBases.push(history[year]);
            }
        }

        if (validBases.length === 0) return { prob: 0, estBase: 0 };

        // Estimated base (normalized if missing years)
        const estBase = wma / wSum;

        // Calculate Standard Deviation of historical bases
        const mean = validBases.reduce((a, b) => a + b, 0) / validBases.length;
        const variance = validBases.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validBases.length;
        let stdev = Math.sqrt(variance);
        
        // Prevent extremely sharp sigmoid if variance is unusually low
        if (stdev < 50) stdev = 150; 

        // Calculate difference
        const diff = userPoints - estBase;

        // Sigmoid mapping tuned to provide realistic probabilities
        // Diff = 0 -> ~50%, Diff = stdev -> ~84%
        const x = (diff / stdev) * 1.7;
        let prob = 1 / (1 + Math.exp(-x));

        // Cap to 1% - 99% range
        prob = Math.max(0.01, Math.min(0.99, prob));
        return { prob: Math.round(prob * 100), estBase: Math.round(estBase) };
    }

    function getPredictionBadge(prob) {
        if (prob >= 70) return `<span class="badge bg-success">${prob}% (Υψηλή)</span>`;
        if (prob >= 40) return `<span class="badge bg-warning">${prob}% (Μέτρια)</span>`;
        return `<span class="badge bg-danger">${prob}% (Χαμηλή)</span>`;
    }

    // 3. Core Logic & Calculations
    function calculateAndRender() {
        const gLang = parseFloat(document.getElementById('gradeLang').value) || 0;
        const gPhy = parseFloat(document.getElementById('gradePhy').value) || 0;
        const gChem = parseFloat(document.getElementById('gradeChem').value) || 0;
        const gBio = parseFloat(document.getElementById('gradeBio').value) || 0;

        const avg = (gLang + gPhy + gChem + gBio) / 4;
        document.getElementById('avgDisplay').innerText = `Μέσος Όρος: ${avg.toFixed(2)}`;

        const tbody = document.getElementById('resultsBody');
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        
        tbody.innerHTML = '';

        schools.forEach((school, index) => {
            // Apply Filters
            const searchStr = `${school.name} ${school.city} ${school.institution}`.toLowerCase();
            if (searchTerm && !searchStr.includes(searchTerm)) return;

            // Points Formula calculation based on school's dynamic specific weights
            const wLang = school.weights.glossa;
            const wPhy = school.weights.fysiki;
            const wChem = school.weights.ximeia;
            const wBio = school.weights.viologia;

            // userPoints out of 20000 maximum (Grade * Weight) * 1000
            const userPoints = Math.round((gLang * wLang + gPhy * wPhy + gChem * wChem + gBio * wBio) * 1000);
            
            const base2025 = school.history['2025'] || 0;
            const deviation = userPoints - base2025;
            const deviationText = deviation >= 0 ? `+${deviation}` : deviation;
            const deviationClass = deviation >= 0 ? 'text-success' : 'text-danger';

            const pred = calculatePrediction(userPoints, school.history);

            // Create Main Row
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${school.name}</strong></td>
                <td>${school.institution} - ${school.city}</td>
                <td><strong>${userPoints}</strong></td>
                <td>${base2025}</td>
                <td class="${deviationClass}">${deviationText}</td>
                <td>${getPredictionBadge(pred.prob)}</td>
                <td>
                    <button class="btn-sm" onclick="toggleChart(${index}, ${userPoints})">View Stats</button>
                </td>
            `;
            tbody.appendChild(tr);

            // Create Accordion Row (Hidden by default)
            const trChart = document.createElement('tr');
            trChart.id = `chart-row-${index}`;
            trChart.className = 'accordion-row';
            trChart.innerHTML = `
                <td colspan="7">
                    <div class="chart-container">
                        <canvas id="chart-${index}"></canvas>
                    </div>
                </td>
            `;
            tbody.appendChild(trChart);
        });
    }

    // Toggle Chart Visibility
    window.toggleChart = function(index, userPoints) {
        const row = document.getElementById(`chart-row-${index}`);
        row.classList.toggle('active');

        if (row.classList.contains('active')) {
            renderChart(index, userPoints);
        }
    };

    // 5. Data Visualization (Chart.js)
    function renderChart(index, userPoints) {
        const school = schools[index];
        const ctx = document.getElementById(`chart-${index}`).getContext('2d');

        if (activeCharts[index]) {
            activeCharts[index].destroy();
        }

        const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
        const dataBases = years.map(y => school.history[y] || null);
        
        // Dynamically scale Y-Axis
        const validValues = dataBases.filter(v => v !== null);
        const minVal = Math.min(...validValues, userPoints) - 500;
        const maxVal = Math.max(...validValues, userPoints) + 500;

        activeCharts[index] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Ιστορικές Βάσεις',
                        data: dataBases,
                        borderColor: '#4F46E5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 6,
                        pointBackgroundColor: '#4F46E5'
                    },
                    {
                        label: 'Τα Μόριά Σου',
                        data: years.map(() => userPoints),
                        borderColor: '#10B981',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        min: Math.max(0, Math.floor(minVal / 100) * 100),
                        max: Math.ceil(maxVal / 100) * 100
                    }
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                interaction: { mode: 'nearest', axis: 'x', intersect: false }
            }
        });
    }

    // Event Listeners
    document.getElementById('calcBtn').addEventListener('click', calculateAndRender);
    document.getElementById('searchInput').addEventListener('input', calculateAndRender);

    // Initial load
    calculateAndRender();

    /* 
    ========================================================================
    HOW TO USE EXTERNAL JSON DATA IN THE FUTURE:
    
    To replace the hardcoded 'const schools = [...]' array above with 
    a dynamic fetch call to 'schools.json', follow these steps:
    
    1. Replace the JSON array line: const schools = [ ... ];
       with: let schools = [];
    2. Add the following function and call it on page load:
    
    async function loadSchoolsData() {
        try {
            const response = await fetch('schools.json');
            schools = await response.json();
            calculateAndRender(); // Re-render table once data is loaded
        } catch (error) {
            console.error("Error loading schools data:", error);
        }
    }
    
    // Trigger Data Fetch
    loadSchoolsData();
    ========================================================================
    */
</script>
</body>
</html>"""

html = html_template.replace("REPLACEME_JSON", json_str)

with open("/Users/panosgeorgakopoulos/Downloads/panhellenic/index.html", "w", encoding="utf-8") as f:
    f.write(html)
