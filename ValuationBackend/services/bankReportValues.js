// For banks with their own report format (APGB…), the fair market / realizable / distress values
// stored on the case come from that report's own calculation — so the case cards, dashboard and
// approvals always show exactly the figures printed in the bank's report.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { bankInfoForReport } = require('./banks');

// Banks whose own report format is installed (services/reports/registry.py)
const INSTALLED = ['apgb', 'bob', 'boi', 'canara', 'union', 'pnb', 'iob', 'cbi', 'uco', 'karnataka', 'indian', 'sbi', 'bom'];

async function applyBankReportValues(caseObj, valuation) {
  if (!valuation || (valuation.valuationStatus && valuation.valuationStatus !== 'SUCCESS')) return valuation;
  const data = await bankInfoForReport(caseObj);
  if (!data.reportFormat || !INSTALLED.includes(data.reportFormat.bankKey)) return valuation;
  const file = path.join(os.tmpdir(), `values_${caseObj.id || 'x'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    const py = spawnSync('python3', [path.join(__dirname, 'reports', 'values.py'), file], { timeout: 30000 });
    if (py.status !== 0) {
      console.warn('Bank report values:', py.stderr ? py.stderr.toString().slice(-300) : 'failed');
      return valuation;
    }
    const v = JSON.parse(py.stdout.toString().trim().split('\n').pop());
    if (!v.fmv) return valuation;
    return { ...valuation, fairMarketValue: v.fmv, realizableValue: v.realizable, distressSaleValue: v.distress, source: `bank-report:${v.format}` };
  } catch (err) {
    console.warn('Bank report values:', err.message);
    return valuation;
  } finally {
    try { fs.unlinkSync(file); } catch (_) {}
  }
}

module.exports = { applyBankReportValues };
