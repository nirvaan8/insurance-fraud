/* ===============================================================
   ULTRA-FAST SYNTHETIC DATA GENERATOR
   Generates 100,000 insurance fraud records in <5 seconds
   =============================================================== */

const cities = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune",
  "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore",
  "Thane", "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Ghaziabad",
  "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Varanasi",
  "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Allahabad", "Ranchi",
  "Howrah", "Coimbatore", "Jabalpur", "Gwalior", "Vijayawada", "Jodhpur", "Madurai"
];

const incidents = ["collision", "theft", "fire", "other"];

/**
 * Fast random integer between min and max (inclusive)
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fast random float between min and max
 */
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Fast random element from array
 */
function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a single fraud record (optimized, no heavy validation)
 * @param {number} fraudRate - Percentage (0-100) of records that should be high-risk
 */
function generateRecord(fraudRate = 30) {
  const isFraud = Math.random() * 100 < fraudRate;

  let amount, claims, premium, policyDuration, witnesses, policeReport;

  if (isFraud) {
    // High-risk patterns
    amount          = randInt(800000, 2500000);     // Large claims
    claims          = randInt(15, 35);              // Many claims
    premium         = randInt(8000, 25000);         // Low premium vs claim
    policyDuration  = randInt(1, 4);                // New policy
    witnesses       = randInt(0, 1);                // Few/no witnesses
    policeReport    = Math.random() < 0.3;          // Often no police report
  } else {
    // Normal patterns
    amount          = randInt(50000, 600000);
    claims          = randInt(1, 8);
    premium         = randInt(15000, 60000);
    policyDuration  = randInt(12, 60);
    witnesses       = randInt(2, 5);
    policeReport    = Math.random() < 0.85;
  }

  return {
    amount,
    claims,
    age:            randInt(22, 65),
    policy_duration: policyDuration,
    incident_type:  randChoice(incidents),
    witnesses,
    police_report:  policeReport ? "yes" : "no",
    premium_amount: premium,
    vehicle_age:    randInt(0, 15),
    location:       randChoice(cities)
  };
}

/**
 * Generate N records and return as CSV string (fastest approach)
 * @param {number} count - Number of records to generate
 * @param {number} fraudRate - Fraud percentage (0-100)
 */
function generateCSV(count = 100000, fraudRate = 30) {
  const header = "amount,claims,age,policy_duration,incident_type,witnesses,police_report,premium_amount,vehicle_age,location\n";
  
  // Pre-allocate array for speed
  const rows = new Array(count);
  
  for (let i = 0; i < count; i++) {
    const rec = generateRecord(fraudRate);
    rows[i] = `${rec.amount},${rec.claims},${rec.age},${rec.policy_duration},${rec.incident_type},${rec.witnesses},${rec.police_report},${rec.premium_amount},${rec.vehicle_age},${rec.location}`;
  }
  
  return header + rows.join("\n");
}

module.exports = { generateCSV, generateRecord };