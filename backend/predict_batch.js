// ═══════════════════════════════════════════════════════════
// FraudSys — Pure JS ML Prediction Engine (v2)
// Parameters: amount, claims, age, policy_duration,
//             incident_type, witnesses, police_report,
//             premium_amount, vehicle_age
// ═══════════════════════════════════════════════════════════

const INCIDENT_RISK = {
  fire: 0.9, theft: 0.75, collision: 0.5, other: 0.4, unknown: 0.5
};

function normaliseIncident(val) {
  if (!val) return 'unknown';
  const v = String(val).toLowerCase().trim();
  if (v.includes('fire'))      return 'fire';
  if (v.includes('theft') || v.includes('steal')) return 'theft';
  if (v.includes('collision') || v.includes('crash') || v.includes('accident')) return 'collision';
  return 'other';
}

function featureEngineer(p) {
  const { amount, claims, age, policyDuration, incidentType,
          witnesses, policeReport, premiumAmount, vehicleAge } = p;
  const claimRatio      = claims > 0 ? amount / claims : amount;
  const amountLog       = Math.log1p(amount);
  const claimsLog       = Math.log1p(claims);
  const highAmountFlag  = amount > 500000 ? 1 : 0;
  const highClaimsFlag  = claims > 15 ? 1 : 0;
  const velocityScore   = (amount / 100000) * (claims / 10);
  const anomalyPressure = claimRatio > 100000 || (claims > 5 && claimRatio < 1000) ? 1 : 0;
  const premiumRatio    = premiumAmount > 0 ? amount / premiumAmount : 0;
  const youngDriver     = age > 0 && age < 25 ? 1 : 0;
  const newPolicy       = policyDuration > 0 && policyDuration < 6 ? 1 : 0;
  const oldVehicle      = vehicleAge > 10 ? 1 : 0;
  const noWitnesses     = witnesses === 0 ? 1 : 0;
  const noPoliceReport  = (policeReport === false || policeReport === 0 || String(policeReport).toLowerCase() === 'no') ? 1 : 0;
  const incidentRiskScore = INCIDENT_RISK[normaliseIncident(incidentType)] || 0.5;
  return { claimRatio, amountLog, claimsLog, highAmountFlag, highClaimsFlag,
    velocityScore, anomalyPressure, premiumRatio, youngDriver, newPolicy,
    oldVehicle, noWitnesses, noPoliceReport, incidentRiskScore };
}

function getRuleFlags(p, feat) {
  const { amount, claims, age, policyDuration, witnesses,
          policeReport, premiumAmount, vehicleAge } = p;
  const flags = [];
  if (amount > 1500000)                        flags.push("EXTREME_AMOUNT");
  if (claims > 20)                             flags.push("EXCESSIVE_CLAIMS");
  if (amount > 800000 && claims > 15)          flags.push("HIGH_AMOUNT_HIGH_CLAIMS");
  if (feat.claimRatio > 200000 || (claims > 5 && feat.claimRatio < 1000))
                                               flags.push("ABNORMAL_CLAIM_RATIO");
  if (premiumAmount > 0 && amount / premiumAmount > 20)
                                               flags.push("PREMIUM_CLAIM_MISMATCH");
  if (policyDuration > 0 && policyDuration < 3 && amount > 300000)
                                               flags.push("NEW_POLICY_LARGE_CLAIM");
  if (feat.noWitnesses && amount > 500000)     flags.push("NO_WITNESS_HIGH_CLAIM");
  if (feat.noPoliceReport && amount > 400000)  flags.push("NO_POLICE_REPORT");
  if (vehicleAge > 15 && amount > 600000)      flags.push("OLD_VEHICLE_HIGH_CLAIM");
  if (age > 0 && age < 25 && amount > 700000)  flags.push("YOUNG_DRIVER_HIGH_CLAIM");
  return flags;
}

function predict(params) {
  const {
    amount = 0, claims = 0, age = 0, policyDuration = 0,
    incidentType = 'unknown', witnesses = 1, policeReport = true,
    premiumAmount = 0, vehicleAge = 0
  } = params;

  const feat  = featureEngineer({ amount, claims, age, policyDuration,
    incidentType, witnesses, policeReport, premiumAmount, vehicleAge });
  const flags = getRuleFlags({ amount, claims, age, policyDuration,
    witnesses, policeReport, premiumAmount, vehicleAge }, feat);

  // Risk scoring (0-100)
  let score = 0;
  score += Math.min(20, (amount / 2000000) * 20);
  score += Math.min(15, (claims / 30) * 15);
  score += feat.anomalyPressure * 10;
  score += feat.incidentRiskScore * 5;
  score += Math.min(8, feat.premiumRatio > 0 ? Math.min(feat.premiumRatio / 5, 1) * 8 : 0);
  score += feat.noPoliceReport * 6;
  score += feat.noWitnesses * 5;
  score += feat.newPolicy * 5;
  score += feat.oldVehicle * 3;
  score += feat.youngDriver * 3;
  score += Math.min(20, flags.length * 4);
  score = Math.min(100, Math.max(0, score));

  let risk = "Low";
  if (score >= 60) risk = "High";
  else if (score >= 30) risk = "Medium";

  const criticalFlags = ["EXTREME_AMOUNT","HIGH_AMOUNT_HIGH_CLAIMS","NO_POLICE_REPORT","NEW_POLICY_LARGE_CLAIM","PREMIUM_CLAIM_MISMATCH"];
  if (flags.some(f => criticalFlags.includes(f))) {
    if (risk === "Low") risk = "Medium";
    if (flags.filter(f => criticalFlags.includes(f)).length >= 2) risk = "High";
  }
  if (flags.includes("EXTREME_AMOUNT") || flags.includes("HIGH_AMOUNT_HIGH_CLAIMS")) risk = "High";

  const featureCount = [age,policyDuration,premiumAmount,vehicleAge].filter(v=>v>0).length
                     + (witnesses !== null && witnesses !== undefined ? 1 : 0)
                     + (policeReport !== null && policeReport !== undefined ? 1 : 0);
  const confidence = Math.round(Math.min(99, 55 + Math.abs(score - 50) * 0.75 + Math.min(10, featureCount * 1.5)));

  const criticalCount = flags.filter(f => criticalFlags.includes(f)).length;
  const isAnomaly     = flags.length >= 2 || feat.anomalyPressure === 1 || criticalCount >= 1;
  const anomalyScore  = Math.min(100, Math.round(feat.anomalyPressure * 40 + flags.length * 12 + criticalCount * 8));

  const highProb = risk === "High" ? Math.round(confidence * 0.88) : Math.round((100 - confidence) * 0.25);
  const lowProb  = risk === "Low"  ? Math.round(confidence * 0.88) : Math.round((100 - confidence) * 0.25);
  const medProb  = Math.max(0, 100 - highProb - lowProb);

  return {
    amount, claims, age, policyDuration,
    incidentType: normaliseIncident(incidentType),
    witnesses, policeReport, premiumAmount, vehicleAge,
    risk, confidence,
    risk_score: parseFloat(score.toFixed(1)),
    probabilities: { Low: lowProb, Medium: medProb, High: highProb },
    anomaly: { is_anomaly: isAnomaly, anomaly_score: anomalyScore },
    flags
  };
}

module.exports = { predict };
