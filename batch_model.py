import sys
import pandas as pd
import joblib

MODEL_FILE = "model.pkl"

file_path = sys.argv[1]

model = joblib.load(MODEL_FILE)

df = pd.read_csv(file_path)

X = df[["amount", "claims"]]

predictions = model.predict(X)

df["risk"] = predictions

print(df.to_json(orient="records"))