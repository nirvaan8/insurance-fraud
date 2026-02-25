import csv
import random

rows = 100000

with open("fraud_dataset.csv", "w", newline="") as file:
    writer = csv.writer(file)
    
    # header
    writer.writerow(["amount", "claims", "age", "policy_years", "fraud"])
    
    for _ in range(rows):
        amount = random.randint(1000, 100000)
        claims = random.randint(0, 10)
        age = random.randint(18, 70)
        policy_years = random.randint(1, 20)

        # simple fraud logic
        fraud = 1 if (amount > 50000 and claims > 3) else 0

        writer.writerow([amount, claims, age, policy_years, fraud])

print("Dataset generated ✅")