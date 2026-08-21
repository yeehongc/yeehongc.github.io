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
  if (!isFinite(n)) n = 0;
  return 'RM' + Math.round(n).toLocaleString('en-US');
}

function rawNum(str) {
  return +String(str).replace(/[^0-9.]/g, '') || 0;
}

function onMoneyInput(el) {
  const digits = el.value.replace(/[^0-9]/g, '');
  el.value = digits ? (+digits).toLocaleString('en-US') : '';
}

function motStampDuty(price, isForeigner) {
  if (isForeigner) return price * 0.04; // Flat 4% for foreigners
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
  //const dpAmt = price * (dpPct / 100);
  //const loanAmt = price - dpAmt;

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
  return { dpAmt, netDp, renoAmt, entryFees, totalCash: netDp + entryFees + renoAmt};
}

function onInput() {
  const currentAge = +document.getElementById('currentAge').value;
  const price = rawNum(document.getElementById('targetPrice').value);
  const dpPct = +document.getElementById('dp').value;
  const epfAmt = rawNum(document.getElementById('epfAmt').value);
  const renoPct = +document.getElementById('renovationPct').value / 100;
  const grossIncome = rawNum(document.getElementById('monthlyIncome').value);
  const annualIncrement = +document.getElementById('annualIncrement').value / 100;
  const savingsPct = +document.getElementById('savingsPct').value / 100;
  const currentSavings = rawNum(document.getElementById('currentSavings').value);
  
  let userLimitPct = +document.getElementById('safetyThresholdPct').value;
  if (userLimitPct <= 0) userLimitPct = 100;
  const safetyThreshold = userLimitPct / 100;

  const existingDebt = rawNum(document.getElementById('existingDebt').value);
  const isForeigner = document.getElementById('citizenStatus').value === 'foreigner';
  const rate = +document.getElementById('rate').value;
  const duration = +document.getElementById('duration').value;
  const firstTimer = document.getElementById('firstTimer').checked;
  const sameLawyer = document.getElementById('sameLawyer').checked;
  const valuationWaived = document.getElementById('valuationWaived').checked;

  const initialMonthlySavings = grossIncome * savingsPct;
  document.getElementById('hintRenoRm').textContent = `${fmt(price * renoPct)} renovation budget`;
  document.getElementById('hintSavingsRm').textContent = `${fmt(initialMonthlySavings)}/mo initial savings capacity`;

  const { dpAmt, netDp, renoAmt, entryFees, totalCash } = calculateExactTotalCash(price, dpPct, epfAmt, renoPct, isForeigner, firstTimer, sameLawyer, valuationWaived);
  const targetSavingsRequired = totalCash / safetyThreshold;

  document.getElementById('outTotalCash').textContent = fmt(totalCash);
  document.getElementById('outTargetSavings').textContent = fmt(targetSavingsRequired);

  let accumulatedSavings = currentSavings;
  let months = 0;
  let currIncome = grossIncome;
  const maxMonths = 360;

  while (accumulatedSavings < targetSavingsRequired && months < maxMonths) {
    months++;
    accumulatedSavings += currIncome * savingsPct;
    if (months % 12 === 0) {
      currIncome *= (1 + annualIncrement);
    }
  }

  const readyAge = currentAge + (months / 12);
  const readyAgeStr = months >= maxMonths ? '30+ yrs' : `Age ${readyAge.toFixed(1)}`;
  document.getElementById('outReadyAge').textContent = readyAgeStr;

  const timelineBox = document.getElementById('timelineStatusBox');
  const bufferAmt = targetSavingsRequired - totalCash;

  if (months === 0) {
    timelineBox.innerHTML = `
      <span class="pass">✓ Purchase Ready Immediately at Age ${currentAge}!</span><br>
      Your current savings of <b>${fmt(currentSavings)}</b> meet your limit of <b>${userLimitPct}%</b> cash deployment (target liquid savings: <b>${fmt(targetSavingsRequired)}</b>).
      <div class="breakdown-list">
	• Net Down Payment Out-of-Pocket: <b>${fmt(netDp)}</b> (after RM${epfAmt.toLocaleString()} EPF withdrawal)<br>
	• Renovation Budget Included: <b>${fmt(renoAmt)}</b><br>
        • Emergency Cash Retained Post-Purchase:</b> <b>${fmt(currentSavings - totalCash)}</b>
      </div>
    `;
  } else if (months < maxMonths) {
    const years = (months / 12).toFixed(1);
    timelineBox.innerHTML = `
      <span class="warn">! Projected Ready at Age ${readyAge.toFixed(1)} (${years} years / ${months} months)</span><br>
      Factoring in a <b>${(annualIncrement * 100).toFixed(1)}% annual increment</b> and saving <b>${(savingsPct * 100).toFixed(0)}% of income</b>, you will accumulate the required <b>${fmt(targetSavingsRequired)}</b> in <b>${months} months</b>.
      <div class="breakdown-list">
        • Total Cash Needed: <b>${fmt(netDp)}</b> (Downpayment) + <b>${fmt(entryFees)}</b> (Entry Fees) + <b>${fmt(renoAmt)}</b> (Renovation)<br>
        • Emergency Cushion Retained: <b>${fmt(bufferAmt)}</b><br>
        • Final Monthly Income at Purchase: <b>${fmt(currIncome)}</b>
      </div>
    `;
  } else {
    timelineBox.innerHTML = `
      <span class="fail">✕ Horizon Exceeds 30 Years</span><br>
      Consider increasing savings percentage, lowering target property price, or adjusting annual increment assumptions to reach purchase readiness earlier.
    `;
  }

  // DSR Calculation
  const loanAmt = price - dpAmt;
  const r = (rate / 100) / 12;
  const n = duration * 12;
  const monthlyInstallment = r === 0 ? loanAmt / n : loanAmt * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const totalCommitment = existingDebt + monthlyInstallment;
  const dsr = grossIncome > 0 ? (totalCommitment / grossIncome) * 100 : 0;

  document.getElementById('outMonthlyInstallment').textContent = fmt(monthlyInstallment);
  document.getElementById('outTotalCommitment').textContent = fmt(totalCommitment);
  
  const dsrEl = document.getElementById('outDSR');
  dsrEl.textContent = dsr.toFixed(1) + '%';

  const dsrBox = document.getElementById('dsrStatusBox');
  if (dsr <= 60) {
    dsrEl.style.color = '#2F6B4F';
    dsrBox.innerHTML = `<span class="pass">✓ Healthy DSR (${dsr.toFixed(1)}%)</span> — Standard approval range for Malaysian banks.`;
  } else if (dsr <= 70) {
    dsrEl.style.color = 'var(--total)';
    dsrBox.innerHTML = `<span class="warn">! Moderate DSR (${dsr.toFixed(1)}%)</span> — Near typical 70% approval limit.`;
  } else {
    dsrEl.style.color = 'var(--warn)';
    dsrBox.innerHTML = `<span class="fail">✕ High DSR (${dsr.toFixed(1)}%)</span> — Exceeds standard approval limits. Lower existing debt or raise down payment.`;
  }

  saveData();
}

loadSavedData();
onInput();