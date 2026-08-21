// --- sessionStorage HELPERS ---
function saveData() {
  const inputs = document.querySelectorAll('input[id], select[id]');
  inputs.forEach(el => {
    if (el.type === 'checkbox') {
      sessionStorage.setItem('shared_' + el.id, el.checked);
    } else {
      sessionStorage.setItem('shared_' + el.id, el.value);
    }
  });
}

function loadSavedData() {
  const inputs = document.querySelectorAll('input[id], select[id]');
  inputs.forEach(el => {
    const saved = sessionStorage.getItem('shared_' + el.id);
    if (saved !== null) {
      if (el.type === 'checkbox') {
        el.checked = saved === 'true';
      } else {
        el.value = saved;
      }
    }
  });
}

function fmt(n) {
  if (!isFinite(n) || isNaN(n)) n = 0;
  return 'RM' + Math.round(n).toLocaleString('en-US');
}

function rawNum(str) {
  return +String(str).replace(/[^0-9.]/g, '') || 0;
}

function onMoneyInput(el) {
  const digits = el.value.replace(/[^0-9]/g, '');
  el.value = digits ? (+digits).toLocaleString('en-US') : '';
}

// --- ENTRY COST HELPER FUNCTIONS ---
function motStampDuty(price, isForeigner) {
  if (isForeigner) return price * 0.04;
  let duty = 0, rem = price;
  const tiers = [[100000, 0.01], [400000, 0.02], [500000, 0.03], [Infinity, 0.04]];
  for (const [band, rate] of tiers) {
    if (rem <= 0) break;
    const amt = Math.min(rem, band);
    duty += amt * rate;
    rem -= amt;
  }
  return duty;
}

function legalFeeScale(amount) {
  if (amount <= 0) return 0;
  let fee = 0, rem = amount;
  const tiers = [[500000, 0.0125], [7000000, 0.01], [Infinity, 0.005]];
  for (const [band, rate] of tiers) {
    if (rem <= 0) break;
    const amt = Math.min(rem, band);
    fee += amt * rate;
    rem -= amt;
  }
  return Math.max(fee, 500);
}

function valuationFeeScale(price) {
  if (price <= 0) return 0;
  let fee = 0, rem = price;
  const tiers = [[100000, 0.0025], [2000000, 0.002], [5000000, 0.00167], [Infinity, 0.00125]];
  for (const [band, rate] of tiers) {
    if (rem <= 0) break;
    const amt = Math.min(rem, band);
    fee += amt * rate;
    rem -= amt;
  }
  return Math.max(fee, 300);
}

function calculateExactTotalCash(price, dpPct, epfAmt, renoPct, isForeigner, firstTimer, sameLawyer, valuationWaived) {
  const dpAmt = price * (dpPct / 100);
  const loanAmt = price - dpAmt;
  const netDp = Math.max(0, dpAmt - epfAmt);
  const renoAmt = price * renoPct;

  let mot = motStampDuty(price, isForeigner);
  let loanDuty = loanAmt * 0.005;
  if (firstTimer && price <= 500000 && !isForeigner) {
    mot = 0; loanDuty = 0;
  }

  const legalSpa = legalFeeScale(price);
  const legalSpaSst = legalSpa * 0.08;
  let legalLoan = legalFeeScale(loanAmt);
  if (sameLawyer) legalLoan *= 0.5;
  const legalLoanSst = legalLoan * 0.08;

  const disb = 1200;
  let valFee = valuationWaived ? 0 : valuationFeeScale(price);
  const valSst = valFee * 0.08;

  const entryFees = mot + loanDuty + legalSpa + legalSpaSst + legalLoan + legalLoanSst + disb + valFee + valSst;
  return { netDp, entryFees, renoAmt, totalCash: netDp + entryFees + renoAmt };
}

function onInput() {
  const age = +document.getElementById('age').value || 27;
  const price = rawNum(document.getElementById('targetPrice').value);
  const dpPct = +document.getElementById('dp').value;
  const rate = +document.getElementById('rate').value;
  const duration = +document.getElementById('duration').value;
  const appRate = +document.getElementById('appreciationRate').value / 100;
  const epfAmt = rawNum(document.getElementById('epfAmt').value);
  const renoPct = +document.getElementById('renovationPct').value / 100;
  const isForeigner = document.getElementById('citizenStatus').value === 'foreigner';

  // Shared options from sessionStorage
  const firstTimer = sessionStorage.getItem('shared_firstTimer') === 'true';
  const sameLawyer = sessionStorage.getItem('shared_sameLawyer') !== 'false';
  const valuationWaived = sessionStorage.getItem('shared_valuationWaived') === 'true';

  const loanAmt = price * (1 - dpPct / 100);
  const r = (rate / 100) / 12;
  const n = duration * 12;

  const monthly = (r === 0 || n === 0) ? (n > 0 ? loanAmt / n : 0) : loanAmt * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const totalLoanRepayments = monthly * n;
  const totalInterest = totalLoanRepayments - loanAmt;

  const { netDp, entryFees, renoAmt, totalCash } = calculateExactTotalCash(price, dpPct, epfAmt, renoPct, isForeigner, firstTimer, sameLawyer, valuationWaived);

  // Total All-in Cost = Total Monthly Payments + Out-of-pocket Entry Cash (Net DP + Legal Fees + Renovation)
  const totalAllInCost = totalLoanRepayments + totalCash;

  // Property Appreciation over duration
  const payoffAge = age + duration;
  const appreciatedValue = price * Math.pow(1 + appRate, duration);
  const netGain = appreciatedValue - totalAllInCost;

  document.getElementById('lblAppreciatedVal').textContent = `Valuation at Age ${payoffAge}`;
  document.getElementById('outTotalAllInCost').textContent = fmt(totalAllInCost);
  document.getElementById('outAppreciatedVal').textContent = fmt(appreciatedValue);

  const gainEl = document.getElementById('outNetGain');
  gainEl.textContent = fmt(netGain);
  gainEl.style.color = netGain >= 0 ? 'var(--accent)' : 'var(--warn)';

  const statusBox = document.getElementById('appreciationStatusBox');
  statusBox.innerHTML = `
    By <b>Age ${payoffAge}</b> (after ${duration} years of mortgage payments), your total money spent on this property will be <b>${fmt(totalAllInCost)}</b>.
    <div class="breakdown-list">
      • Original Purchase Price: <b>${fmt(price)}</b><br>
      • Total Loan Principal &amp; Interest: <b>${fmt(totalLoanRepayments)}</b> (Interest paid: <b>${fmt(totalInterest)}</b>)<br>
      • Entry Cash Outlay: <b>${fmt(totalCash)}</b> (Down payment, entry fees, &amp; renovation)<br>
      • Estimated Valuation at Age ${payoffAge}: <b>${fmt(appreciatedValue)}</b> (growing at ${(appRate * 100).toFixed(1)}% p.a.)<br>
      • Net Position vs Total Outlay: <b style="color:${netGain >= 0 ? '#2F6B4F' : 'var(--warn)'}">${fmt(netGain)}</b>
    </div>
  `;

  saveData();
}

loadSavedData();
onInput();