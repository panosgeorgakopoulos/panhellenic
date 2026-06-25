# Panhellenic Exams Data Analysis & Visualization

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)

A collection of tools for fetching, processing, and visualizing Greek **Panhellenic Examinations** (Πανελλήνιες) results. This repository provides datasets and scripts to explore admission statistics, score distributions, and trends across fields of study and universities in Greece.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Fetching data](#fetching-data)
  - [Analysis examples](#analysis-examples)
  - [Visualization](#visualization)
- [Data Sources](#data-sources)
- [Repository Structure](#repository-structure)
- [Contributing](#contributing)
- [License](#license)

## Features
- Scrape or load official Panhellenic exam results (candidates, scores, admitted students).
- Clean, structured datasets per year, scientific field, and department.
- Statistical summaries: highest/lowest admission scores, base scores, number of admitted per school.
- Interactive and static visualizations (score distribution histograms, heatmaps of demand, time series).
- Jupyter notebooks with ready-to-run exploratory analyses.
- Modular Python package that can be reused for custom reports.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/panosgeorgakopoulos/panhellenic.git
   cd panhellenic
   ```

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Fetching data
The package can automatically download the latest published statistics from official sources (e.g., [minedu.gov.gr](https://www.minedu.gov.gr/)).

```python
from panhellenic import fetch_results

# Fetch results for a given year and scientific field
df = fetch_results(year=2023, field="humanities")
df.head()
```

Alternatively, pre-fetched CSV files are available in the `data/` directory.

### Analysis examples
Open the provided Jupyter notebooks to explore common questions:

- **What were the minimum/maximum admission scores per department?**
- **How has the demand for Computer Science schools changed over the last 5 years?**
- **Which cities have the highest concentration of high-performing candidates?**

```bash
jupyter notebook notebooks/exploratory_analysis.ipynb
```

### Visualization
Generate static or interactive charts using the built-in plotting utilities:

```python
from panhellenic.visualization import plot_score_distribution

plot_score_distribution(year=2022, field="science", interactive=True)
```

Example output:
![score distribution](images/score_distribution_example.png)

## Data Sources
Data is collected from the official announcements of the Greek Ministry of Education and Religious Affairs. Refer to the [data/README.md](data/README.md) for a detailed description of each file and the scraping methodology.

## Repository Structure
```
panhellenic/
├── data/                # Raw and processed datasets (CSV)
├── images/              # Visualization examples
├── notebooks/           # Jupyter notebooks for analysis
├── panhellenic/         # Main Python package
│   ├── __init__.py
│   ├── fetch.py
│   ├── process.py
│   └── visualize.py
├── requirements.txt
├── setup.py
└── README.md
```

## Contributing
Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

For major changes, please open an issue first to discuss what you would like to change.

## License
This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---

*Maintained by [Panos Georgakopoulos](https://github.com/panosgeorgakopoulos).*
