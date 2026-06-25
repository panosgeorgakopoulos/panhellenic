async function loadDetailedPrediction() {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get('school_id');
    const userScore = parseFloat(params.get('score'));
    
    if (!schoolId || isNaN(userScore)) {
        document.getElementById('loadingCard').innerHTML = '<h3 class="text-danger">Σφάλμα: Λείπουν παράμετροι. Παρακαλώ επιστρέψτε στην αρχική σελίδα.</h3>';
        return;
    }

    try {
        const res = await fetch('schools.json');
        const schools = await res.json();
        
        const school = schools.find(s => String(s.id) === String(schoolId));
        if (!school) {
            document.getElementById('loadingCard').innerHTML = '<h3 class="text-danger">Σφάλμα: Η σχολή δεν βρέθηκε.</h3>';
            return;
        }

        renderDashboard(school, userScore);
    } catch (error) {
        console.error(error);
        document.getElementById('loadingCard').innerHTML = '<h3 class="text-danger">Σφάλμα φόρτωσης δεδομένων.</h3>';
    }
}

function calculateScoreEstimationDetailed(school) {
    const years = ['2025', '2024', '2023', '2022'];
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
    
    const volatility = school.volatility_index || school.historical_variance || 150;
    const sigma = Math.max(volatility, 50); 
    
    return { base_estimate: mu_p, sigma };
}

function renderDashboard(school, userScore) {
    document.getElementById('loadingCard').style.display = 'none';
    document.getElementById('contentWrapper').style.display = 'block';
    
    // Header
    document.getElementById('schoolTitle').innerText = school.name;
    document.getElementById('schoolSubtitle').innerText = `${school.institution_short || school.institution} - ${school.city} | Τα Μόριά σου: ${userScore}`;
    
    // Calculations
    const est = calculateScoreEstimationDetailed(school);
    const trend = school.trend_score || 0;
    const volatility = school.volatility_index || school.historical_variance || 150;
    
    const k = 1.702 / Math.max(volatility, 50); 
    
    // Base Probability
    let baseP = 1 / (1 + Math.exp(-k * (userScore - est.base_estimate)));
    baseP = Math.max(0.01, Math.min(0.99, baseP));
    
    // Final Probability (With trend)
    const finalX0 = est.base_estimate + trend;
    let finalP = 1 / (1 + Math.exp(-k * (userScore - finalX0)));
    finalP = Math.max(0.01, Math.min(0.99, finalP));
    
    const basePct = Math.round(baseP * 100);
    const finalPct = Math.round(finalP * 100);
    const trendDiff = finalPct - basePct;
    
    // Final Badge
    const badgeEl = document.getElementById('finalProbBadge');
    badgeEl.innerText = `${finalPct}%`;
    if (finalPct > 75) badgeEl.style.color = 'var(--success)';
    else if (finalPct > 35) badgeEl.style.color = 'var(--warning)';
    else badgeEl.style.color = 'var(--danger)';

    // Dynamic XAI Engine
    let xaiHtml = `Αξιολογώντας τα <strong style="color:var(--primary)">${userScore}</strong> μόριά σου απέναντι στην αναμενόμενη βάση των <strong>${Math.round(est.base_estimate)}</strong> μορίων, προκύπτει μία βασική στατιστική πιθανότητα εισαγωγής της τάξης του <strong>${basePct}%</strong>.<br><br>`;
    
    if (trend !== 0) {
        xaiHtml += `Ωστόσο, λαμβάνοντας υπόψη τη συστημική τάση της σχολής (Trend Score: ${Math.round(trend)}), ο αλγόριθμος εφαρμόζει `;
        if (trendDiff >= 0) {
            xaiHtml += `ένα θετικό bonus <strong>+${Math.abs(trendDiff)}%</strong>, καθώς παρατηρείται πτωτική πίεση στις βάσεις τα τελευταία χρόνια. `;
        } else {
            xaiHtml += `ένα αρνητικό penalty <strong>-${Math.abs(trendDiff)}%</strong>, καθώς υπάρχει σαφής αυξητική πίεση και υψηλότερος ανταγωνισμός για αυτή τη σχολή. `;
        }
    }
    
    xaiHtml += `Επιπρόσθετα, η σχολή παρουσιάζει μεταβλητότητα <strong>±${Math.round(est.sigma)} μορίων</strong>, η οποία διαμορφώνει το εύρος ρίσκου και καταλήγει στην τελική εκτίμηση του <strong>${finalPct}%</strong>.`;
    
    document.getElementById('xaiText').innerHTML = xaiHtml;

    // Actionable Advice Engine
    let adviceHtml = "";
    if (finalPct > 85) {
        adviceHtml = `<span style="font-size: 2rem;">🛡️</span><br><strong>Σύσταση Ασφαλείας (Safety):</strong> Η συγκεκριμένη επιλογή θεωρείται εξαιρετικά ασφαλής. Μπορείς να την τοποθετήσεις στο μηχανογραφικό σου ως ισχυρό "μαξιλάρι" σε περίπτωση που δεν περάσεις στις πρώτες σου επιλογές.`;
    } else if (finalPct > 45) {
        adviceHtml = `<span style="font-size: 2rem;">🎯</span><br><strong>Σύσταση Στόχου (Target):</strong> Πρόκειται για μια ιδιαίτερα ανταγωνιστική, αλλά ρεαλιστική επιλογή. Τα μόριά σου βρίσκονται ακριβώς στο πεδίο μάχης της συγκεκριμένης βάσης. Αξίζει να την δηλώσεις ψηλά.`;
    } else {
        adviceHtml = `<span style="font-size: 2rem;">⚠️</span><br><strong>Σύσταση Ρίσκου (Reach):</strong> Πρόκειται για υψηλού ρίσκου επιλογή. Οι πιθανότητές σου είναι περιορισμένες βάσει ιστορικών δεδομένων. Μπορείς να την δηλώσεις, αλλά είναι ζωτικής σημασίας να επιλέξεις σίγουρα και πιο ασφαλείς εναλλακτικές αμέσως μετά.`;
    }
    document.getElementById('adviceText').innerHTML = adviceHtml;

    // Risk Gauge Rendering
    const maxRisk = 300; // arbitrary high volatility cap for UI
    let riskPct = (volatility / maxRisk) * 100;
    riskPct = Math.max(0, Math.min(100, riskPct));
    
    const gaugeFill = document.getElementById('riskGaugeFill');
    gaugeFill.style.width = `${riskPct}%`;
    
    if (riskPct < 33) gaugeFill.style.background = 'var(--success)';
    else if (riskPct < 66) gaugeFill.style.background = 'var(--warning)';
    else gaugeFill.style.background = 'var(--danger)';

    document.getElementById('riskText').innerHTML = `Ιστορικό Volatility Index: <strong>${Math.round(volatility)}</strong>. ${
        riskPct > 66 ? 'Η βάση έχει απρόβλεπτες μεταπτώσεις (Υψηλό ρίσκο).' : 
        (riskPct > 33 ? 'Η βάση εμφανίζει κανονικές διακυμάνσεις.' : 'Η βάση είναι εξαιρετικά σταθερή (Χαμηλό ρίσκο).')
    }`;

    // Chart.js Waterfall Rendering
    renderWaterfallChart(basePct, finalPct, trendDiff);
}

function renderWaterfallChart(basePct, finalPct, trendDiff) {
    const ctx = document.getElementById('waterfallChartCanvas').getContext('2d');
    
    // To fake a waterfall in Chart.js with floating bars:
    // dataset data expects [min, max] arrays.
    
    let trendBarData;
    let trendColor;
    
    if (trendDiff >= 0) {
        trendBarData = [basePct, finalPct];
        trendColor = '#10B981'; // success
    } else {
        trendBarData = [finalPct, basePct];
        trendColor = '#EF4444'; // danger
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Βασική Πιθανότητα', 'Επίδραση Τάσης (Trend)', 'Τελική Πιθανότητα'],
            datasets: [{
                label: 'Ποσοστό (%)',
                data: [
                    [0, basePct],
                    trendBarData,
                    [0, finalPct]
                ],
                backgroundColor: [
                    '#4F46E5', // Primary
                    trendColor,
                    finalPct > 50 ? '#10B981' : (finalPct > 20 ? '#F59E0B' : '#EF4444')
                ],
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let val = context.raw;
                            if (Array.isArray(val)) {
                                return `Διαφορά: ${Math.round(val[1] - val[0])}%`;
                            }
                            return `Πιθανότητα: ${val}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) { return value + "%" }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Boot
document.addEventListener('DOMContentLoaded', loadDetailedPrediction);
