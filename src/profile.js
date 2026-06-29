import { getSession, getProfile, updateProfile, saveProgress, signOut } from './auth.js';

let currentUser = null;
let currentProfileData = null;

const fieldConfigs = {
    '1': { title: '1ο Πεδίο', subjects: [ { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα'}, { id: 'gradeArx', label: 'Αρχαία Ελληνικά'}, { id: 'gradeIst', label: 'Ιστορία'}, { id: 'gradeLat', label: 'Λατινικά'} ] },
    '2': { title: '2ο Πεδίο', subjects: [ { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα'}, { id: 'gradePhy', label: 'Φυσική'}, { id: 'gradeChem', label: 'Χημεία'}, { id: 'gradeMath', label: 'Μαθηματικά'} ] },
    '3': { title: '3ο Πεδίο', subjects: [ { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα'}, { id: 'gradePhy', label: 'Φυσική'}, { id: 'gradeChem', label: 'Χημεία'}, { id: 'gradeBio', label: 'Βιολογία'} ] },
    '4': { title: '4ο Πεδίο', subjects: [ { id: 'gradeLang', label: 'Νεοελληνική Γλώσσα'}, { id: 'gradeMath', label: 'Μαθηματικά'}, { id: 'gradePli', label: 'Πληροφορική'}, { id: 'gradeOik', label: 'Οικονομία'} ] }
};

document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    setupAuthModals();
    
    document.getElementById('profileSaveBtn').addEventListener('click', async (e) => {
        const btn = e.target;
        const newName = document.getElementById('profileName').value.trim();
        btn.disabled = true;
        btn.innerText = 'Αποθήκευση...';
        try {
            await updateProfile(currentUser.id, newName);
            btn.innerText = 'Επιτυχία!';
            document.getElementById('userDisplay').innerText = newName || currentUser.email;
            setTimeout(() => {
                btn.innerText = 'Αποθήκευση Αλλαγών Προφίλ';
                btn.disabled = false;
            }, 2000);
        } catch(err) {
            console.error(err);
            btn.innerText = 'Σφάλμα';
            setTimeout(() => {
                btn.innerText = 'Αποθήκευση Αλλαγών Προφίλ';
                btn.disabled = false;
            }, 2000);
        }
    });
});

async function initAuth() {
    try {
        const session = await getSession();
        currentUser = session ? session.user : null;
        
        if (currentUser) {
            updateNav(currentUser);
            const profileData = await getProfile(currentUser.id);
            currentProfileData = profileData;
            document.getElementById('profileEmail').value = currentUser.email || '';
            document.getElementById('profileName').value = profileData.full_name || '';
            if (profileData.full_name) {
                document.getElementById('userDisplay').innerText = profileData.full_name;
            } else {
                document.getElementById('userDisplay').innerText = currentUser.email;
            }
            renderSavedGrades(profileData.saved_scenarios || {});
        } else {
            // Not logged in, redirect to home
            window.location.href = 'index.html';
        }
    } catch (err) {
        console.error("Auth error", err);
    }
}

function updateNav(user) {
    const userDisplay = document.getElementById('userDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginBtn = document.getElementById('loginModalBtn');
    const registerBtn = document.getElementById('registerModalBtn');
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

    if (user) {
        if(userDisplay) userDisplay.innerText = user.email;
        if(loginBtn) loginBtn.style.display = 'none';
        if(registerBtn) registerBtn.style.display = 'none';
        if(userDropdown) userDropdown.style.display = 'inline-block';
        if(aiStrategyBtn) aiStrategyBtn.style.display = 'inline-block';
    } else {
        if(loginBtn) loginBtn.style.display = 'inline-block';
        if(registerBtn) registerBtn.style.display = 'inline-block';
        if(logoutBtn) logoutBtn.style.display = 'block'; // Block inside dropdown
        if(userDropdown) userDropdown.style.display = 'none';
        if(userDropdown) userDropdown.classList.remove('open');
        if(aiStrategyBtn) aiStrategyBtn.style.display = 'none';
    }
}

function renderSavedGrades(scenarios) {
    const container = document.getElementById('savedGradesContainer');
    if (!scenarios || typeof scenarios !== 'object' || Object.keys(scenarios).length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding: 2rem; border: 1px dashed var(--border); border-radius: 8px;">Δεν υπάρχουν αποθηκευμένες βαθμολογίες. Πηγαίνετε σε κάποιο Πεδίο για να αποθηκεύσετε.</p>';
        return;
    }
    
    let html = '';
    for (let i = 1; i <= 4; i++) {
        const fieldData = scenarios[i];
        const fieldGrades = fieldData ? fieldData.grades : null;
        if (fieldGrades && Object.keys(fieldGrades).length > 0) {
            html += `<div class="card" style="margin-bottom:1.5rem; padding: 1.5rem; border-radius: 12px; background-color: var(--surface); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
                    <h4 style="color:var(--text-main); margin:0;">${fieldConfigs[i].title}</h4>
                    <button class="delete-grades-btn btn-sm btn-outline-danger" data-field="${i}" style="padding: 0.25rem 0.5rem; font-size: 0.85rem; border-color: var(--danger); color: var(--danger);">🗑️ Διαγραφή</button>
                </div>
                <ul style="list-style:none; padding:0; margin:0; font-size:0.95rem;">`;
            
            const conf = fieldConfigs[i];
            conf.subjects.forEach(sub => {
                if (fieldGrades[sub.id] !== undefined) {
                    html += `<li style="display:flex; justify-content:space-between; padding:0.4rem 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                        <span style="color:var(--text-muted);">${sub.label}</span> 
                        <span style="font-weight:700; color:var(--primary);">${fieldGrades[sub.id]}</span>
                    </li>`;
                }
            });
            html += `</ul></div>`;
        }
    }
    
    if (html === '') {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding: 2rem; border: 1px dashed var(--border); border-radius: 8px;">Δεν υπάρχουν αποθηκευμένες βαθμολογίες.</p>';
    } else {
        container.innerHTML = html;
        
        // Add delete event listeners
        document.querySelectorAll('.delete-grades-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const fieldId = e.target.getAttribute('data-field');
                if (confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε τις βαθμολογίες για το ${fieldId}ο Πεδίο;`)) {
                    await deleteSavedGrade(fieldId);
                }
            });
        });
    }
}

async function deleteSavedGrade(fieldId) {
    if (!currentUser || !currentProfileData) return;
    
    let scenarios = currentProfileData.saved_scenarios || {};
    if (scenarios[fieldId]) {
        delete scenarios[fieldId];
        
        try {
            await saveProgress(currentUser.id, scenarios);
            currentProfileData.saved_scenarios = scenarios;
            renderSavedGrades(scenarios);
            alert('Οι βαθμολογίες διαγράφηκαν επιτυχώς.');
        } catch (err) {
            console.error('Error deleting grades:', err);
            alert('Υπήρξε σφάλμα κατά τη διαγραφή.');
        }
    }
}

function setupAuthModals() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut();
            alert('Αποσυνδεθήκατε επιτυχώς.');
            window.location.href = 'index.html';
        });
    }
}
