// src/ai.js

/**
 * Calculates user points based on grades, active field, and school-specific weights.
 */
function calculateUserPointsForSchool(activeFieldId, currentGrades, school, schoolWeightsData) {
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
    
    return userPoints;
}

/**
 * Normalizes strings to match search criteria.
 */
function normalizeString(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Deterministic Algorithm to categorize top schools.
 */
export function calculateStrategy(activeFieldId, currentGrades, preferences, schoolsData, schoolWeightsData) {
    const reach = [];
    const target = [];
    const safety = [];

    const prefCities = preferences.cities ? normalizeString(preferences.cities).split(',').map(c => c.trim()) : [];
    const prefFields = preferences.fields ? normalizeString(preferences.fields).split(',').map(c => c.trim()) : [];

    schoolsData.forEach(school => {
        // Filter by Field
        const schoolFields = school.fields || [];
        if (!schoolFields.includes(parseInt(activeFieldId))) return;

        // Filter by City
        if (prefCities.length > 0 && prefCities[0] !== "") {
            const schoolCity = normalizeString(school.city || '');
            const schoolName = normalizeString(school.name || '');
            // If schoolCity is empty, city info is often inside the name like "(ΑΘΗΝΑ)"
            if (!prefCities.some(city => schoolCity.includes(city) || schoolName.includes(city) || (schoolCity && city.includes(schoolCity)))) {
                return;
            }
        }
        
        // Soft filter by field/profession name if provided
        if (prefFields.length > 0 && prefFields[0] !== "") {
            const schoolName = normalizeString(school.name);
            const schoolInst = normalizeString(school.institution);
            if (!prefFields.some(field => schoolName.includes(field) || schoolInst.includes(field))) {
                return;
            }
        }

        const userPoints = calculateUserPointsForSchool(activeFieldId, currentGrades, school, schoolWeightsData);
        let schoolBase = school.base_score || 0;
        let trend = 'Σταθερή ➖';

        if (school.history) {
            if (school.history['2025']) { schoolBase = school.history['2025']; }
            else if (school.history['2024']) { schoolBase = school.history['2024']; }
            else if (school.history['2023']) { schoolBase = school.history['2023']; }

            if (school.history['2025'] && school.history['2024']) {
                if (school.history['2025'] > school.history['2024']) trend = 'Ανοδική Τάση 📈';
                else if (school.history['2025'] < school.history['2024']) trend = 'Καθοδική Τάση 📉';
            }
        }

        // Threshold Logic
        const diff = schoolBase - userPoints;
        const absDiff = Math.abs(diff);

        // Include the points in the object so we can sort and pass to LLM
        const schoolItem = {
            id: school.id,
            name: school.name,
            institution: school.institution_short || school.institution,
            city: school.city || '',
            base: schoolBase,
            userPoints: userPoints,
            trend: trend
        };

        if (schoolBase > userPoints && diff <= 500) {
            reach.push(schoolItem);
        } else if (absDiff <= 250) {
            target.push(schoolItem);
        } else if (userPoints >= (schoolBase + 500)) {
            safety.push(schoolItem);
        }
    });

    // Sort descending by base and limit to 5
    reach.sort((a, b) => b.base - a.base);
    target.sort((a, b) => b.base - a.base);
    safety.sort((a, b) => b.base - a.base);

    return {
        reach: reach.slice(0, 5),
        target: target.slice(0, 5),
        safety: safety.slice(0, 5)
    };
}

/**
 * LLM Integration fetching a motivational summary from Groq.
 */
export async function fetchAdvisorSummary(strategyData, semanticInput = '') {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    console.log('Groq API Key Check:', apiKey ? apiKey.substring(0, 4) : 'undefined');
    if (!apiKey || apiKey === 'YOUR_GROQ_KEY_HERE') {
        return "⚠️ Παρακαλώ προσθέστε το API Key της Groq στο αρχείο .env (VITE_GROQ_API_KEY) για να δείτε την AI σύνοψη.";
    }

    const systemPrompt = `You are an expert Greek career counselor helping high school students with their "Μηχανογραφικό" (university application strategy).
You will receive JSON data containing three categories of university departments: Reach (Όνειρο), Target (Εφικτές), and Safety (Ασφαλείς).
The user has also provided an abstract description of what they are looking for. You MUST analyze this abstract text and explicitly connect it to the specific departments provided in the strategy data. Explain why certain schools match their semantic description (e.g., if they mention entrepreneurship, explain how a specific matched school links to it).
Write a 3-paragraph motivational summary based exactly on this data. Do not hallucinate new schools or data.
Keep the tone encouraging, realistic, and strictly in the Greek language. Do not include bullet points or lists of the schools, just write a fluent summary of the overall strategy and options.`;

    const userPrompt = `Student's Semantic Description: "${semanticInput}"\n\nStudent's Strategy Data:\n${JSON.stringify(strategyData, null, 2)}`;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 600,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Failed to fetch from Groq API');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Groq API Error:', error);
        return "Παρουσιάστηκε σφάλμα κατά την επικοινωνία με τον AI Σύμβουλο. Παρακαλώ δοκιμάστε ξανά αργότερα.";
    }
}
