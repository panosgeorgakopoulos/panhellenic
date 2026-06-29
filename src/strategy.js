import { getProfile, getSession, signIn, signUp, signOut, loadProgress } from './auth.js';
import { calculateStrategy, fetchAdvisorSummary } from './ai.js';

let schoolsData = [];
let schoolWeightsData = {};

const fieldConfigs = {
    1: {
        subjects: [
            { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα', value: '16.5' },
            { id: 'gradeArx', label: 'Αρχαία', value: '14.2' },
            { id: 'gradeIst', label: 'Ιστορία', value: '15.8' },
            { id: 'gradeLat', label: 'Λατινικά', value: '17.4' }
        ]
    },
    2: {
        subjects: [
            { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα', value: '15.0' },
            { id: 'gradePhy', label: 'Φυσική', value: '14.5' },
            { id: 'gradeChem', label: 'Χημεία', value: '16.2' },
            { id: 'gradeMath', label: 'Μαθηματικά', value: '15.8' }
        ]
    },
    3: {
        subjects: [
            { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα', value: '15.5' },
            { id: 'gradePhy', label: 'Φυσική', value: '16.0' },
            { id: 'gradeChem', label: 'Χημεία', value: '17.5' },
            { id: 'gradeBio', label: 'Βιολογία', value: '18.2' }
        ]
    },
    4: {
        subjects: [
            { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα', value: '14.5' },
            { id: 'gradeMath', label: 'Μαθηματικά', value: '12.5' },
            { id: 'gradePli', label: 'Πληροφορική', value: '18.8' },
            { id: 'gradeOik', label: 'Οικονομία', value: '19.2' }
        ]
    }
};

function renderGradeInputs(fieldId, savedGrades = null) {
    const config = fieldConfigs[fieldId];
    if (!config) return;

    const grid = document.getElementById('gradesContainer');
    let html = '';
    
    config.subjects.forEach(sub => {
        let val = sub.value;
        if (savedGrades && savedGrades[fieldId] && savedGrades[fieldId][sub.id]) {
            val = savedGrades[fieldId][sub.id];
        }
        
        html += `
        <div>
            <label style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display: block;">${sub.label}</label>
            <input type="number" id="${sub.id}" min="0" max="20" step="0.1" value="${val}" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--border); background: var(--bg-color); color: var(--text-main); font-size: 1rem;">
        </div>
        `;
    });
    
    grid.innerHTML = html;
}

function getCurrentGrades() {
    const fieldId = document.getElementById('stratFieldSelect').value;
    const config = fieldConfigs[fieldId];
    const grades = {};
    config.subjects.forEach(sub => {
        grades[sub.id] = parseFloat(document.getElementById(sub.id)?.value) || 0;
    });
    return grades;
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Field Dropdown
    const fieldSelect = document.getElementById('stratFieldSelect');
    
    // Load existing data if available
    let initialFieldId = "1";
    let savedGrades = null;
    
    try {
        const session = await getSession();
        if (session && session.user) {
            const prog = await loadProgress(session.user.id);
            if (prog) {
                if (prog.activeFieldId) initialFieldId = prog.activeFieldId.toString();
                if (prog.grades) savedGrades = prog.grades;
            }
        } else {
            // Fallback to local storage
            const localData = localStorage.getItem('panhellenic_progress');
            if (localData) {
                const prog = JSON.parse(localData);
                if (prog.activeFieldId) initialFieldId = prog.activeFieldId.toString();
                if (prog.grades) savedGrades = prog.grades;
            }
        }
    } catch(e) {
        console.error("Error loading progress:", e);
    }
    
    fieldSelect.value = initialFieldId;
    renderGradeInputs(initialFieldId, savedGrades);
    
    fieldSelect.addEventListener('change', (e) => {
        renderGradeInputs(e.target.value, savedGrades);
    });

    // 2. Load Data
    try {
        const [schoolsRes, weightsRes] = await Promise.all([
            fetch('/data/processed/schools.json?v=' + new Date().getTime()),
            fetch('/data/processed/weights_data.json')
        ]);
        schoolsData = await schoolsRes.json();
        const weightsData = await weightsRes.json();
        schoolWeightsData = weightsData.special_school_weights || {};
    } catch (e) {
        console.error("Failed to load school data", e);
    }

    // 3. Generate Logic
    const generateBtn = document.getElementById('stratGenerateBtn');
    generateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        generateBtn.disabled = true;
        generateBtn.innerText = "Δημιουργία...";
        
        const activeFieldId = fieldSelect.value;
        const currentGrades = getCurrentGrades();
        const preferences = {
            cities: document.getElementById('stratCities').value,
        };
        const semanticInput = document.getElementById('stratSemanticText').value;

        // Calculate deterministic strategy
        const strategyData = calculateStrategy(activeFieldId, currentGrades, preferences, schoolsData, schoolWeightsData);

        // UI Setup
        const resultsDashboard = document.getElementById('stratResultsDashboard');
        const actionBar = document.getElementById('stratActionBar');
        const aiSummaryContainer = document.getElementById('stratAiSummary');
        
        resultsDashboard.style.display = 'block';
        actionBar.style.display = 'flex';
        
        aiSummaryContainer.innerHTML = '<div style="text-align:center; padding: 2rem;"><div class="spinner" style="border: 4px solid var(--border); border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div><p style="margin-top:1rem; color:var(--text-muted);">Ανάλυση Σημασιολογικών Δεδομένων σε εξέλιξη...</p></div>';

        // Render Cards
        const renderList = (schoolsArray, containerId) => {
            const container = document.getElementById(containerId).querySelector('.schools-list');
            if (!schoolsArray || schoolsArray.length === 0) {
                container.innerHTML = '<p style="padding: 1rem; color: var(--text-muted);">Δεν βρέθηκαν σχολές.</p>';
                return;
            }
            
            let html = '';
            schoolsArray.forEach(s => {
                html += `
                <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; color: var(--text-main); margin-bottom: 0.25rem;">${s.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${s.institution}${s.city ? ' - ' + s.city : ''}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${s.trend || 'Σταθερή ➖'}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: var(--primary);">${s.userPoints}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Βάση: ${s.base}</div>
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        };

        renderList(strategyData.reach, 'stratReachCards');
        renderList(strategyData.target, 'stratTargetCards');
        renderList(strategyData.safety, 'stratSafetyCards');

        // Fetch LLM Summary with semantic search
        const aiSummary = await fetchAdvisorSummary(strategyData, semanticInput);
        aiSummaryContainer.innerHTML = `
            <div style="padding: 1.5rem;">
                <h3 style="margin-top: 0; color: var(--primary); font-size: 1.25rem;">🧠 Ανάλυση AI Συμβούλου</h3>
                <div style="color: var(--text-main); font-size: 1rem; line-height: 1.6; white-space: pre-wrap;">${aiSummary}</div>
            </div>
        `;

        generateBtn.disabled = false;
        generateBtn.innerText = "Δημιουργία Στρατηγικής";
    });

    // 4. Print & PDF Logic
    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
    });

    // 5. Auth Logic
    const loginModalBtn = document.getElementById('loginModalBtn');
    const registerModalBtn = document.getElementById('registerModalBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const closeLogin = document.getElementById('closeLogin');
    const closeRegister = document.getElementById('closeRegister');
    const doLoginBtn = document.getElementById('doLoginBtn');
    const doRegisterBtn = document.getElementById('doRegisterBtn');
    const userDisplay = document.getElementById('userDisplay');
    const saveProgressBtn = document.getElementById('saveProgressBtn');
    const profileModalBtn = document.getElementById('profileModalBtn');
    const adminModalBtn = document.getElementById('adminModalBtn');
    const aiStrategyBtn = document.getElementById('aiStrategyBtn');
    const userDropdown = document.getElementById('userDropdown');
    const userDropdownToggle = document.getElementById('userDropdownToggle');

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

    let currentUser = null;

    function updateNav(user) {
        currentUser = user;
        if (user) {
            loginModalBtn.style.display = 'none';
            registerModalBtn.style.display = 'none';
            if(userDropdown) userDropdown.style.display = 'inline-block';
            if(aiStrategyBtn) aiStrategyBtn.style.display = 'inline-block';
            if(userDisplay) {
                userDisplay.innerText = user.email;
            }
            if (saveProgressBtn) saveProgressBtn.style.display = 'inline-block';
        } else {
            loginModalBtn.style.display = 'inline-block';
            registerModalBtn.style.display = 'inline-block';
            if(logoutBtn) logoutBtn.style.display = 'block'; // Block inside dropdown but we hide dropdown
            if(userDropdown) userDropdown.style.display = 'none';
            if(userDropdown) userDropdown.classList.remove('open');
            if(aiStrategyBtn) aiStrategyBtn.style.display = 'none';
            if(userDisplay) userDisplay.innerText = '';
            if (saveProgressBtn) saveProgressBtn.style.display = 'none';
            if (adminModalBtn) adminModalBtn.style.display = 'none';
        }
    }

    async function initAuth() {
        try {
            const session = await getSession();
            if (session && session.user) {
                updateNav(session.user);
                const prof = await getProfile();
                if (prof && prof.is_admin && adminModalBtn) {
                    adminModalBtn.style.display = 'block'; // Show inside dropdown
                }
                if (prof && prof.full_name && userDisplay) {
                    userDisplay.innerText = prof.full_name;
                }
            }
        } catch (e) {
            console.error('Session error:', e);
        }
    }
    
    initAuth();

    if (loginModalBtn) loginModalBtn.addEventListener('click', () => { if(loginModal) loginModal.style.display = 'block'; });
    if (registerModalBtn) registerModalBtn.addEventListener('click', () => { if(registerModal) registerModal.style.display = 'block'; });
    if (closeLogin) closeLogin.addEventListener('click', () => { if(loginModal) loginModal.style.display = 'none'; });
    if (closeRegister) closeRegister.addEventListener('click', () => { if(registerModal) registerModal.style.display = 'none'; });

    const profileModal = document.getElementById('profileModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profileEmail = document.getElementById('profileEmail');
    const profileName = document.getElementById('profileName');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut();
                updateNav(null);
            } catch (e) {
                console.error("Logout err", e);
            }
        });
    }

    if (doLoginBtn) {
        doLoginBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            if(!email || !pass) return alert("Συμπληρώστε όλα τα πεδία.");
            try {
                const { user, error } = await signIn(email, pass);
                if (error) throw error;
                if(loginModal) loginModal.style.display = 'none';
                initAuth();
                alert('Επιτυχής Σύνδεση!');
            } catch(e) {
                alert(e.message);
            }
        });
    }

    if (doRegisterBtn) {
        doRegisterBtn.addEventListener('click', async () => {
            const email = document.getElementById('regEmail').value;
            const pass = document.getElementById('regPassword').value;
            if(!email || !pass) return alert("Συμπληρώστε όλα τα πεδία.");
            try {
                const { user, error } = await signUp(email, pass);
                if (error) throw error;
                if(registerModal) registerModal.style.display = 'none';
                alert('Επιτυχής Εγγραφή! Ελέγξτε το email σας για επιβεβαίωση.');
            } catch(e) {
                alert(e.message);
            }
        });
    }

    // Import Grades UI Logic
    window.importGradesToUI = async function(fieldId) {
        if (!currentUser) {
            if(loginModal) loginModal.style.display = 'block';
            return;
        }
        const btn = document.getElementById('stratImportGradesBtn');
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
                
                // Trigger calculation to update variables and strategy
                const generateBtn = document.getElementById('stratGenerateBtn');
                if (generateBtn) generateBtn.click();
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

    const stratImportGradesBtn = document.getElementById('stratImportGradesBtn');
    if (stratImportGradesBtn) {
        stratImportGradesBtn.addEventListener('click', () => {
            const currentFieldId = document.getElementById('stratFieldSelect').value;
            window.importGradesToUI(currentFieldId);
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

