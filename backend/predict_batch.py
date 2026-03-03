"""
Batch prediction script — called once per upload with a CSV file.
Trains model on first run, then loads from .pkl for subsequent runs.
Outputs one JSON array to stdout.
"""
import sys
import json
import os
import numpy as np
import pandas as pd
import joblib
import warnings
warnings.filterwarnings("ignore")

from sklearn.ensemble import GradientBoostingClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV

BASE = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE   = os.path.join(BASE, "fraud_model.pkl")
SCALER_FILE  = os.path.join(BASE, "fraud_scaler.pkl")
ANOMALY_FILE = os.path.join(BASE, "anomaly_model.pkl")

# ── FEATURE ENGINEERING ──────────────────────────────────────
def engineer(df):
    out = pd.DataFrame()
    out["amount"]           = df["amount"]
    out["claims"]           = df["claims"]
    out["claim_ratio"]      = df["amount"] / (df["claims"] + 1)
    out["amount_log"]       = np.log1p(df["amount"])
    out["claims_log"]       = np.log1p(df["claims"])
    out["high_amount_flag"] = (df["amount"] > 500_000).astype(int)
    out["high_claims_flag"] = (df["claims"] > 10).astype(int)
    out["velocity_score"]   = (df["amount"] / 10_000) * np.log1p(df["claims"])
    out["anomaly_pressure"] = np.sqrt(df["amount"]) * df["claims"]
    return out

# ── SYNTHETIC TRAINING DATA ───────────────────────────────────
def generate_training():
    np.random.seed(42)
    rows = []
    for _ in range(2500):
        rows.append((abs(np.random.exponential(50_000)),  random.randint(1,4),  "Low"))
    for _ in range(1500):
        rows.append((np.random.uniform(100_000,600_000),  random.randint(3,12), "Medium"))
    for _ in range(1000):
        rows.append((np.random.uniform(300_000,2_000_000),random.randint(8,30), "High"))
    import random as r
    r.shuffle(rows)
    return pd.DataFrame(rows, columns=["amount","claims","risk"])

import random

# ── TRAIN ─────────────────────────────────────────────────────
def train():
    print("[INFO] Training model...", file=sys.stderr)
    training_csv = os.path.join(BASE, "training.csv")
    df = pd.read_csv(training_csv) if os.path.exists(training_csv) else generate_training()

    X_raw = engineer(df)
    y     = df["risk"].values

    scaler  = StandardScaler()
    X       = scaler.fit_transform(X_raw)

    clf = CalibratedClassifierCV(
        GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42),
        cv=3, method="isotonic"
    )
    clf.fit(X, y)

    anomaly = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    anomaly.fit(X)

    joblib.dump(clf,     MODEL_FILE)
    joblib.dump(scaler,  SCALER_FILE)
    joblib.dump(anomaly, ANOMALY_FILE)
    print("[INFO] Model saved ✅", file=sys.stderr)
    return clf, scaler, anomaly

# ── LOAD ──────────────────────────────────────────────────────
def load():
    if all(os.path.exists(f) for f in [MODEL_FILE, SCALER_FILE, ANOMALY_FILE]):
        return joblib.load(MODEL_FILE), joblib.load(SCALER_FILE), joblib.load(ANOMALY_FILE)
    return train()

# ── RULE FLAGS ────────────────────────────────────────────────
def flags(amount, claims):
    f = []
    if amount > 1_500_000:           f.append("EXTREME_AMOUNT")
    if claims > 20:                  f.append("EXCESSIVE_CLAIMS")
    if amount > 500_000 and claims > 10: f.append("HIGH_AMOUNT_HIGH_CLAIMS")
    if amount / (claims + 1) > 200_000: f.append("ABNORMAL_CLAIM_RATIO")
    return f

# ── MAIN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: predict_batch.py <csv_path>"}))
        sys.exit(1)

    csv_path = sys.argv[1]
    df = pd.read_csv(csv_path)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    df["claims"] = pd.to_numeric(df["claims"], errors="coerce").fillna(1)

    clf, scaler, anomaly = load()

    X_raw    = engineer(df)
    X_scaled = scaler.transform(X_raw)

    proba        = clf.predict_proba(X_scaled)
    classes      = list(clf.classes_)
    anomaly_pred = anomaly.predict(X_scaled)
    anomaly_scores = anomaly.decision_function(X_scaled)

    results = []
    for i in range(len(df)):
        p = {c: float(proba[i][j]) for j, c in enumerate(classes)}
        predicted  = max(p, key=p.get)
        confidence = round(float(max(proba[i])) * 100, 1)

        is_anomaly   = bool(anomaly_pred[i] == -1)
        anomaly_pct  = float(np.clip((0.5 - anomaly_scores[i]) * 100, 0, 100))

        row_flags = flags(df["amount"].iloc[i], df["claims"].iloc[i])

        # Override rule
        if row_flags and predicted != "High":
            predicted  = "High"
            confidence = max(confidence, 85.0)

        risk_score = round(p.get("High", 0) * 100 * 0.6 + anomaly_pct * 0.4, 1)

        results.append({
            "amount":    float(df["amount"].iloc[i]),
            "claims":    int(df["claims"].iloc[i]),
            "risk":      predicted,
            "confidence": confidence,
            "risk_score": risk_score,
            "probabilities": {
                "Low":    round(p.get("Low",    0) * 100, 1),
                "Medium": round(p.get("Medium", 0) * 100, 1),
                "High":   round(p.get("High",   0) * 100, 1),
            },
            "anomaly": {
                "is_anomaly":    is_anomaly,
                "anomaly_score": round(anomaly_pct, 1)
            },
            "flags": row_flags
        })

    print(json.dumps(results))