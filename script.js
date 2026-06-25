let schools = [];
let statsData = {};
let activeCharts = {};

// Load data from external JSON files
async function loadData() {
    try {
        const [schoolsRes, statsRes] = await Promise.all([
            fetch('schools.json'),
            fetch('stats_data.json') // Kept for compatibility if needed elsewhere
        ]);
        schools = await schoolsRes.json();
        statsData = await statsRes.json();
        calculateAndRender();
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

/**
 * Data Science Step 1: Multivariate Cutoff Modeling (WMA + Macro Adjustments)
 * Predicts the upcoming year's base by utilizing a Weighted Moving Average (WMA)
 * on historical bases and dynamically adjusting for systemic macro shocks.
 */
function predictBaseDistribution(school, natPerfDelta, seatDelta) {
    const years = ['2025', '2024', '2023', '2022'];
    // WMA Weights: Exponentially more weight to recent years
    const weights = [0.40, 0.30, 0.20, 0.10]; 
    
    let sumW = 0;
    let mu_p = 0;
    
    // Step 1A: Calculate expected historical mean (μ_p)
    for (let i = 0; i < years.length; i++) {
        const y = years[i];
        if (school.history && school.history[y]) {
            mu_p += school.history[y] * weights[i];
            sumW += weights[i];
        }
    }
    
    // Normalize in case of missing historical data
    mu_p = sumW > 0 ? (mu_p / sumW) : 10000;
    
    // Step 1B: Apply Systemic Modifiers
    // - natPerfDelta: % shift in high-scorers (e.g. harder exams = negative delta)
    // - seatDelta: % shift in available seats (more seats = lower cutoff)
    const mu_adjusted = mu_p * (1 + natPerfDelta) * (1 - seatDelta);
    
    // Step 1C: Calculate Expected Volatility (σ_p)
    const hist_var = school.historical_variance || 150;
    // Floor the variance to prevent division by zero for artificially stable cutoffs
    const sigma_p = Math.max(hist_var, 50); 
    
    return { mu_adjusted, sigma_p };
}

/**
 * Data Science Step 2: Advanced Admission Probability Estimation (CDF)
 * Converts a candidate's points into an exact probability using a Normal Distribution assumption.
 */
function calculateAdmissionProbability(userPoints, expectedBase, sigma) {
    // Step 2A: Calculate Z-score
    // Determines how many standard deviations the user's score is from the predicted cutoff
    const z = (userPoints - expectedBase) / sigma;
    
    // Step 2B: Apply Cumulative Distribution Function (CDF)
    // We use the precise logistic sigmoid approximation of the Normal CDF
    let P = 1 / (1 + Math.exp(-1.702 * z));
    
    // Clamp strictly between 1% and 99% logic bounds
    P = Math.max(0.01, Math.min(0.99, P));
    
    return P;
}

/**
 * Data Science Step 3: Risk Classification UI
 */
function getAdvancedPredictionBadge(probPct) {
    if (probPct > 85) return `<span class="badge bg-success">High Certainty (Safety) - ${probPct}%</span>`;
    if (probPct >= 50) return `<span class="badge" style="background-color: #D9F99D; color: #3F6212;">Competitive (Target) - ${probPct}%</span>`;
    if (probPct >= 15) return `<span class="badge" style="background-color: #FED7AA; color: #9A3412;">Marginal (Reach) - ${probPct}%</span>`;
    return `<span class="badge bg-danger">Low Probability (High Risk) - ${probPct}%</span>`;
}

function normalizeString(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function calculateAndRender() {
    const gLang = parseFloat(document.getElementById('gradeLang').value) || 0;
    const gPhy = parseFloat(document.getElementById('gradePhy').value) || 0;
    const gChem = parseFloat(document.getElementById('gradeChem').value) || 0;
    const gBio = parseFloat(document.getElementById('gradeBio').value) || 0;

    // Fetch UI Modifiers (Parse as Decimals, e.g. -3% -> -0.03)
    const natPerfInput = parseFloat(document.getElementById('natPerfDelta')?.value) || 0;
    const seatDeltaInput = parseFloat(document.getElementById('seatDelta')?.value) || 0;
    const natPerfDelta = natPerfInput / 100;
    const seatDelta = seatDeltaInput / 100;

    const avg = (gLang + gPhy + gChem + gBio) / 4;
    document.getElementById('avgDisplay').innerText = `Μέσος Όρος: ${avg.toFixed(2)}`;

    const tbody = document.getElementById('resultsBody');
    const searchTerm = normalizeString(document.getElementById('searchInput').value);
    
    tbody.innerHTML = '';

    schools.forEach((school, index) => {
        const searchStr = normalizeString(`${school.name} ${school.city} ${school.institution} ${school.institution_short || ''}`);
        if (searchTerm && !searchStr.includes(searchTerm)) return;

        const wLang = school.weights.glossa || 0.25;
        const wPhy = school.weights.fysiki || 0.25;
        const wChem = school.weights.ximeia || 0.25;
        const wBio = school.weights.viologia || 0.25;

        // Candidate Points
        const userPoints = Math.round((gLang * wLang + gPhy * wPhy + gChem * wChem + gBio * wBio) * 1000);
        
        // Execute Advanced Data Science Pipeline
        const { mu_adjusted, sigma_p } = predictBaseDistribution(school, natPerfDelta, seatDelta);
        const probFloat = calculateAdmissionProbability(userPoints, mu_adjusted, sigma_p);
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
            <td>${Math.round(mu_adjusted)} <br><small class="text-muted">(Πρόβλεψη 2026)</small></td>
            <td class="${deviationClass}">${deviationText} <br><small class="text-muted">(από 2025)</small></td>
            <td>${getAdvancedPredictionBadge(probPct)}</td>
            <td>
                <button class="btn-sm" onclick="toggleChart(${index}, ${userPoints}, ${mu_adjusted}, ${sigma_p})">Προηγμένη Ανάλυση</button>
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
window.toggleChart = function(index, userPoints, mu_adjusted, sigma_p) {
    const row = document.getElementById(`chart-row-${index}`);
    row.classList.toggle('active');

    if (row.classList.contains('active')) {
        renderChart(index, userPoints, mu_adjusted, sigma_p);
    }
};

/**
 * Data Science Step 4: Advanced Chart.js Visualization
 */
function renderChart(index, userPoints, mu_adjusted, sigma_p) {
    const school = schools[index];
    const ctx = document.getElementById(`chart-${index}`).getContext('2d');

    if (activeCharts[index]) {
        activeCharts[index].destroy();
    }

    const years = ['2020', '2021', '2022', '2023', '2024', '2025', '2026 (Pred)'];
    const dataBases = ['2020', '2021', '2022', '2023', '2024', '2025'].map(y => school.history && school.history[y] ? school.history[y] : null);
    
    // Push the predicted base for 2026
    dataBases.push(mu_adjusted);
    
    const validValues = dataBases.filter(v => v !== null);
    const minVal = Math.min(...validValues, userPoints, mu_adjusted - sigma_p) - 200;
    const maxVal = Math.max(...validValues, userPoints, mu_adjusted + sigma_p) + 200;

    // Render Floating Bar representation for σ_p uncertainty in 2026
    // Arrays in data [min, max]
    const uncertaintyData = [null, null, null, null, null, null, [mu_adjusted - sigma_p, mu_adjusted + sigma_p]];

    activeCharts[index] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Ιστορικές Βάσεις & Πρόβλεψη (μ_adjusted)',
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
                    borderColor: '#EF4444', // Red Dashed
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    order: 0
                },
                {
                    type: 'bar',
                    label: '±1σ Στατιστική Αβεβαιότητα',
                    data: uncertaintyData,
                    backgroundColor: 'rgba(245, 158, 11, 0.3)', // Orange shaded
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

// Event Listeners
document.getElementById('calcBtn').addEventListener('click', calculateAndRender);
document.getElementById('searchInput').addEventListener('input', calculateAndRender);

// UI Modifiers event listeners
const natInput = document.getElementById('natPerfDelta');
if (natInput) natInput.addEventListener('input', calculateAndRender);
const seatInput = document.getElementById('seatDelta');
if (seatInput) seatInput.addEventListener('input', calculateAndRender);

// Initial load
loadData();
