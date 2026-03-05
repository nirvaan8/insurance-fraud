// Pure JS batch prediction — no Python needed
// Replicates the logic from predict_batch.py

function featureEngineer(amount, claims) {
  const claimRatio    = claims > 0 ? amount / claims : amount;
  const amountLog     = Math.log1p(amount);
  const claimsLog     = Math.log1p(claims);
  const highAmountFlag  = amount > 500000 ? 1 : 0;
  const highClaimsFlag  = claims > 15 ? 1 : 0;
  const velocityScore   = (amount / 100000) * (claims / 10);
  const anomalyPressure = claimRatio > 100000 || claimRatio < 500 ? 1 : 0;
  return { claimRatio, amountLog, claimsLog, highAmountFlag, highClaimsFlag, velocityScore, anomalyPressure };
}

function getRuleFlags(amount, claims) {
  const flags = [];
  if (amount > 1500000)                        flags.push("EXTREME_AMOUNT");
  if (claims > 20)                             flags.push("EXCESSIVE_CLAIMS");
  if (amount > 800000 && claims > 15)          flags.push("HIGH_AMOUNT_HIGH_CLAIMS");
  const ratio = claims > 0 ? amount / claims : amount;
  if (ratio > 200000 || (claims > 5 && ratio < 1000)) flags.push("ABNORMAL_CLAIM_RATIO");
  return flags;
}

function predict(amount, claims) {
  const feat  = featureEngineer(amount, claims);
  const flags = getRuleFlags(amount, claims);

  // Rule-based risk score (0-100)
  let score = 0;
  score += Math.min(40, (amount / 2000000) * 40);   // amount contribution
  score += Math.min(30, (claims / 30) * 30);          // claims contribution
  score += feat.anomalyPressure * 15;                 // anomaly pressure
  score += flags.length * 5;                          // flag penalty
  score = Math.min(100, score);

  // Risk level
  let risk = "Low";
  if (score >= 65) risk = "High";
  else if (score >= 35) risk = "Medium";

  // Override with flags
  if (flags.includes("EXTREME_AMOUNT") || flags.includes("HIGH_AMOUNT_HIGH_CLAIMS")) risk = "High";
  if (flags.includes("EXCESSIVE_CLAIMS") || flags.includes("ABNORMAL_CLAIM_RATIO")) {
    if (risk === "Low") risk = "Medium";
  }

  // Confidence (higher score = more confident)
  const confidence = Math.round(60 + Math.abs(score - 50) * 0.7);

  // Anomaly detection
  const isAnomaly   = flags.length >= 2 || feat.anomalyPressure === 1;
  const anomalyScore = Math.round(feat.anomalyPressure * 50 + flags.length * 15);

  // Probabilities
  const highProb   = risk === "High"   ? Math.round(confidence * 0.9) : Math.round((100 - confidence) * 0.3);
  const lowProb    = risk === "Low"    ? Math.round(confidence * 0.9) : Math.round((100 - confidence) * 0.3);
  const medProb    = 100 - highProb - lowProb;

  return {
    amount, claims, risk,
    confidence,
    risk_score: parseFloat(score.toFixed(1)),
    probabilities: { Low: lowProb, Medium: Math.max(0, medProb), High: highProb },
    anomaly: { is_anomaly: isAnomaly, anomaly_score: anomalyScore },
    flags
  };
}

module.exports = { predict };
