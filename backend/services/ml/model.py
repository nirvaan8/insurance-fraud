import pandas as pd
import sys
import json

file_path = sys.argv[1]

df = pd.read_csv(file_path)

results = []

for _, row in df.iterrows():
    claim_amount = row.get("claim_amount", 0)

    if claim_amount > 50000:
        risk = "High"
        score = 80
    elif claim_amount > 20000:
        risk = "Medium"
        score = 40
    else:
        risk = "Low"
        score = 10

    results.append({
        "claim_amount": claim_amount,
        "FraudScore": score,
        "RiskLevel": risk
    })

print(json.dumps(results))