import sys
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib
import os

# MODEL FILE
MODEL_FILE = "model.pkl"

# TRAIN ONLY ONCE
if not os.path.exists(MODEL_FILE):

    data = pd.DataFrame({
        "amount": [10000, 20000, 50000, 80000, 90000, 30000, 70000],
        "claims": [0, 1, 1, 3, 4, 2, 3],
        "risk": [0, 0, 1, 1, 1, 0, 1]
    })

    X = data[["amount", "claims"]]
    y = data["risk"]

    model = RandomForestClassifier(n_estimators=50)
    model.fit(X, y)

    joblib.dump(model, MODEL_FILE)

# LOAD MODEL
model = joblib.load(MODEL_FILE)

# INPUT FROM NODE
amount = float(sys.argv[1])
claims = float(sys.argv[2])

input_data = pd.DataFrame([[amount, claims]], columns=["amount", "claims"])
prediction = model.predict(input_data)[0]
# OUTPUT
if prediction == 1:
    print("High")
else:
    print("Low")