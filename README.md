# IskoMatic: AI-Assisted Scholarship Applicant Screening and Management System

## Overview

IskoMatic is a desktop information system designed for the Local Youth Development Office (LYDO) of Santa Cruz, Laguna. It supports the office in registering scholarship applicants, screening their applications, and recording interviews and final decisions. A machine learning model assists the screening process by estimating the likelihood that an application meets the program's criteria.

This repository contains the desktop edition. Its interface is built with React and TypeScript and runs in a native window through Tauri (or in a browser); a local Python service connects it to the MySQL database and the machine learning model. The original PyQt6 interface is still included and can be started with `python main.py`. A web edition built on the same code base, with a FastAPI back end and a React interface, is maintained in [IskoMatic](https://github.com/choivxcz/IskoMatic).

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
- PyQt6 (original user interface, still available)
- MySQL (database)
- scikit-learn, pandas, and joblib (machine learning)

## Installation and Usage

Python 3.12 or later, Node.js, and a MySQL server are required. Rust is optional: with it, the app opens in a native window; without it, it opens in your web browser.

```bash
pip install -r requirements.txt
```

1. Create the database and its tables.

   ```bash
   mysql -u root -p < schema.sql
   ```

2. Copy `.env.example` to `.env` and set `DB_USER` and `DB_PASSWORD`.

3. Start the application.

   ```bash
   python run_react_ui.py
   ```

   The first account registered becomes the Administrator. To use the original PyQt6 interface instead, run `python main.py`.

A trained model is included in `models/`. To retrain it from `isko.csv`:

```bash
python train_ml_model.py
```

`isko.csv` is synthetic and is produced by `generate_dataset.py` (seeded, so it is reproducible). A student is labeled qualified only when they pass every eligibility rule and their weighted rubric score, plus random reviewer variation, reaches the cutoff that qualifies about half of eligible students. The MSWDO poverty flag is calculated with the same formula the app uses. See the docstring in `generate_dataset.py` for details. To regenerate the data and retrain:

```bash
python generate_dataset.py
python train_ml_model.py
```

To evaluate the saved model (confusion matrix, accuracy, precision, recall, specificity, F1, ROC-AUC, 5-fold cross-validation and feature importance) on the held-out test rows:

```bash
python evaluate_ml_model.py          # add --quick to skip cross-validation, --open to open the report
```

The report is written to `reports/model_evaluation/evaluation_report.html` (charts and `metrics.json` are saved alongside it).

The model is trained and evaluated only on applicants who pass every eligibility rule, since those are the only applicants it scores. The evaluation report also shows how many qualified applicants appear among the top-ranked 10%, 25% and 50%.

Each application and applicant profile in the desktop UI shows the model's chance of qualifying and why: how much each input (academic average, income, household size, etc.) raised or lowered that chance. The breakdown comes from the Random Forest's own decision paths (`app/services/ml_explainer.py`) and adds up exactly to the predicted percentage. AI results are advisory only.

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

```
app/
  repositories/      MySQL data access (applicants, applications, interviews, decisions, results)
  services/          Application rules, machine learning screening, and result storage
  ui/desktop/        React + TypeScript interface, Tauri window, and the local Python service (bridge_server.py)
  ui/                Original PyQt6 main window, pages, and forms
database/            Connection settings (read from .env)
models/              Saved Random Forest model (versioned)
tests/               Repository, service, and screening tests
schema.sql           Database schema
isko.csv             Synthetic training data
generate_dataset.py  Generates isko.csv
train_ml_model.py    Trains the model and saves it with its evaluation metrics
```

## Data Privacy

This repository contains no real applicant data. The training set `isko.csv` is synthetic. Local database backups (`backups/`) and `.env` files are excluded from version control so that personal information and credentials are not committed.

## Author

Karl Sebastian V. Cuerdo
