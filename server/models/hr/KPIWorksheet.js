const mongoose = require('mongoose');

/**
 * Monthly KPI sheet per employee (Excel-aligned).
 * Employee vs manager: separate achieved / total assigned.
 * Scoring uses manager numbers when manager total assigned > 0; otherwise employee numbers.
 */
const kpiWorksheetRowSchema = new mongoose.Schema(
  {
    kpiArea: { type: String, trim: true, default: '' },
    weight: { type: Number, default: 0, min: 0, max: 100 },
    employeeAchieved: { type: Number, default: 0, min: 0 },
    employeeTotalAssigned: { type: Number, default: 0, min: 0 },
    managerAchieved: { type: Number, default: 0, min: 0 },
    managerTotalAssigned: { type: Number, default: 0, min: 0 },
    /** Legacy single pair (pre split-columns); migrated into employee fields on recompute */
    achieved: { type: Number, default: 0, min: 0 },
    totalAssigned: { type: Number, default: 0, min: 0 },
    achievementPercent: { type: Number, default: 0 },
    score1to5: { type: Number, default: 1, min: 1, max: 5 },
    finalWeightage: { type: Number, default: 0 }
  },
  { _id: true }
);

const kpiWorksheetSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    rows: [kpiWorksheetRowSchema],
    totalWeight: { type: Number, default: 0 },
    totalKPIScore: { type: Number, default: 0 },
    lastSavedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastSavedAt: { type: Date }
  },
  { timestamps: true }
);

kpiWorksheetSchema.index({ employee: 1, year: 1, month: 1 }, { unique: true });

function achievementToScore1to5(achievementPercent) {
  const p = Number(achievementPercent) || 0;
  if (p >= 100) return 5;
  if (p >= 90) return 4;
  if (p >= 75) return 3;
  if (p >= 50) return 2;
  if (p > 0) return 1;
  return 1;
}

function normalizeRowInputs(row) {
  const legacyA = Math.max(0, Number(row.achieved) || 0);
  const legacyT = Math.max(0, Number(row.totalAssigned) || 0);

  let eA = Math.max(0, Number(row.employeeAchieved) || 0);
  let eT = Math.max(0, Number(row.employeeTotalAssigned) || 0);
  if (eA === 0 && eT === 0 && (legacyA > 0 || legacyT > 0)) {
    eA = legacyA;
    eT = legacyT;
  }

  const mA = Math.max(0, Number(row.managerAchieved) || 0);
  const mT = Math.max(0, Number(row.managerTotalAssigned) || 0);

  const useManager = mT > 0;
  const ach = useManager ? mA : eA;
  const tgt = useManager ? mT : eT;

  return {
    employeeAchieved: eA,
    employeeTotalAssigned: eT,
    managerAchieved: mA,
    managerTotalAssigned: mT,
    scoringAchieved: ach,
    scoringTotalAssigned: tgt
  };
}

kpiWorksheetSchema.methods.recomputeDerived = function recomputeDerived() {
  let totalWeight = 0;
  let totalKPIScore = 0;

  for (const row of this.rows || []) {
    const w = Math.max(0, Math.min(100, Number(row.weight) || 0));
    const norm = normalizeRowInputs(row);

    row.employeeAchieved = norm.employeeAchieved;
    row.employeeTotalAssigned = norm.employeeTotalAssigned;
    row.managerAchieved = norm.managerAchieved;
    row.managerTotalAssigned = norm.managerTotalAssigned;
    row.achieved = norm.scoringAchieved;
    row.totalAssigned = norm.scoringTotalAssigned;

    let achievementPercent = 0;
    if (norm.scoringTotalAssigned > 0) {
      achievementPercent = Math.min(
        100,
        Math.round(((norm.scoringAchieved / norm.scoringTotalAssigned) * 100 + Number.EPSILON) * 100) / 100
      );
    }

    const score1to5 = achievementToScore1to5(achievementPercent);
    const finalWeightage = Math.round(((w / 100) * score1to5 + Number.EPSILON) * 1000) / 1000;

    row.weight = w;
    row.achievementPercent = achievementPercent;
    row.score1to5 = score1to5;
    row.finalWeightage = finalWeightage;

    totalWeight += w;
    totalKPIScore += finalWeightage;
  }

  this.totalWeight = Math.round(totalWeight * 100) / 100;
  this.totalKPIScore = Math.round(totalKPIScore * 1000) / 1000;
};

kpiWorksheetSchema.pre('save', function (next) {
  this.recomputeDerived();
  next();
});

module.exports = mongoose.model('KPIWorksheet', kpiWorksheetSchema);
