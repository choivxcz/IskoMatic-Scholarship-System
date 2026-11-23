# IskoMatic: AI-Assisted Scholarship Applicant Screening and Management System

## Overview

IskoMatic is a desktop information system designed for the Local Youth Development Office (LYDO) of Santa Cruz, Laguna. It supports the office in registering scholarship applicants, screening their applications, and recording interviews and final decisions. A machine learning model assists the screening process by estimating the likelihood that an application meets the program's criteria.

This repository contains the desktop edition. Its interface is built with React and TypeScript and runs in a native window through Tauri (or in a browser); a local Python service connects it to the MySQL database and the machine learning model. The original PyQt6 interface is kept for reference in `legacy/pyqt/`. A web edition built on the same code base, with a FastAPI back end and a React interface, is maintained in [IskoMatic](https://github.com/choivxcz/IskoMatic).

## Objectives

1. To provide a single, validated process for registering applicants and their applications.
2. To assist reviewers with a consistent, data-driven screening recommendation.
3. To keep a complete record of reviews, interviews, and decisions, including those of past applicants.

## Features

1. Registration. Each applicant and application, including examination scores and household information, is entered through a single guided form with input validation.
2. Rules first, then AI. Each application is first checked against the office's eligibility rules: entrance exam score of 80% or higher, academic average above 75, not a 4Ps or SPES beneficiary, and no other scholar in the family. Applicants who fail a rule are not scored and are flagged for staff to confirm. For applicants who pass every rule, a Random Forest classifier estimates the chance of qualifying from 9 need and merit factors (academic average, income, household make-up, dependents, solo parent, MSWDO poverty line). All results are advisory: the system does not award or reject a scholarship on its own, and final decisions remain with the office.
3. Priority ranking. Eligible applicants are ranked by their chance of qualifying within the same scholarship program and year, so staff can review them in order against the available slots. Results from an older model, or from application details that changed after screening, are marked "Re-screen needed" instead of being ranked.
4. Change detection and selective re-screening. Each screening result stores a fingerprint of its inputs and the model version. When an application's details change after screening, or the model is retrained, its result is marked "Re-screen needed" so staff never rank applicants on outdated data. A batch run skips applications whose result is already current and screens only the changed or new ones; running screening on a single application always produces a new result. Earlier results are kept as history.
5. Review workflow. Reviewers may endorse, waitlist, or reject an application, after which interviews and official decisions are recorded. The order of steps is enforced by the system: an application cannot be approved before its interview, a decision needs written remarks, and once a decision is recorded the application's details are locked.
6. Staff accounts and accountability. Staff sign in with individual accounts (passwords are stored as salted PBKDF2 hashes, and sign-in pauses after 5 wrong attempts). New accounts must be approved by an Administrator, and only LYDO Officials and Administrators can record official decisions. Every change is written to the Activity Log under the staff member who made it before the change is applied.
7. Archiving. Records are archived rather than deleted, so past applicants and their outcomes remain searchable.

## Technologies Used

- Python 3.12
- React, TypeScript and Vite (user interface), Tauri (native desktop window)
- PyQt6 (original user interface, kept in `legacy/`)
- MySQL (database)
- scikit-learn, pandas, and joblib (machine learning)

## Installation and Usage

Python 3.12 or later, Node.js, and a MySQL server are required. Rust is optional: with it, the app opens in a native window; without it, it opens in your web browser.

```bash
pip install -r requirements.txt
```

1. Create the database and its tables.

   ```bash
   mysql -u root -p < database/schema.sql
   ```

2. Copy `.env.example` to `.env` and set `DB_USER` and `DB_PASSWORD`.

3. Start the application.

   ```bash
   python run.py
   ```

   The first account registered becomes the Administrator. The retired PyQt6 interface can still be started with `python legacy/pyqt/main.py`.

A trained model is included in `ml/models/`. To retrain it from `ml/data/isko.csv`:

```bash
python ml/train_ml_model.py
```

`isko.csv` is synthetic and was produced by a seeded generator script, `generate_dataset.py` (not currently included in this repository). A student is labeled qualified only when they pass every eligibility rule and their weighted rubric score, plus random reviewer variation, reaches the cutoff that qualifies about half of eligible students. The MSWDO poverty flag is calculated with the same formula the app uses. To evaluate the saved model (confusion matrix, accuracy, precision, recall, specificity, F1, ROC-AUC, 5-fold cross-validation and feature importance) on the held-out test rows:

```bash
python ml/evaluate_ml_model.py       # add --quick to skip cross-validation, --open to open the report
```

The report is written to `ml/reports/model_evaluation/evaluation_report.html` (charts and `metrics.json` are saved alongside it). Staff can also open it inside the app from **AI Screening → Model report card**.

The model is trained and evaluated only on applicants who pass every eligibility rule, since those are the only applicants it scores. The evaluation report also shows how many qualified applicants appear among the top-ranked 10%, 25% and 50%.

Each application and applicant profile in the desktop UI shows the model's chance of qualifying and why: how much each input (academic average, income, household size, etc.) raised or lowered that chance. The breakdown comes from the Random Forest's own decision paths (`backend/services/ml_explainer.py`) and adds up exactly to the predicted percentage. AI results are advisory only.

## Testing

```bash
pip install pytest
```

The rules, screening and ranking tests do not use the database and are safe to run at any time:

```bash
python -m pytest tests/test_decision_service.py tests/test_ml_screening_service.py tests/test_screening_rules_and_ranking.py
```

The other tests connect to the MySQL database configured in `.env` and **create and change records in it**. Run them only against a test copy of the database (set `DB_NAME` in `.env`), never against live data.

## Repository Structure

The system follows a layered architecture: the frontend talks only to the local API, the API calls services, services hold the business rules and call repositories, and only repositories touch the database.

```
IskoMatic/
├── backend/                  Python back end (package: backend)
│   ├── api/                  Local HTTP API on 127.0.0.1:8765 (bridge_server.py),
│   │                         staff sign-in (auth_store.py) and Activity Log (activity_store.py)
│   ├── services/             Business rules: applications, decisions, ML screening,
│   │                         explanations, ranking, CSV export
│   ├── repositories/         Data access layer (one repository per table)
│   └── database/             MySQL connection (settings read from .env)
├── frontend/                 React + TypeScript + Vite interface, Tauri desktop shell (src-tauri/)
├── ml/                       Machine learning
│   ├── data/isko.csv         Synthetic training data
│   ├── models/               Saved Random Forest model (versioned)
│   ├── reports/              Evaluation report output (generated, not committed)
│   ├── train_ml_model.py     Trains and saves the model
│   └── evaluate_ml_model.py  Writes the evaluation report ("report card")
├── database/                 schema.sql and the ERD (ERD.mwb)
├── tests/                    Unit and integration tests (pytest)
├── docs/                     SRS, final documentation, diagrams, presentation, brochure, launch video
├── legacy/pyqt/              Retired PyQt6 interface, kept for reference
├── run.py                    One-command launcher (backend + frontend)
├── requirements.txt          Python dependencies
└── .env.example              Database settings template (copy to .env)
```

## Data Privacy

This repository contains no real applicant data. The training set `ml/data/isko.csv` is synthetic. Local database backups (`backups/`) and `.env` files are excluded from version control so that personal information and credentials are not committed.

## Author

Karl Sebastian V. Cuerdo
