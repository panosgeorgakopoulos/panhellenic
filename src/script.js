import './styles.css';
import { signUp, signIn, signOut, getSession, saveProgress, loadProgress, getProfile, updateProfile, getGlobalStats } from './auth.js';
import { calculateStrategy, fetchAdvisorSummary } from './ai.js';
import { supabase } from './supabaseClient.js';

// Service Worker Registration
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Unregister in development to prevent caching issues with Vite HMR
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length > 0) {
        Promise.all(registrations.map(r => r.unregister())).then(() => {
          window.location.reload();
        });
      }
    });
  } else {
    // Register only in production
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(err => {
        console.log('SW registration failed: ', err);
      });
    });
  }
}
window.isPremium = false;

let schools = [];
let statsData = {};
let activeCharts = {};
let normalizationData = {};
let schoolWeightsData = {};

// Field configurations
const fieldConfigs = {
    '1': {
        title: '1ο Πεδίο',
        subtitle: 'Ανθρωπιστικών, Νομικών & Κοινωνικών Σπουδών',
        docTitle: 'Πανελλήνιες 2026 - 1ο Πεδίο (Ανθρωπιστικών Σπουδών)',
        subjects: [
            { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα', value: '18.5' },
            { id: 'gradeArx', label: 'Αρχαία Ελληνικά', value: '17.0' },
            { id: 'gradeIst', label: 'Ιστορία', value: '18.0' },
            { id: 'gradeLat', label: 'Λατινικά', value: '19.0' }
        ]
    },
    '2': {
        title: '2ο Πεδίο',
        subtitle: 'Θετικών & Τεχνολογικών Επιστημών',
        docTitle: 'Πανελλήνιες 2026 - 2ο Πεδίο (Θετικών Σπουδών)',
        subjects: [
            { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα', value: '18.5' },
            { id: 'gradePhy', label: 'Φυσική', value: '19.0' },
            { id: 'gradeChem', label: 'Χημεία', value: '18.8' },
            { id: 'gradeMath', label: 'Μαθηματικά', value: '17.5' }
        ]
    },
    '3': {
        title: '3ο Πεδίο',
        subtitle: 'Επιστημών Υγείας & Ζωής',
        docTitle: 'Πανελλήνιες 2026 - 3ο Πεδίο (Σπουδών Υγείας)',
        subjects: [
            { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα', value: '18.5' },
            { id: 'gradePhy', label: 'Φυσική', value: '19.0' },
            { id: 'gradeChem', label: 'Χημεία', value: '18.8' },
            { id: 'gradeBio', label: 'Βιολογία', value: '19.2' }
        ]
    },
    '4': {
        title: '4ο Πεδίο',
        subtitle: 'Επιστημών Οικονομίας & Πληροφορικής',
        docTitle: 'Πανελλήνιες 2026 - 4ο Πεδίο (Οικονομίας & Πληροφορικής)',
        subjects: [
            { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα', value: '18.5' },
            { id: 'gradeMath', label: 'Μαθηματικά', value: '16.5' },
            { id: 'gradePli', label: 'Πληροφορική', value: '18.8' },
            { id: 'gradeOik', label: 'Οικονομία', value: '19.2' }
        ]
    }
};

function injectFieldLayout(fieldId) {
    const config = fieldConfigs[fieldId];
    if (!config) return;

    document.title = config.docTitle;
    
    const titleEl = document.getElementById('fieldTitle');
    if (titleEl) titleEl.textContent = config.title;

    const subtitleEl = document.getElementById('fieldSubtitle');
    if (subtitleEl) subtitleEl.textContent = config.subtitle;

    const gridEl = document.getElementById('subjectsGrid');
    if (gridEl) {
        let html = '';
        config.subjects.forEach(sub => {
            const zBadgeId = 'zBadge' + sub.id.replace('grade', '');
            html += `
            <div class="input-group">
                <label for="${sub.id}">${sub.label}</label>
                <div class="stepper-wrapper">
                    <button class="stepper-btn minus" data-target="${sub.id}">-</button>
                    <input type="number" id="${sub.id}" min="0" max="20" step="0.1" value="${sub.value}">
                    <button class="stepper-btn plus" data-target="${sub.id}">+</button>
                </div>
                <span class="zscore-badge" id="${zBadgeId}"></span>
            </div>
            `;
        });
        gridEl.innerHTML = html;
    }
}

let activeFieldId = document.body.getAttribute('data-field');

const urlParams = new URLSearchParams(window.location.search);
const fieldParam = urlParams.get('id') || urlParams.get('field');

if (window.location.pathname.endsWith('field.html')) {
    if (['1', '2', '3', '4'].includes(fieldParam)) {
        injectFieldLayout(fieldParam);
        document.body.setAttribute('data-field', fieldParam);
        activeFieldId = fieldParam;
    } else {
        window.location.href = 'index.html';
    }
} else if (fieldParam) {
    activeFieldId = fieldParam;
}


// Load data from external JSON files
async function loadData() {
    try {
        const [schoolsRes, statsRes, normRes, weightsRes] = await Promise.all([
            fetch('./data/processed/schools.json?v=' + new Date().getTime()),
            fetch('./data/processed/stats_data.json'),
            fetch('./data/processed/normalization_factors.json'),
            fetch('./data/processed/weights_data.json')
        ]);
        schools = await schoolsRes.json();
        statsData = await statsRes.json();
        normalizationData = await normRes.json();
        const weightsData = await weightsRes.json();
        schoolWeightsData = weightsData.special_school_weights || {};
        
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
    let badgeHtml = '';
    let barColor = '';
    if (probPct > 85) {
        badgeHtml = `<span class="badge bg-success">High Certainty (Safety) - ${probPct}%</span>`;
        barColor = 'var(--success)';
    } else if (probPct >= 50) {
        badgeHtml = `<span class="badge" style="background-color: #D9F99D; color: #3F6212;">Competitive (Target) - ${probPct}%</span>`;
        barColor = '#84CC16';
    } else if (probPct >= 15) {
        badgeHtml = `<span class="badge" style="background-color: #FED7AA; color: #9A3412;">Marginal (Reach) - ${probPct}%</span>`;
        barColor = '#F97316';
    } else {
        badgeHtml = `<span class="badge bg-danger">Low Probability (High Risk) - ${probPct}%</span>`;
        barColor = 'var(--danger)';
    }
    
    let barHtml = `
    <div class="prob-bar-track">
        <div class="prob-bar-fill" style="width: ${probPct}%; background: ${barColor};"></div>
    </div>`;
    
    return badgeHtml + barHtml;
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

    // Track Calculation in GA4
    if (typeof gtag === 'function') {
        gtag('event', 'calculate_score', { activeFieldId: activeFieldId });
    }

    const tbody = document.getElementById('resultsBody');
    const searchTerm = normalizeString(document.getElementById('searchInput').value);
    
    tbody.innerHTML = '';

    schools.forEach((school, index) => {
        // Multi-Field Filtering Logic
        const schoolFields = school.fields || [];
        if (!schoolFields.includes(parseInt(activeFieldId))) return; // Hide schools not in this field

        const searchStr = normalizeString(`${school.name || ''} ${school.city || ''} ${school.institution || ''} ${school.institution_short || ''}`);
        if (searchTerm && !searchStr.includes(searchTerm)) return;

        // Dynamic points calculation based on field
        const safeSchoolId = parseInt(school.id, 10).toString();
        const customWeights = (schoolWeightsData[safeSchoolId] && schoolWeightsData[safeSchoolId][activeFieldId]) || {};
        let userPoints = 0;
        if (activeFieldId === "1") {
            const wLang = customWeights.glossa || 0.25;
            const wArx = customWeights.arxaia || 0.25;
            const wIst = customWeights.istoria || 0.25;
            const wLat = customWeights.latinika || 0.25;
            userPoints = Math.round((currentGrades.gradeLang * wLang + currentGrades.gradeArx * wArx + currentGrades.gradeIst * wIst + currentGrades.gradeLat * wLat) * 1000);
        } else if (activeFieldId === "2") {
            const wLang = customWeights.glossa || 0.25;
            const wPhy = customWeights.fysiki || 0.25;
            const wChem = customWeights.ximeia || 0.25;
            const wMath = customWeights.mathimatika || 0.25;
            userPoints = Math.round((currentGrades.gradeLang * wLang + currentGrades.gradePhy * wPhy + currentGrades.gradeChem * wChem + currentGrades.gradeMath * wMath) * 1000);
        } else if (activeFieldId === "3") {
            const wLang = customWeights.glossa || 0.25;
            const wPhy = customWeights.fysiki || 0.25;
            const wChem = customWeights.ximeia || 0.25;
            const wBio = customWeights.viologia || 0.25;
            userPoints = Math.round((currentGrades.gradeLang * wLang + currentGrades.gradePhy * wPhy + currentGrades.gradeChem * wChem + currentGrades.gradeBio * wBio) * 1000);
        } else if (activeFieldId === "4") {
            const wLang = customWeights.glossa || 0.25;
            const wMath = customWeights.mathimatika || 0.25;
            const wPli = customWeights.pliroforiki || 0.25;
            const wOik = customWeights.oikonomia || 0.25;
            userPoints = Math.round((currentGrades.gradeLang * wLang + currentGrades.gradeMath * wMath + currentGrades.gradePli * wPli + currentGrades.gradeOik * wOik) * 1000);
        }
        
        
        // F1: Estimation Intervals
        const est = calculateScoreEstimation(school, natPerfDelta, seatDelta);
        
        // F3: Sigmoid Admission Probability
        const probFloat = calculateAdmissionProbability(userPoints, school, est.base_estimate);
        const probPct = Math.round(probFloat * 100);

        let actualBase = school.base_score || 0;
        let recentYear = '2025';
        if (school.history) {
            if (school.history['2025']) { actualBase = school.history['2025']; recentYear = '2025'; }
            else if (school.history['2024']) { actualBase = school.history['2024']; recentYear = '2024'; }
            else if (school.history['2023']) { actualBase = school.history['2023']; recentYear = '2023'; }
        }

        const deviation = userPoints - actualBase;
        const deviationText = actualBase > 0 ? (deviation >= 0 ? `+${deviation}` : deviation) : '-';
        const deviationClass = actualBase > 0 ? (deviation >= 0 ? 'text-success' : 'text-danger') : 'text-muted';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Σχολή"><strong>${school.name}</strong></td>
            <td data-label="Ίδρυμα & Πόλη">${school.institution_short || school.institution || ''} ${school.city ? '- ' + school.city : ''}</td>
            <td data-label="Τα Μόρια σου"><strong>${userPoints}</strong></td>
            <td data-label="Βάση 2025">
                ${actualBase > 0 ? actualBase : '-'} <br>
                <small class="text-muted">(έτος ${recentYear})</small>
            </td>
            <td data-label="Απόκλιση" class="${deviationClass}">${deviationText} <br><small class="text-muted">(από βάση ${recentYear})</small></td>
            <td data-label="Πρόβλεψη (%)" style="text-align: center; vertical-align: middle;">${getAdvancedPredictionBadge(probPct)}</td>
            <td data-label="Ενέργεια">
                <button class="btn-sm" onclick="toggleChart(${index}, ${userPoints}, ${est.base_estimate}, ${est.sigma})">Προηγμένη Ανάλυση</button>
                <a href="#" data-href="detailed_prediction.html?school_id=${school.id}&score=${userPoints}&field=${activeFieldId}&grades=${encodeURIComponent(JSON.stringify(currentGrades))}" class="btn-sm xai-btn" style="display:inline-block; margin-top:4px; text-decoration:none; color:var(--primary); border: 1px solid var(--primary); background: transparent; text-align: center;">Επεξήγηση Πρόβλεψης</a>
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
        const school = schools[index];
        if (typeof gtag === 'function' && school) {
            gtag('event', 'view_detailed_analysis', { school_id: school.id });
        }
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

const userDropdownToggle = document.getElementById('userDropdownToggle');
const userDropdown = document.getElementById('userDropdown');
if (userDropdownToggle && userDropdown && !userDropdownToggle.dataset.listenerAttached) {
    userDropdownToggle.dataset.listenerAttached = 'true';
    userDropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target)) {
            userDropdown.classList.remove('open');
        }
    });
}

// Google Analytics - Theme Toggle Tracking
document.addEventListener('DOMContentLoaded', () => {


    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            // Wait for inline script to update the data-theme attribute
            setTimeout(() => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                if (typeof gtag === 'function') {
                    gtag('event', 'toggle_theme', { theme: currentTheme });
                }
            }, 50);
        });
    }
});

// Auth and State Management
let currentUser = null;
let currentScenarios = {}; // For caching loaded scenarios
let isRegisterMode = false;

document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    const loginModalBtn = document.getElementById('loginModalBtn');
    const registerModalBtn = document.getElementById('registerModalBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const saveProgressBtn = document.getElementById('saveProgressBtn');
    const profileModalBtn = document.getElementById('profileModalBtn');
    const adminModalBtn = document.getElementById('adminModalBtn');
    const aiStrategyBtn = document.getElementById('aiStrategyBtn');
    const userDropdown = document.getElementById('userDropdown');
    const userDropdownToggle = document.getElementById('userDropdownToggle');
    const userDisplay = document.getElementById('userDisplay');
    
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authTitle = document.getElementById('authModalTitle');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const togglePassword = document.getElementById('togglePassword');
    const authError = document.getElementById('authError');

    // Profile Modal UI
    const profileModal = document.getElementById('profileModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profileSaveBtn = document.getElementById('profileSaveBtn');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePremiumBadge = document.getElementById('profilePremiumBadge');

    // Admin Modal UI
    const adminModal = document.getElementById('adminModal');
    const closeAdminModal = document.getElementById('closeAdminModal');
    const adminTotalUsers = document.getElementById('adminTotalUsers');
    const adminRefreshBtn = document.getElementById('adminRefreshBtn');

    // AI Strategy Button is now a standard link. No modal logic needed here.

    // Init Auth State
    try {
        const session = await getSession();
        if (session && session.user) {
            handleLoginSuccess(session.user);
        }
    } catch (e) {
        console.error('Session error:', e);
    }

    if(loginModalBtn) loginModalBtn.addEventListener('click', () => {
        isRegisterMode = false;
        if(authTitle) authTitle.innerText = 'Σύνδεση';
        if(authSubmitBtn) authSubmitBtn.innerText = 'Σύνδεση';
        if(toggleAuthMode) toggleAuthMode.innerText = 'Δεν έχετε λογαριασμό; Εγγραφή';
        if(authError) authError.style.display = 'none';
        if(authModal) authModal.style.display = 'block';
    });

    if(registerModalBtn) registerModalBtn.addEventListener('click', () => {
        isRegisterMode = true;
        if(authTitle) authTitle.innerText = 'Εγγραφή';
        if(authSubmitBtn) authSubmitBtn.innerText = 'Εγγραφή';
        if(toggleAuthMode) toggleAuthMode.innerText = 'Έχετε λογαριασμό; Σύνδεση';
        if(authError) authError.style.display = 'none';
        if(authModal) authModal.style.display = 'block';
    });
    
    if(closeAuthModal) closeAuthModal.addEventListener('click', () => {
        if(authModal) authModal.style.display = 'none';
        if(authError) authError.style.display = 'none';
    });

    if(toggleAuthMode) toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        isRegisterMode = !isRegisterMode;
        if(authTitle) authTitle.innerText = isRegisterMode ? 'Εγγραφή' : 'Σύνδεση';
        if(authSubmitBtn) authSubmitBtn.innerText = isRegisterMode ? 'Εγγραφή' : 'Σύνδεση';
        if(toggleAuthMode) toggleAuthMode.innerText = isRegisterMode ? 'Έχετε λογαριασμό; Σύνδεση' : 'Δεν έχετε λογαριασμό; Εγγραφή';
        if(authError) authError.style.display = 'none';
    });

    if(authSubmitBtn) authSubmitBtn.addEventListener('click', async () => {
        const email = authEmail?.value.trim();
        const password = authPassword?.value;
        if (!email || !password) {
            if(authError) {
                authError.innerText = 'Παρακαλώ συμπληρώστε όλα τα πεδία.';
                authError.style.display = 'block';
            }
            return;
        }

        try {
            if(authError) authError.style.display = 'none';
            authSubmitBtn.disabled = true;
            const originalText = authSubmitBtn.innerText;
            authSubmitBtn.innerText = 'Φόρτωση...';
            
            let user;
            if (isRegisterMode) {
                const data = await signUp(email, password);
                user = data.user;
                if (!user && data.session) user = data.session.user;
                if (!user) {
                    if(authError) {
                        authError.innerText = 'Ελέγξτε το email σας για επιβεβαίωση (αν απαιτείται) ή δοκιμάστε ξανά.';
                        authError.style.display = 'block';
                    }
                    authSubmitBtn.disabled = false;
                    authSubmitBtn.innerText = originalText;
                    return;
                }
            } else {
                const data = await signIn(email, password);
                user = data.user;
            }
            
            if(user) {
                if(authModal) authModal.style.display = 'none';
                handleLoginSuccess(user);
            }
            
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = originalText;
        } catch (error) {
            if(authError) {
                authError.innerText = error.message;
                authError.style.display = 'block';
            }
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = isRegisterMode ? 'Εγγραφή' : 'Σύνδεση';
        }
    });

    if(logoutBtn) logoutBtn.addEventListener('click', async () => {
        try {
            await signOut();
            currentUser = null;
            currentScenarios = {};
            if(loginModalBtn) loginModalBtn.style.display = 'inline-block';
            if(registerModalBtn) registerModalBtn.style.display = 'inline-block';
            if(logoutBtn) logoutBtn.style.display = 'block'; // Reset to block inside dropdown
            if(saveProgressBtn) saveProgressBtn.style.display = 'none';
            if(aiStrategyBtn) aiStrategyBtn.style.display = 'none';
            if(userDropdown) userDropdown.style.display = 'none';
            if(userDropdown) userDropdown.classList.remove('open');
        } catch (error) {
            console.error('Logout error', error);
        }
    });

    if(saveProgressBtn) saveProgressBtn.addEventListener('click', async () => {
        if (!currentUser) {
            if (authModal) authModal.style.display = 'block';
            return;
        }
        // activeFieldId is a global variable from script.js
        if (!currentUser || typeof activeFieldId === 'undefined' || !activeFieldId) {
            alert('Μπορείτε να αποθηκεύσετε την πρόοδό σας μόνο από τη σελίδα κάποιου Πεδίου.');
            return;
        }

        // Construct current scenario state
        const gradeMap = getActiveGradeMap();
        const currentGrades = {};
        for (const inputId in gradeMap) {
            currentGrades[inputId] = parseFloat(document.getElementById(inputId)?.value) || 0;
        }
        const natPerfInput = parseFloat(document.getElementById('natPerfDelta')?.value) || 0;
        const seatDeltaInput = parseFloat(document.getElementById('seatDelta')?.value) || 0;

        currentScenarios[activeFieldId] = {
            grades: currentGrades,
            natPerfDelta: natPerfInput,
            seatDelta: seatDeltaInput
        };

        const originalText = saveProgressBtn.innerText;
        saveProgressBtn.innerText = 'Αποθήκευση...';
        saveProgressBtn.disabled = true;

        try {
            await saveProgress(currentUser.id, currentScenarios);
            saveProgressBtn.innerText = '✅ Αποθηκεύτηκε!';
            setTimeout(() => {
                saveProgressBtn.innerText = originalText;
                saveProgressBtn.disabled = false;
            }, 2000);
        } catch(err) {
            console.error('Save error', err);
            saveProgressBtn.innerText = '❌ Σφάλμα';
            setTimeout(() => {
                saveProgressBtn.innerText = originalText;
                saveProgressBtn.disabled = false;
            }, 2000);
        }
    });

    async function handleLoginSuccess(user) {
        currentUser = user;
        
        try {
            const profile = await getProfile(user.id);
            if (profile) {
                window.isAdmin = !!profile.is_admin;
                window.userFullName = profile.full_name || '';
            }
        } catch (e) {
            console.error('Error fetching profile', e);
        }

        if(loginModalBtn) loginModalBtn.style.display = 'none';
        if(registerModalBtn) registerModalBtn.style.display = 'none';
        if(userDropdown) userDropdown.style.display = 'inline-block';
        if(aiStrategyBtn) aiStrategyBtn.style.display = 'inline-block';
        
        if(adminModalBtn) {
            adminModalBtn.style.display = window.isAdmin ? 'block' : 'none';
        }

        // Only show save button if we are on a field page
        if(typeof activeFieldId !== 'undefined' && activeFieldId && saveProgressBtn) {
            saveProgressBtn.style.display = 'inline-block';
        }
        if(userDisplay) {
            userDisplay.innerText = window.userFullName || user.email;
        }
        
        try {
            const saved = await loadProgress(user.id);
            if (saved) {
                currentScenarios = saved;
                if (typeof activeFieldId !== 'undefined' && activeFieldId && currentScenarios[activeFieldId]) {
                    // Populate DOM
                    const state = currentScenarios[activeFieldId];
                    if (state.grades) {
                        for (const inputId in state.grades) {
                            const el = document.getElementById(inputId);
                            if (el) el.value = state.grades[inputId];
                        }
                    }
                    if (state.natPerfDelta !== undefined) {
                        const el = document.getElementById('natPerfDelta');
                        if (el) el.value = state.natPerfDelta;
                    }
                    if (state.seatDelta !== undefined) {
                        const el = document.getElementById('seatDelta');
                        if (el) el.value = state.seatDelta;
                    }
                    // Re-calculate
                    if (typeof calculateAndRender === 'function') {
                        calculateAndRender();
                    }
                }
            }
        } catch(err) {
            console.error('Error loading progress:', err);
        }
    }

    // Global event listener for XAI buttons
    document.addEventListener('click', (e) => {
        const xaiBtn = e.target.closest('.xai-btn');
        if (xaiBtn) {
            e.preventDefault();
            if (!currentUser) {
                if (authModal) authModal.style.display = 'block';
            } else {
                window.location.href = xaiBtn.getAttribute('data-href');
            }
        }
    });

    // View Password logic
    if (togglePassword && authPassword) {
        togglePassword.addEventListener('click', () => {
            const type = authPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            authPassword.setAttribute('type', type);
        });
    }

    // Admin logic
    async function loadAdminStats() {
        if(!window.isAdmin) return;
        try {
            const stats = await getGlobalStats();
            if(adminTotalUsers) adminTotalUsers.innerText = stats.total_users;
        } catch(err) {
            console.error('Error fetching admin stats', err);
        }
    }

    if(adminModalBtn) adminModalBtn.addEventListener('click', () => {
        if(adminModal) adminModal.style.display = 'block';
        loadAdminStats();
    });

    if(closeAdminModal) closeAdminModal.addEventListener('click', () => {
        if(adminModal) adminModal.style.display = 'none';
    });

    if(adminRefreshBtn) adminRefreshBtn.addEventListener('click', () => {
        if(adminTotalUsers) adminTotalUsers.innerText = '...';
        loadAdminStats();
    });

    // AI Strategy logic
    if (aiStrategyBtn) {
        aiStrategyBtn.addEventListener('click', () => {
            if(aiStrategyModal) aiStrategyModal.style.display = 'block';
        });
    }
    // Import Grades UI Logic
    window.importGradesToUI = async function(fieldId) {
        if (!currentUser) {
            if(loginModal) loginModal.style.display = 'block';
            return;
        }
        const btn = document.getElementById('importGradesBtn') || document.getElementById('stratImportGradesBtn');
        try {
            if (btn) btn.innerText = "Φόρτωση...";
            const prog = await loadProgress(currentUser.id);
            if (prog && prog[fieldId] && prog[fieldId].grades) {
                const grades = prog[fieldId].grades;
                for (let subId in grades) {
                    const input = document.getElementById(subId);
                    if (input) input.value = grades[subId];
                }
                if (btn) btn.innerText = "✅ Φορτώθηκαν!";
                setTimeout(() => { if (btn) btn.innerText = "📥 Φόρτωση Αποθηκευμένων Βαθμών"; }, 2000);
                
                const calcBtn = document.getElementById('calcBtn');
                if (calcBtn) calcBtn.click();
            } else {
                alert('Δεν βρέθηκαν αποθηκευμένοι βαθμοί για αυτό το πεδίο.');
                if (btn) btn.innerText = "📥 Φόρτωση Αποθηκευμένων Βαθμών";
            }
        } catch(err) {
            console.error(err);
            alert('Σφάλμα κατά τη φόρτωση.');
            if (btn) btn.innerText = "📥 Φόρτωση Αποθηκευμένων Βαθμών";
        }
    };

    const importGradesBtn = document.getElementById('importGradesBtn');
    if (importGradesBtn) {
        importGradesBtn.addEventListener('click', () => {
            window.importGradesToUI(activeFieldId);
        });
    }

});

// Add spin keyframes if not exists
if (!document.getElementById('spinner-style')) {
    const style = document.createElement('style');
    style.id = 'spinner-style';
    style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
}

// =========================================
// BACK TO TOP BUTTON WITH SCROLL PROGRESS
// =========================================
function initBackToTop() {
    const backToTop = document.getElementById('backToTop');
    const progressCircle = document.querySelector('.progress-ring-circle');
    
    if (backToTop && progressCircle) {
        const radius = progressCircle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;

        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = circumference;

        window.addEventListener('scroll', () => {
            // Calculate scroll percentage
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight;
            const winHeight = window.innerHeight;
            const scrollPercent = scrollTop / (docHeight - winHeight);
            
            // Map percentage to offset
            const offset = circumference - (scrollPercent * circumference);
            progressCircle.style.strokeDashoffset = offset;

            // Fade in/out
            if (scrollTop > 200) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        });

        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}
document.addEventListener('DOMContentLoaded', initBackToTop);
// In case DOMContentLoaded already fired (module script delay)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initBackToTop();
}
