# Panhellenic Probabilistic Decision Platform 🎓📊

An advanced, data-driven decision-support system for the Greek Panhellenic Exams. 

This platform moves beyond simple deterministic "point calculators" by introducing **probabilistic modeling, historical volatility analysis, and Explainable AI (XAI)** to help students evaluate their university admission chances with statistical confidence.

![App Preview](https://img.shields.io/badge/Status-Active-success)
![Tech Stack](https://img.shields.io/badge/Tech_Stack-Vanilla_JS_|_Python_|_HTML_|_CSS-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🌟 Key Features

* **Probabilistic Admission Engine**: Uses a Sigmoid/Logistic function to calculate admission probability (0-100%) rather than a binary Pass/Fail, factoring in historical score distributions.
* **Explainable AI (XAI) Dashboard**: A dedicated analysis page (`detailed_prediction.html`) that breaks down the probability calculation using natural language summaries and a Waterfall Chart (via Chart.js).
* **Volatility & Trend Analysis**: Calculates the historical standard deviation (Volatility Index) and weighted multi-year trends of university base cutoffs to adjust risk margins.
* **Statistical Normalization (Z-Scores)**: Contextualizes user grades against national multi-year statistics (Mean $\mu$, Standard Deviation $\sigma$), providing real-time performance badges (e.g., *"Top 15% (+1.2σ)"*).
* **Dynamic Subject Weights**: Accurately calculates points per school by dynamically fetching specific subject coefficients (weights) mapped to individual university departments.
* **Modern UI/UX**:
    * Multi-page architecture mapped to the 4 Scientific Fields.
    * Full **Dark Mode** support with `localStorage` memory.
    * Mobile-first responsive design (table-to-card transformations).
    * Accessible, touch-friendly interfaces.

---

## 🏗️ Architecture & Tech Stack

The application uses a **decoupled architecture**, ensuring lightning-fast client-side performance while keeping data processing heavily automated on the backend.

### Frontend (Client-Side)
* **HTML5 / CSS3**: CSS Variables for theming, CSS Grid/Flexbox for responsive layouts.
* **Vanilla JavaScript (ES6+)**: Handles dynamic DOM manipulation, URL routing, JSON fetching, and algorithmic probability calculations without heavy frameworks.
* **Chart.js**: Powers the visual analytics and risk gauges.

### Data Pipeline (Python Backend)
The static JSON files consumed by the frontend are generated via robust Python scripts that scrape, parse, and mathematically process raw government data.
* **Python 3.x** (`pandas`, `BeautifulSoup`, `statistics`)
* Automated extraction of weights from legacy PHP files to structured JSON.
* Multi-sheet Excel parsing for historical bases and grade frequencies.

---

## 📂 Project Structure

```text
📦 panhellenic-decision-platform
 ┣ 📂 older_βάσεις/             # Raw historical cutoff data (Excel/CSV)
 ┣ 📂 stats/                    # Raw national grade distributions
 ┣ 📂 weights/                  # Legacy PHP files containing subject coefficients
 ┃
 ┣ 📜 build_complete_schools_db.py # Parses cutoffs & fields -> schools_data_final.json
 ┣ 📜 build_normalization.py       # Computes μ, σ -> normalization_factors.json
 ┣ 📜 extract_weights_to_json.py   # Extracts coefficients -> weights_data.json
 ┃
 ┣ 📜 index.html                # Welcome / Landing Screen
 ┣ 📜 field_1.html (to 4)       # Field-Specific Calculators
 ┣ 📜 detailed_prediction.html  # XAI Analytics Dashboard
 ┃
 ┣ 📜 script.js                 # Core frontend logic & data fetching
 ┣ 📜 detailed_prediction.js    # Chart rendering & Natural Language Generation
 ┣ 📜 styles.css                # Global styles & Dark Mode system
 ┃
 ┣ 📜 schools_data_final.json   # Generated Database: Schools, History, Trends
 ┣ 📜 normalization_factors.json# Generated Database: Subject Statistics
 ┣ 📜 weights_data.json         # Generated Database: School Coefficients
 ┗ 📜 .nojekyll                 # Bypasses GitHub Pages build errors

---

## 🚀 Deployment (GitHub Pages)

This project is configured to automatically deploy to GitHub Pages using Vite and GitHub Actions.

> [!IMPORTANT]
> **Administrator Setup Required**: Before the GitHub Actions workflow can successfully build the project, you must add the following environment variables to your GitHub Repository Secrets (`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`):
> 
> *   `VITE_SUPABASE_URL`
> *   `VITE_SUPABASE_ANON_KEY`
> *   `VITE_GROQ_API_KEY`
> 
> Failing to set these secrets will cause the build step to fail or the deployed site to lose authentication and AI features.
