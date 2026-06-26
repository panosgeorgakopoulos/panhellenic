const FIELD_KEYS = {
    "1": "\u0391\u039d\u0398\u03a1\u03a9\u03a0\u0399\u03a3\u03a4\u0399\u039a\u03a9\u039d \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d",
    "2": "\u0398\u0395\u03a4\u0399\u039a\u03a9\u039d \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u039a\u0391\u0399 \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u03a5\u0393\u0395\u0399\u0391\u03a3 (\u0395.\u03a0. \u0398\u0395\u03a4\u0399\u039a\u03a9\u039d \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d)",
    "3": "\u0398\u0395\u03a4\u0399\u039a\u03a9\u039d \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u039a\u0391\u0399 \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u03a5\u0393\u0395\u0399\u0391\u03a3 (\u0395.\u03a0. \u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u03a5\u0393\u0395\u0399\u0391\u03a3)",
    "4": "\u03a3\u03a0\u039f\u03a5\u0394\u03a9\u039d \u039f\u0399\u039a\u039f\u039d\u039f\u039c\u0399\u0391\u03a3 \u039a\u0391\u0399 \u03a0\u039b\u0397\u03a1\u039f\u03a6\u039f\u03a1\u0399\u039a\u0397\u03a3"
};

const SUBJECT_LABELS = {
    gradeLang: { label: 'Νεοελληνική Γλώσσα', statKey: '\u039d\u0395\u039f\u0395\u039b\u039b\u0397\u039d\u0399\u039a\u0397 \u0393\u039b\u03a9\u03a3\u03a3\u0391 \u039a\u0391\u0399 \u039b\u039f\u0393\u039f\u03a4\u0395\u03a7\u039d\u0399\u0391 \u0393.\u03a0.' },
    gradeArx: { label: 'Αρχαία Ελληνικά', statKey: '\u0391\u03a1\u03a7\u0391\u0399\u0391 \u0395\u039b\u039b\u0397\u039d\u0399\u039a\u0391 \u039f.\u03a0.' },
    gradeIst: { label: 'Ιστορία', statKey: '\u0399\u03a3\u03a4\u039f\u03a1\u0399\u0391 \u039f.\u03a0.' },
    gradeLat: { label: 'Λατινικά', statKey: '\u039b\u0391\u03a4\u0399\u039d\u0399\u039a\u0391 \u039f.\u03a0.' },
    gradePhy: { label: 'Φυσική', statKey: '\u03a6\u03a5\u03a3\u0399\u039a\u0397 \u039f.\u03a0.' },
    gradeChem: { label: 'Χημεία', statKey: '\u03a7\u0397\u039c\u0395\u0399\u0391 \u039f.\u03a0.' },
    gradeMath: { label: 'Μαθηματικά', statKey: '\u039c\u0391\u0398\u0397\u039c\u0391\u03a4\u0399\u039a\u0391 \u039f.\u03a0.' },
    gradeBio: { label: 'Βιολογία', statKey: '\u0392\u0399\u039f\u039b\u039f\u0393\u0399\u0391 \u039f.\u03a0.' },
    gradePli: { label: 'Πληροφορική', statKey: '\u03a0\u039b\u0397\u03a1\u039f\u03a6\u039f\u03a1\u0399\u039a\u0397 \u039f.\u03a0.' },
    gradeOik: { label: 'Οικονομία', statKey: '\u039f\u0399\u039a\u039f\u039d\u039f\u039c\u0399\u0391 \u039f.\u03a0.' }
};

async function loadDetailedPrediction() {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get('school_id');
    const userScore = parseFloat(params.get('score'));
    const fieldId = params.get('field') || "3";
    let grades = {};
    try {
        grades = JSON.parse(params.get('grades') || "{}");
    } catch (e) {
        // Fallback for old URL format if accessed from history
        grades = {
            gradeLang: parseFloat(params.get('lang')) || 0,
            gradePhy: parseFloat(params.get('phy')) || 0,
            gradeChem: parseFloat(params.get('chem')) || 0,
            gradeBio: parseFloat(params.get('bio')) || 0
        };
    }

    if (!schoolId || isNaN(userScore)) {
        document.getElementById('loadingCard').innerHTML = '<h3 class="text-danger">Σφάλμα: Λείπουν παράμετροι. Παρακαλώ επιστρέψτε στην αρχική σελίδα.</h3>';
        return;
    }

    try {
        const [schoolsRes, normRes] = await Promise.all([
            fetch('schools_data_final.json?v=' + new Date().getTime()),
            fetch('normalization_factors.json')
        ]);
        const schools = await schoolsRes.json();
        const normData = await normRes.json();
        
        console.log('Looking for ID:', schoolId);
        const school = schools.find(s => parseInt(s.id, 10) === parseInt(schoolId, 10));
        console.log('Found:', school);
        
        if (!school) {
            document.getElementById('loadingCard').innerHTML = '<h3 class="text-danger">Σφάλμα: Η σχολή δεν βρέθηκε.</h3>';
            return;
        }

        renderDashboard(school, userScore, fieldId, grades, normData);
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
    return mu_p;
}

function calculateProb(score, target, volatility) {
    const k = 1.702 / Math.max(volatility, 50);
    let p = 1 / (1 + Math.exp(-k * (score - target)));
    return Math.max(0.01, Math.min(0.99, p));
}

function renderDashboard(school, userScore, fieldId, grades, normData) {
    document.getElementById('loadingCard').style.display = 'none';
    document.getElementById('contentWrapper').style.display = 'block';
    
    // Header
    document.getElementById('schoolTitle').innerText = school.name;
    document.getElementById('schoolSubtitle').innerText = `${school.institution || ''} ${school.city ? '- ' + school.city : ''} | Τα Μόριά σου: ${userScore}`;
    
    // 1. Data Extraction
    const baseCutoff = calculateScoreEstimationDetailed(school);
    const trend_score = school.trend_score || 0;
    const volatility_index = school.volatility_index || school.historical_variance || 150;
    
    // 2. Step-by-Step Probability Math
    const p1 = calculateProb(userScore, baseCutoff, 150); // Standard volatility
    const p2 = calculateProb(userScore, baseCutoff + trend_score, 150); // Adjusted for trend
    const p3 = calculateProb(userScore, baseCutoff + trend_score, volatility_index); // Adjusted for actual volatility

    const baseProb = Math.round(p1 * 100);
    const probAfterTrend = Math.round(p2 * 100);
    const finalProb = Math.round(p3 * 100);
    
    // 3. Calculate Deltas
    const trendEffect = probAfterTrend - baseProb;
    const volatilityEffect = finalProb - probAfterTrend;

    // Final Badge
    const badgeEl = document.getElementById('finalProbBadge');
    badgeEl.innerText = `${finalProb}%`;
    if (finalProb > 75) badgeEl.style.color = 'var(--success)';
    else if (finalProb > 35) badgeEl.style.color = 'var(--warning)';
    else badgeEl.style.color = 'var(--danger)';

    // Dynamic Explainability Engine (XAI)
    let xaiHtml = `Αξιολογώντας τα <strong style="color:var(--primary)">${userScore}</strong> μόριά σου απέναντι στην αναμενόμενη βάση των <strong>${Math.round(baseCutoff)}</strong> μορίων (με μια τυπική διακύμανση), προκύπτει μία βασική πιθανότητα της τάξης του <strong>${baseProb}%</strong>.<br><br>`;
    
    if (trend_score !== 0) {
        xaiHtml += `Η συστημική τάση της σχολής (Trend Score: ${Math.round(trend_score)}) επιφέρει `;
        if (trendEffect >= 0) {
            xaiHtml += `ένα θετικό bonus <strong>+${Math.abs(trendEffect)}%</strong>. `;
        } else {
            xaiHtml += `ένα αρνητικό penalty <strong>-${Math.abs(trendEffect)}%</strong>. `;
        }
    }
    
    xaiHtml += `Τέλος, επειδή η σχολή παρουσιάζει ιστορική μεταβλητότητα <strong>±${Math.round(volatility_index)} μορίων</strong>, η πιθανότητα προσαρμόζεται περαιτέρω κατά <strong>${volatilityEffect >= 0 ? '+' : ''}${volatilityEffect}%</strong>, καταλήγοντας στην τελική εκτίμηση του <strong>${finalProb}%</strong>.`;
    
    document.getElementById('xaiText').innerHTML = xaiHtml;

    // Actionable Advice Engine
    let adviceHtml = "";
    if (finalProb > 85) {
        adviceHtml = `<span style="font-size: 2rem;">🛡️</span><br><strong>Σύσταση (Safety):</strong> Η συγκεκριμένη επιλογή θεωρείται εξαιρετικά ασφαλής. Μπορείς να την τοποθετήσεις στο μηχανογραφικό σου ως ισχυρό "μαξιλάρι" σε περίπτωση που δεν περάσεις στις πρώτες σου επιλογές.`;
    } else if (finalProb > 45) {
        adviceHtml = `<span style="font-size: 2rem;">🎯</span><br><strong>Σύσταση (Target):</strong> Πρόκειται για μια ιδιαίτερα ανταγωνιστική, αλλά ρεαλιστική επιλογή. Τα μόριά σου βρίσκονται ακριβώς στο πεδίο μάχης της συγκεκριμένης βάσης. Αξίζει να την δηλώσεις ψηλά.`;
    } else {
        adviceHtml = `<span style="font-size: 2rem;">⚠️</span><br><strong>Σύσταση (Reach):</strong> Πρόκειται για υψηλού ρίσκου επιλογή. Οι πιθανότητές σου είναι περιορισμένες. Βεβαιώσου ότι έχεις δηλώσει ασφαλείς εναλλακτικές αμέσως μετά.`;
    }
    document.getElementById('adviceText').innerHTML = adviceHtml;

    // Risk Gauge Rendering
    const maxRisk = 300; 
    let riskPct = (volatility_index / maxRisk) * 100;
    riskPct = Math.max(0, Math.min(100, riskPct));
    
    const gaugeFill = document.getElementById('riskGaugeFill');
    gaugeFill.style.width = `${riskPct}%`;
    
    if (riskPct < 33) gaugeFill.style.background = 'var(--success)';
    else if (riskPct < 66) gaugeFill.style.background = 'var(--warning)';
    else gaugeFill.style.background = 'var(--danger)';

    document.getElementById('riskText').innerHTML = `Ιστορικό Volatility Index: <strong>${Math.round(volatility_index)}</strong>. ${
        riskPct > 66 ? 'Η βάση έχει απρόβλεπτες μεταπτώσεις (Υψηλό ρίσκο).' : 
        (riskPct > 33 ? 'Η βάση εμφανίζει κανονικές διακυμάνσεις.' : 'Η βάση είναι εξαιρετικά σταθερή (Χαμηλό ρίσκο).')
    }`;

    // Chart.js Waterfall Rendering
    renderWaterfallChart(baseProb, trendEffect, volatilityEffect, finalProb);

    // Render Subject Performance Breakdown
    renderPerformanceBreakdown(grades, fieldId, normData);
}

// 4. & 5. Chart Update & Color Formatting
function renderWaterfallChart(baseProb, trendEffect, volatilityEffect, finalProb) {
    const ctx = document.getElementById('waterfallChartCanvas').getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Βασική Πιθανότητα', 'Επίδραση Τάσης', 'Επίδραση Μεταβλητότητας', 'Τελική Πιθανότητα'],
            datasets: [{
                label: 'Μεταβολή (%)',
                data: [baseProb, trendEffect, volatilityEffect, finalProb],
                backgroundColor: [
                    '#4F46E5', // Primary UI Color
                    trendEffect >= 0 ? '#10b981' : '#ef4444',
                    volatilityEffect >= 0 ? '#10b981' : '#ef4444',
                    finalProb > 50 ? '#10b981' : (finalProb > 20 ? '#F59E0B' : '#ef4444') // Final color logic
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
                            return (val > 0 && context.dataIndex > 0 && context.dataIndex < 3 ? '+' : '') + val + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    // Automatically adjust min/max based on negatives
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

// Subject Performance Breakdown Render
function renderPerformanceBreakdown(grades, fieldId, normData) {
    const container = document.getElementById('perfBreakdown');
    if (!container) return;
    
    const fieldKey = FIELD_KEYS[fieldId];
    const fieldData = normData[fieldKey];
    
    if (!fieldData || Object.values(grades).every(g => g === 0)) {
        container.innerHTML = '<p class="text-muted">Δεν υπάρχουν διαθέσιμα δεδομένα βαθμολογίας για το επιλεγμένο πεδίο.</p>';
        return;
    }

    let html = '';

    for (const [key, grade] of Object.entries(grades)) {
        const sub = SUBJECT_LABELS[key];
        if (!sub) continue;
        
        const stats = fieldData[sub.statKey];
        if (!stats) continue;

        const z = (grade - stats.mean) / stats.std;
        
        let color = '#3B82F6'; // default blue
        if (z >= 1.5) color = 'var(--success)';
        else if (z < -0.5) color = 'var(--danger)';
        else if (z < 0.5) color = 'var(--warning)';

        const avgPct = (stats.mean / 20) * 100;
        const gradePct = (grade / 20) * 100;
        
        html += `
            <div class="perf-row">
                <div class="perf-label">${sub.label}</div>
                <div class="perf-bar-track">
                    <div class="perf-bar-avg" style="left: ${avgPct}%"></div>
                    <div class="perf-bar-fill" style="width: ${gradePct}%; background: ${color};" data-grade="${grade}"></div>
                </div>
                <div class="perf-zscore" style="color: ${color}">
                    ${z >= 0 ? '+' : ''}${z.toFixed(2)}σ
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Boot
document.addEventListener('DOMContentLoaded', loadDetailedPrediction);
