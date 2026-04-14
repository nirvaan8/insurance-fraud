"""
FraudSys — Upgraded ML Model
Features:
  - Fraud probability confidence score (0-100%)
  - Anomaly detection via Isolation Forest
  - Feature engineering (claim ratio, velocity, log transforms)
  - Ensemble: Random Forest + Gradient Boosting
  - Rule-based override for extreme cases
  - Returns JSON for easy parsing
"""

import sys
import json
import os
import numpy as np
import pandas as pd
import joblib
import warnings
warnings.filterwarnings("ignore")

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split

MODEL_FILE  = os.path.join(os.path.dirname(__file__), "fraud_model.pkl")
SCALER_FILE = os.path.join(os.path.dirname(__file__), "fraud_scaler.pkl")
ANOMALY_FILE= os.path.join(os.path.dirname(__file__), "anomaly_model.pkl")

# ─── FEATURE ENGINEERING ─────────────────────────────────────────────────────
def engineer_features(amount, claims):
    """
    From just amount + claims, derive rich features:
    - claim_ratio      : amount per claim
    - amount_log       : log-scaled amount (handles outliers)
    - claims_log       : log-scaled claims
    - high_amount_flag : 1 if amount > 500,000
    - high_claims_flag : 1 if claims > 10
    - velocity_score   : combined pressure score
    - anomaly_pressure : quadratic interaction
    """
    claim_ratio       = amount / (claims + 1)
    amount_log        = np.log1p(amount)
    claims_log        = np.log1p(claims)
    high_amount_flag  = 1 if amount > 500_000 else 0
    high_claims_flag  = 1 if claims > 10 else 0
    velocity_score    = (amount / 10_000) * np.log1p(claims)
    anomaly_pressure  = (amount ** 0.5) * claims

    return np.array([[
        amount, claims,
        claim_ratio, amount_log, claims_log,
        high_amount_flag, high_claims_flag,
        velocity_score, anomaly_pressure
    ]])

FEATURE_NAMES = [
    "amount", "claims", "claim_ratio", "amount_log", "claims_log",
    "high_amount_flag", "high_claims_flag", "velocity_score", "anomaly_pressure"
]

# ─── SYNTHETIC TRAINING DATA ─────────────────────────────────────────────────
def generate_training_data(n=5000):
    """
    Generate realistic synthetic insurance fraud data.
    Replace this with your real training.csv if available.
    """
    np.random.seed(42)
    rows = []

    # Low risk: small amounts, few claims
    for _ in range(int(n * 0.5)):
        amount = np.random.exponential(50_000)
        claims = np.random.randint(1, 5)
        rows.append((amount, claims, "Low"))

    # Medium risk: moderate amounts or claims
    for _ in range(int(n * 0.3)):
        amount = np.random.uniform(100_000, 600_000)
        claims = np.random.randint(3, 12)
        rows.append((amount, claims, "Medium"))

    # High risk: large amounts and/or many claims
    for _ in range(int(n * 0.2)):
        amount = np.random.uniform(300_000, 2_000_000)
        claims = np.random.randint(8, 30)
        rows.append((amount, claims, "High"))

    df = pd.DataFrame(rows, columns=["amount", "claims", "risk"])
    return df

# ─── TRAIN ───────────────────────────────────────────────────────────────────
def train_models():
    print("[INFO] Training models...", file=sys.stderr)

    # Load real data if available, else use synthetic
    training_csv = os.path.join(os.path.dirname(__file__), "training.csv")
    if os.path.exists(training_csv):
        df = pd.read_csv(training_csv)
        print(f"[INFO] Loaded real training data: {len(df)} rows", file=sys.stderr)
    else:
        df = generate_training_data()
        print("[INFO] Using synthetic training data (5000 rows)", file=sys.stderr)

    # Feature engineering on training set
    features = []
    for _, row in df.iterrows():
        features.append(engineer_features(row["amount"], row["claims"])[0])
    X = np.array(features)
    y = df["risk"].values

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ── Classifier: Gradient Boosting (better calibrated probabilities) ──
    base_clf = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        random_state=42
    )
    # Calibrate for reliable probability estimates
    clf = CalibratedClassifierCV(base_clf, cv=3, method='isotonic')
    clf.fit(X_scaled, y)

    # ── Anomaly detector: Isolation Forest ──
    anomaly = IsolationForest(
        n_estimators=200,
        contamination=0.1,   # expect ~10% anomalies
        random_state=42
    )
    anomaly.fit(X_scaled)

    joblib.dump(clf,     MODEL_FILE)
    joblib.dump(scaler,  SCALER_FILE)
    joblib.dump(anomaly, ANOMALY_FILE)
    print("[INFO] Models saved ✅", file=sys.stderr)
    return clf, scaler, anomaly

# ─── LOAD ────────────────────────────────────────────────────────────────────
def load_models():
    if not (os.path.exists(MODEL_FILE) and
            os.path.exists(SCALER_FILE) and
            os.path.exists(ANOMALY_FILE)):
        return train_models()
    clf     = joblib.load(MODEL_FILE)
    scaler  = joblib.load(SCALER_FILE)
    anomaly = joblib.load(ANOMALY_FILE)
    return clf, scaler, anomaly

# ─── RULE-BASED OVERRIDE ────────────────────────────────────────────────────
def rule_based_check(amount, claims):
    """Hard rules that always fire regardless of model output."""
    flags = []
    if amount > 1_500_000:
        flags.append("EXTREME_AMOUNT")
    if claims > 20:
        flags.append("EXCESSIVE_CLAIMS")
    if amount > 500_000 and claims > 10:
        flags.append("HIGH_AMOUNT_HIGH_CLAIMS")
    if amount / (claims + 1) > 200_000:
        flags.append("ABNORMAL_CLAIM_RATIO")
    return flags

# ─── PREDICT ────────────────────────────────────────────────────────────────
def predict(amount, claims):
    clf, scaler, anomaly = load_models()

    X_raw    = engineer_features(amount, claims)
    X_scaled = scaler.transform(X_raw)

    # Class probabilities
    proba    = clf.predict_proba(X_scaled)[0]
    classes  = list(clf.classes_)
    proba_map = {c: float(p) for c, p in zip(classes, proba)}

    low_p  = proba_map.get("Low",    0.0)
    mid_p  = proba_map.get("Medium", 0.0)
    high_p = proba_map.get("High",   0.0)

    # Predicted class
    predicted = classes[int(np.argmax(proba))]

    # Confidence = probability of predicted class
    confidence = float(max(proba)) * 100

    # Anomaly score: -1 = anomaly, 1 = normal
    anomaly_score = anomaly.decision_function(X_scaled)[0]
    is_anomaly    = bool(anomaly.predict(X_scaled)[0] == -1)
    # Normalize anomaly score to 0-100 (higher = more anomalous)
    anomaly_pct   = float(np.clip((0.5 - anomaly_score) * 100, 0, 100))

    # Rule-based flags
    flags = rule_based_check(amount, claims)

    # Override: if hard rules fired and model says Low/Medium, escalate
    if flags and predicted != "High":
        predicted  = "High"
        confidence = max(confidence, 85.0)

    # Risk score 0-100
    risk_score = round(high_p * 100 * 0.6 + anomaly_pct * 0.4, 1)

    # Top contributing features
    feat_vals = X_raw[0]
    contributions = {
        "Claim Amount":    round(float(feat_vals[0]), 2),
        "No. of Claims":   int(feat_vals[1]),
        "Claim Ratio":     round(float(feat_vals[2]), 2),
        "Velocity Score":  round(float(feat_vals[7]), 2),
        "Anomaly Pressure":round(float(feat_vals[8]), 2),
    }

    result = {
        "risk":        predicted,
        "confidence":  round(confidence, 1),
        "risk_score":  risk_score,
        "probabilities": {
            "Low":    round(low_p  * 100, 1),
            "Medium": round(mid_p  * 100, 1),
            "High":   round(high_p * 100, 1),
        },
        "anomaly": {
            "is_anomaly":   is_anomaly,
            "anomaly_score": round(anomaly_pct, 1),
        },
        "flags":         flags,
        "features":      contributions,
    }
    return result

# ─── MAIN ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: model.py <amount> <claims>"}))
        sys.exit(1)

    amount = float(sys.argv[1])
    claims = float(sys.argv[2])

    output = predict(amount, claims)
    print(json.dumps(output))