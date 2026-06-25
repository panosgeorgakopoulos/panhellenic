let schools = [];
let statsData = {};
let activeCharts = {};
let normalizationData = {};

let activeFieldId = document.body.getAttribute('data-field');

// Load data from external JSON files
async function loadData() {
    try {
        const [schoolsRes, statsRes, normRes] = await Promise.all([
            fetch('schools_data_final.json'), // using the updated JSON as requested
            fetch('stats_data.json'),
            fetch('normalization_factors.json')
        ]);
        schools = await schoolsRes.json();
        statsData = await statsRes.json();
        normalizationData = await normRes.json();
        
        if (activeFieldId) {
            calculateAndRender();
            setupInteractiveSteppers();
        }
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

/**
 * Phase 2 - F1: Score Estimation Intervals
 * Returns a base estimate and an 80% confidence interval (lower bound, upper bound)
 */
function calculateScoreEstimation(school, natPerfDelta, seatDelta) {
    const years = ['2025', '2024', '2023', '2022'];
    // WMA Weights: Exponentially more weight to recent years
    const weights = [0.40, 0.30, 0.20, 0.10]; 
    
    let sumW = 0;
    let mu_p = 0;
    
    for (let i = 0; i < years.length; i++) {
        const y = years[i];
        if (school.history && school.history[y]) {
            mu_p += school.history[y] * weights[i];
            sumW += weights[i];
        }
    }
    
    mu_p = sumW > 0 ? (mu_p / sumW) : 10000;
    
    // Apply Systemic Modifiers
    const base_estimate = mu_p * (1 + natPerfDelta) * (1 - seatDelta);
    
    // Variance/Volatility mapping
    const volatility = school.volatility_index || school.historical_variance || 150;
    const sigma = Math.max(volatility, 50); 
    
    // 80% Confidence Interval (Z ≈ 1.28 for 80% CI)
    const z_80 = 1.28;
    const lower_bound = base_estimate - (z_80 * sigma);
    const upper_bound = base_estimate + (z_80 * sigma);
    
    return { base_estimate, lower_bound, upper_bound, sigma };
}

/**
 * Phase 2 - F3: Sigmoid Admission Engine
 * Replaces Pass/Fail with Logistic function using volatility_index and trend_score
 */
function calculateAdmissionProbability(userScore, schoolData, baseEstimate) {
    // Extract enrichment factors
    const volatility = schoolData.volatility_index || schoolData.historical_variance || 150;
    const trend = schoolData.trend_score || 0;
    
    // k adjusts steepness (higher volatility = flatter curve = smaller k)
    // Scale k so that standard deviation spreads the probability realistically
    const k = 1.702 / Math.max(volatility, 50); 
    
    // baseline x_0 shifted by trend
    const x_0 = baseEstimate + trend;
    
    // Logistic Sigmoid Function
    let P = 1 / (1 + Math.exp(-k * (userScore - x_0)));
    
    P = Math.max(0.01, Math.min(0.99, P));
    return P;
}

/**
 * Risk Classification UI
 */
function getAdvancedPredictionBadge(probPct) {
    if (probPct > 85) return `<span class="badge bg-success">High Certainty (Safety) - ${probPct}%</span>`;
    if (probPct >= 50) return `<span class="badge" style="background-color: #D9F99D; color: #3F6212;">Competitive (Target) - ${probPct}%</span>`;
    if (probPct >= 15) return `<span class="badge" style="background-color: #FED7AA; color: #9A3412;">Marginal (Reach) - ${probPct}%</span>`;
    return `<span class="badge bg-danger">Low Probability (High Risk) - ${probPct}%</span>`;
}

function normalizeString(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Map field IDs to normalization JSON keys
const FIELD_KEYS = {
    "1": "\u0391\u039d\u0398\u03a1\u03a9\u03a0\u0399\u03a3\u03a4\u0399\u039a\u03a9\u039d \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d",
    "2": "\u0398\u0395\u03a4\u0399\u039a\u03a9\u039d \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u039a\u0391\u0399 \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u03a5\u0393\u0395\u0399\u0391\u03a3 (\u0395.\u03a0. \u0398\u0395\u03a4\u0399\u039a\u03a9\u039d \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d)",
    "3": "\u0398\u0395\u03a4\u0399\u039a\u03a9\u039d \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u039a\u0391\u0399 \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u03a5\u0393\u0395\u0399\u0391\u03a3 (\u0395.\u03a0. \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u03a5\u0393\u0395\u0399\u0391\u03a3)",
    "4": "\u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u039f\u0399\u039a\u039f\u039d\u039f\u039c\u0399\u0391\u03a3 \u039a\u0391\u0399 \u03a0\u039b\u0397\u03a1\u039f\u03a6\u039f\u03a1\u0399\u039a\u0397\u03a3"
};

// Map input IDs to their normalization subject keys based on Field
const GRADE_TO_SUBJECT_MAP = {
    "1": {
        gradeLang: '\u039d\u0395\u039f\u0395\u039b\u039b\u0397\u039d\u0399\u039a\u0397 \u0393\u039b\u03a9\u03a3\u03a3\u0391 \u039a\u0391\u0399 \u039b\u039f\u0393\u039f\u03a4\u0395\u03a7\u039d\u0399\u0391 \u0393.\u03a0.',
        gradeArx: '\u0391\u03a1\u03a7\u0391\u0399\u0391 \u0395\u039b\u039b\u0397\u039d\u0399\u039a\u0391 \u039f.\u03a0.',
        gradeIst: '\u0399\u03a3\u03a4\u039f\u03a1\u0399\u0391 \u039f.\u03a0.',
        gradeLat: '\u039b\u0391\u03a4\u0399\u039d\u0399\u039a\u0391 \u039f.\u03a0.'
    },
    "2": {
        gradeLang: '\u039d\u0395\u039f\u0395\u039b\u039b\u0397\u039d\u0399\u039a\u0397 \u0393\u039b\u03a9\u03a3\u03a3\u0391 \u039a\u0391\u0399 \u039b\u039f\u0393\u039f\u03a4\u0395\u03a7\u039d\u0399\u0391 \u0393.\u03a0.',
        gradePhy:  '\u03a6\u03a5\u03a3\u0399\u039a\u0397 \u039f.\u03a0.',
        gradeChem: '\u03a7\u0397\u039c\u0395\u0399\u0391 \u039f.\u03a0.',
        gradeMath: '\u039c\u0391\u0398\u0397\u039c\u0391\u03a4\u0399\u039a\u0391 \u039f.\u03a0.'
    },
    "3": {
        gradeLang: '\u039d\u0395\u039f\u0395\u039b\u039b\u0397\u039d\u0399\u039a\u0397 \u0393\u039b\u03a9\u03a3\u03a3\u0391 \u039a\u0391\u0399 \u039b\u039f\u0393\u039f\u03a4\u0395\u03a7\u039d\u0399\u0391 \u0393.\u03a0.',
        gradePhy:  '\u03a6\u03a5\u03a3\u0399\u039a\u0397 \u039f.\u03a0.',
        gradeChem: '\u03a7\u0397\u039c\u0395\u0399\u0391 \u039f.\u03a0.',
        gradeBio:  '\u0392\u0399\u039f\u039b\u039f\u0393\u0399\u0391 \u039f.\u03a0.'
    },
    "4": {
        gradeLang: '\u039d\u0395\u039f\u0395\u039b\u039b\u0397\u039d\u0399\u039a\u0397 \u0393\u039b\u03a9\u03a3\u03a3\u0391 \u039a\u0391\u0399 \u039b\u039f\u0393\u039f\u03a4\u0395\u03a7\u039d\u0399\u0391 \u0393.\u03a0.',
        gradeMath: '\u039c\u0391\u0398\u0397\u039c\u0391\u03a4\u0399\u039a\u0391 \u039f.\u03a0.',
        gradePli:  '\u03a0\u039b\u0397\u03a1\u039f\u03a6\u039f\u03a1\u0399\u039a\u0397 \u039f.\u03a0.',
        gradeOik:  '\u039f\u0399\u039a\u039f\u039d\u039f\u039c\u0399\u0391 \u039f.\u03a0.'
    }
};

function getActiveGradeMap() {
    return GRADE_TO_SUBJECT_MAP[activeFieldId] || {};
}

function zScoreToPercentile(z) {
    // Approximate percentile from Z-score using the error function approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.8212560 + t * 1.3302744))));
    return z > 0 ? Math.round((1 - p) * 100) : Math.round(p * 100);
}

function updateZScoreBadges() {
    if (!activeFieldId) return;
    const fieldKey = FIELD_KEYS[activeFieldId];
    const fieldData = normalizationData[fieldKey];
    if (!fieldData) return;

    const gradeMap = getActiveGradeMap();

    for (const [inputId, subjectKey] of Object.entries(gradeMap)) {
        const badgeId = inputId.replace('grade', 'zBadge'); // dynamic badge id (e.g. gradeLang -> zBadgeLang)
        const badgeEl = document.getElementById(badgeId);
        if (!badgeEl) continue;

        const subjectStats = fieldData[subjectKey];
        if (!subjectStats) {
            badgeEl.innerHTML = '';
            continue;
        }

        const grade = parseFloat(document.getElementById(inputId).value) || 0;
        const z = (grade - subjectStats.mean) / subjectStats.std;
        const pct = zScoreToPercentile(z);

        let color, label;
        if (z >= 1.5)      { color = 'var(--success)'; label = `Top ${100 - pct}%`; }
        else if (z >= 0.5)  { color = '#3B82F6';       label = `\u0386\u03bd\u03c9 \u03bc\u03ad\u03c3\u03bf\u03c5`; }
        else if (z >= -0.5) { color = 'var(--warning)'; label = `\u039c\u03ad\u03c3\u03bf\u03c2 \u03cc\u03c1\u03bf\u03c2`; }
        else                { color = 'var(--danger)';  label = `\u039a\u03ac\u03c4\u03c9 \u03bc\u03ad\u03c3\u03bf\u03c5`; }

        const sign = z >= 0 ? '+' : '';
        badgeEl.innerHTML = `<span style="color:${color}; font-weight:600;">${label}</span> <span style="color:var(--text-muted);">(${sign}${z.toFixed(1)}\u03c3)</span>`;
    }
}

function calculateAndRender() {
    if (!activeFieldId) return; // Do nothing if not on a field page

    const gradeMap = getActiveGradeMap();
    let sumGrades = 0;
    let inputsFound = 0;
    const currentGrades = {};

    for (const inputId in gradeMap) {
        const val = parseFloat(document.getElementById(inputId)?.value) || 0;
        sumGrades += val;
        inputsFound++;
        currentGrades[inputId] = val;
    }

    const natPerfInput = parseFloat(document.getElementById('natPerfDelta')?.value) || 0;
    const seatDeltaInput = parseFloat(document.getElementById('seatDelta')?.value) || 0;
    const natPerfDelta = natPerfInput / 100;
    const seatDelta = seatDeltaInput / 100;

    const avg = inputsFound > 0 ? sumGrades / inputsFound : 0;
    const avgDisplay = document.getElementById('avgDisplay');
    if (avgDisplay) avgDisplay.innerText = `\u039c\u03ad\u03c3\u03bf\u03c2 \u038c\u03c1\u03bf\u03c2: ${avg.toFixed(2)}`;

    // Update Z-Score Badges
    updateZScoreBadges();

    const tbody = document.getElementById('resultsBody');
    const searchTerm = normalizeString(document.getElementById('searchInput').value);
    
    tbody.innerHTML = '';

    schools.forEach((school, index) => {
        // Multi-Field Filtering Logic
        const schoolFields = school.fields || [];
        if (!schoolFields.includes(parseInt(activeFieldId))) return; // Hide schools not in this field

        const searchStr = normalizeString(`${school.name} ${school.city} ${school.institution} ${school.institution_short || ''}`);
        if (searchTerm && !searchStr.includes(searchTerm)) return;

        // Dynamic points calculation based on field
        let userPoints = 0;
        if (activeFieldId === "1") {
            const wLang = school.weights.glossa || 0.25;
            const wArx = school.weights.arxaia || 0.25;
            const wIst = school.weights.istoria || 0.25;
            const wLat = school.weights.latinika || 0.25;
            userPoints = Math.round((currentGrades.gradeLang * wLang + currentGrades.gradeArx * wArx + currentGrades.gradeIst * wIst + currentGrades.gradeLat * wLat) * 1000);
        } else if (activeFieldId === "2") {
            const wLang = school.weights.glossa || 0.25;
            const wPhy = school.weights.fysiki || 0.25;
            const wChem = school.weights.ximeia || 0.25;
            const wMath = school.weights.mathimatika || 0.25;
            userPoints = Math.round((currentGrades.gradeLang * wLang + currentGrades.gradePhy * wPhy + currentGrades.gradeChem * wChem + currentGrades.gradeMath * wMath) * 1000);
        } else if (activeFieldId === "3") {
            const wLang = school.weights.glossa || 0.25;
            const wPhy = school.weights.fysiki || 0.25;
            const wChem = school.weights.ximeia || 0.25;
            const wBio = school.weights.viologia || 0.25;
            userPoints = Math.round((currentGrades.gradeLang * wLang + currentGrades.gradePhy * wPhy + currentGrades.gradeChem * wChem + currentGrades.gradeBio * wBio) * 1000);
        } else if (activeFieldId === "4") {
            const wLang = school.weights.glossa || 0.25;
            const wMath = school.weights.mathimatika || 0.25;
            const wPli = school.weights.pliroforiki || 0.25;
            const wOik = school.weights.oikonomia || 0.25;
            userPoints = Math.round((currentGrades.gradeLang * wLang + currentGrades.gradeMath * wMath + currentGrades.gradePli * wPli + currentGrades.gradeOik * wOik) * 1000);
        }
        
        
        // F1: Estimation Intervals
        const est = calculateScoreEstimation(school, natPerfDelta, seatDelta);
        
        // F3: Sigmoid Admission Probability
        const probFloat = calculateAdmissionProbability(userPoints, school, est.base_estimate);
        const probPct = Math.round(probFloat * 100);

        const base2025 = school.history && school.history['2025'] ? school.history['2025'] : 0;
        const deviation = userPoints - base2025;
        const deviationText = base2025 > 0 ? (deviation >= 0 ? `+${deviation}` : deviation) : '-';
        const deviationClass = base2025 > 0 ? (deviation >= 0 ? 'text-success' : 'text-danger') : 'text-muted';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${school.name}</strong></td>
            <td>${school.institution_short || school.institution} - ${school.city}</td>
            <td><strong>${userPoints}</strong></td>
            <td>
                ${Math.round(est.base_estimate)} <br>
                <small class="text-muted">80% CI: [${Math.round(est.lower_bound)} - ${Math.round(est.upper_bound)}]</small>
            </td>
            <td class="${deviationClass}">${deviationText} <br><small class="text-muted">(από 2025)</small></td>
            <td>${getAdvancedPredictionBadge(probPct)}</td>
            <td>
                <button class="btn-sm" onclick="toggleChart(${index}, ${userPoints}, ${est.base_estimate}, ${est.sigma})">Προηγμένη Ανάλυση</button>
                <a href="detailed_prediction.html?school_id=${school.id}&score=${userPoints}&field=${activeFieldId}&grades=${encodeURIComponent(JSON.stringify(currentGrades))}" class="btn-sm" style="display:inline-block; margin-top:4px; text-decoration:none; color:var(--primary); border: 1px solid var(--primary); background: transparent;">Επεξήγηση Πρόβλεψης</a>
            </td>
        `;
        tbody.appendChild(tr);

        const trChart = document.createElement('tr');
        trChart.id = `chart-row-${index}`;
        trChart.className = 'accordion-row';
        trChart.innerHTML = `
            <td colspan="7">
                <div class="analysis-wrapper" style="grid-template-columns: 1fr;">
                    <div class="chart-container" style="max-width: 1000px; height: 400px;">
                        <canvas id="chart-${index}"></canvas>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(trChart);
    });
}

// Toggle Chart Visibility
window.toggleChart = function(index, userPoints, base_estimate, sigma) {
    const row = document.getElementById(`chart-row-${index}`);
    row.classList.toggle('active');

    if (row.classList.contains('active')) {
        renderChart(index, userPoints, base_estimate, sigma);
    }
};

/**
 * Chart.js Visualization
 */
function renderChart(index, userPoints, base_estimate, sigma) {
    const school = schools[index];
    const ctx = document.getElementById(`chart-${index}`).getContext('2d');

    if (activeCharts[index]) {
        activeCharts[index].destroy();
    }

    const years = ['2020', '2021', '2022', '2023', '2024', '2025', '2026 (Pred)'];
    const dataBases = ['2020', '2021', '2022', '2023', '2024', '2025'].map(y => school.history && school.history[y] ? school.history[y] : null);
    
    // Push the predicted base for 2026
    dataBases.push(base_estimate);
    
    const validValues = dataBases.filter(v => v !== null);
    // Determine min/max taking 80% CI bounds into account (1.28 * sigma)
    const ci_offset = 1.28 * sigma;
    const minVal = Math.min(...validValues, userPoints, base_estimate - ci_offset) - 200;
    const maxVal = Math.max(...validValues, userPoints, base_estimate + ci_offset) + 200;

    // Render Floating Bar representation for 80% CI in 2026
    const uncertaintyData = [null, null, null, null, null, null, [base_estimate - ci_offset, base_estimate + ci_offset]];

    activeCharts[index] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Ιστορικές Βάσεις & Πρόβλεψη (Base Estimate)',
                    data: dataBases,
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.3,
                    fill: false,
                    pointRadius: [6,6,6,6,6,6, 8],
                    pointBackgroundColor: ['#4F46E5','#4F46E5','#4F46E5','#4F46E5','#4F46E5','#4F46E5', '#F59E0B'],
                    pointStyle: ['circle','circle','circle','circle','circle','circle', 'triangle'],
                    order: 1
                },
                {
                    label: 'Τα Μόριά Σου (Υποψήφιος)',
                    data: years.map(() => userPoints),
                    borderColor: '#EF4444', 
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    order: 0
                },
                {
                    type: 'bar',
                    label: '80% Διάστημα Εμπιστοσύνης (CI)',
                    data: uncertaintyData,
                    backgroundColor: 'rgba(245, 158, 11, 0.3)', 
                    barPercentage: 0.5,
                    order: 2
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

// Event Listeners (only attach if on a calculator page)
if (activeFieldId) {
    document.getElementById('calcBtn')?.addEventListener('click', calculateAndRender);
    document.getElementById('searchInput')?.addEventListener('input', calculateAndRender);

    // UI Modifiers event listeners
    const natInput = document.getElementById('natPerfDelta');
    if (natInput) natInput.addEventListener('input', calculateAndRender);
    const seatInput = document.getElementById('seatDelta');
    if (seatInput) seatInput.addEventListener('input', calculateAndRender);
}

// Phase 3: F7 - Interactive UI What-If Steppers
function setupInteractiveSteppers() {
    document.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            
            let currentVal = parseFloat(input.value) || 0;
            
            if (e.target.classList.contains('plus')) {
                currentVal += 0.1;
            } else if (e.target.classList.contains('minus')) {
                currentVal -= 0.1;
            }
            
            // Clamp between 0 and 20
            currentVal = Math.max(0, Math.min(20, currentVal));
            
            // Fix floating point precision
            input.value = currentVal.toFixed(1);
            
            // Instantly recalculate simulation
            calculateAndRender();
        });
    });
}

// Initial load
loadData();
