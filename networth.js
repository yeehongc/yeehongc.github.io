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
  return netDp + entryFees + renoAmt;
}

function onInput() {
  const currentAge = +document.getElementById('currentAge').value;
  const targetAge = +document.getElementById('targetAge').value;
  const grossMonthlySalary = rawNum(document.getElementById('monthlySalary').value);

  const taxRatePct = +document.getElementById('taxRatePct').value / 100;
  const epfEmployeePct = +document.getElementById('epfEmployeePct').value / 100;
  const epfEmployerPct = +document.getElementById('epfEmployerPct').value / 100;

  const monthlyTax = grossMonthlySalary * taxRatePct;
  const monthlyEpfEmployee = grossMonthlySalary * epfEmployeePct;
  const netMonthlySalary = Math.max(0, grossMonthlySalary - monthlyTax - monthlyEpfEmployee);

  document.getElementById('hintTaxAmt').textContent = `Est. Tax: ${fmt(monthlyTax)}/mth`;
  document.getElementById('hintEpfAmt').textContent = `Est. EPF: ${fmt(monthlyEpfEmployee)}/mth`;
  document.getElementById('outNetSalary').value = Math.round(netMonthlySalary).toLocaleString('en-US');

  // Savings Rates applied directly to Net Salary
  const monthlySavingsPct = +document.getElementById('monthlySavingsPct').value / 100;
  const monthlySavingsAmt = netMonthlySalary * monthlySavingsPct;
  document.getElementById('hintMonthlySavingsAmt').textContent = `Est. Savings: ${fmt(monthlySavingsAmt)}/mth`;

  const annualBonusMonths = +document.getElementById('annualBonusMonths').value;
  const bonusSavedPct = +document.getElementById('bonusSavedPct').value / 100;
  const salaryIncrement = +document.getElementById('salaryIncrement').value / 100;
  const cashReturnRate = +document.getElementById('cashReturnRate').value / 100;

  const purchaseAge = +document.getElementById('purchaseAge').value;
  const propPrice = rawNum(document.getElementById('targetPrice').value);
  const dpPct = +document.getElementById('dp').value;
  const epfAmt = rawNum(document.getElementById('epfAmt').value);
  const renoPct = +document.getElementById('renovationPct').value / 100;

  const isForeigner = (sessionStorage.getItem('shared_citizenStatus') === 'foreigner');
  const firstTimer = (sessionStorage.getItem('shared_firstTimer') === 'true');
  const sameLawyer = (sessionStorage.getItem('shared_sameLawyer') !== 'false');
  const valuationWaived = (sessionStorage.getItem('shared_valuationWaived') === 'true');

  const totalEntryCash = calculateExactTotalCash(propPrice, dpPct, epfAmt, renoPct, isForeigner, firstTimer, sameLawyer, valuationWaived);
  document.getElementById('outTotalEntryCash').value = Math.round(totalEntryCash).toLocaleString('en-US');

  const currentEpf = rawNum(document.getElementById('currentEpf').value);
  const currentCash = rawNum(document.getElementById('currentCash').value);
  const epfDividendRate = +document.getElementById('epfDividend').value / 100;

  const monthlyRetirementExpense = rawNum(document.getElementById('retirementExpense').value);
  const annualExpense = monthlyRetirementExpense * 12;
  const fireTarget = annualExpense * 25; // 25x rule

  document.getElementById('hintAnnualExpense').textContent = `Annual expense: ${fmt(annualExpense)}/year`;
  document.getElementById('targetFireAmount').value = fireTarget.toLocaleString('en-US');

  document.getElementById('lblEpfTarget').textContent = `EPF Balance at Age ${targetAge}`;
  document.getElementById('lblCashTarget').textContent = `Cash & Liquid Savings at Age ${targetAge}`;
  document.getElementById('lblNetWorthTarget').textContent = `Total Net Worth at Age ${targetAge}`;

  // -------------------------------------------------------------
  // SIMULATION 1: Primary Simulation (Target Projection Age Output)
  // -------------------------------------------------------------
  let epfBalance = currentEpf;
  let cashBalance = currentCash;
  let currMonthlySalary = grossMonthlySalary;

  const yearsToSimulate = Math.max(0, targetAge - currentAge);

  for (let y = 0; y < yearsToSimulate; y++) {
    const simAgeNow = currentAge + y;

    // Deduct property entry cash at exact purchase age
    if (simAgeNow === purchaseAge) {
      cashBalance -= totalEntryCash;
    }

    // EPF Contributions & Growth
    const monthlyEpfContrib = currMonthlySalary * (epfEmployeePct + epfEmployerPct);
    epfBalance = (epfBalance + monthlyEpfContrib * 12) * (1 + epfDividendRate);

    // Liquid Cash Savings & Growth
    const currNetSalary = currMonthlySalary * (1 - taxRatePct - epfEmployeePct);
    const yearlyMonthlySavings = (currNetSalary * monthlySavingsPct) * 12;

    // Net Bonus Savings
    const currNetBonus = (currMonthlySalary * annualBonusMonths) * (1 - taxRatePct - epfEmployeePct);
    const yearlyBonusSavings = currNetBonus * bonusSavedPct;

    cashBalance = (cashBalance + yearlyMonthlySavings + yearlyBonusSavings) * (1 + cashReturnRate);

    currMonthlySalary *= (1 + salaryIncrement);
  }

  document.getElementById('outEpfTotal').textContent = fmt(epfBalance);
  document.getElementById('outCashTotal').textContent = fmt(cashBalance);
  
  const totalNetWorth = epfBalance + cashBalance;
  document.getElementById('outNetWorthTotal').textContent = fmt(totalNetWorth);

  // -------------------------------------------------------------
  // SIMULATION 2: Dual-Path FIRE Target Calculation
  // -------------------------------------------------------------
  function findFireAge(withHomePurchase) {
    let sEpf = currentEpf;
    let sCash = currentCash;
    let sSalary = grossMonthlySalary;
    let sAge = currentAge;
    const maxAge = 100;

    while (sAge < maxAge) {
      if ((sEpf + sCash) >= fireTarget) {
        return sAge;
      }

      if (withHomePurchase && sAge === purchaseAge) {
        sCash -= totalEntryCash;
      }

      const mEpf = sSalary * (epfEmployeePct + epfEmployerPct);
      sEpf = (sEpf + mEpf * 12) * (1 + epfDividendRate);

      const sNet = sSalary * (1 - taxRatePct - epfEmployeePct);
      const ySav = (sNet * monthlySavingsPct) * 12;

      const sBon = (sSalary * annualBonusMonths) * (1 - taxRatePct - epfEmployeePct);
      const yBon = sBon * bonusSavedPct;
      sCash = (sCash + ySav + yBon) * (1 + cashReturnRate);

      sSalary *= (1 + salaryIncrement);
      sAge++;
    }
    return null;
  }

  const fireAgeWithHome = findFireAge(true);
  const fireAgeWithoutHome = findFireAge(false);

  // -------------------------------------------------------------
  // RENDER DYNAMIC FIRE IMPACT STATUS BOX
  // -------------------------------------------------------------
  const statusBox = document.getElementById('fireStatusBox');
  
  let html = '';

  if (fireAgeWithHome !== null) {
    const delayYears = (fireAgeWithoutHome !== null) ? (fireAgeWithHome - fireAgeWithoutHome) : 0;
    
    html += `
      <span class="pass">✓ Projected FIRE Age with Home Purchase: <b>Age ${fireAgeWithHome}</b></span><br>
    `;

    if (delayYears > 0) {
      html += `
        <div style="margin-top:6px; color:#D97706; font-weight:600;">
          ⚠ Buying this property delays your FIRE target by ${delayYears} year${delayYears > 1 ? 's' : ''} (without home purchase: Age ${fireAgeWithoutHome}).
        </div>
      `;
    } else {
      html += `
        <div style="margin-top:6px; color:#2F6B4F;">
          ★ Buying this property does not delay your FIRE target age compared to renting!
        </div>
      `;
    }

    html += `
      <div class="breakdown-list" style="margin-top:10px;">
        • <b>Take-Home Savings Basis:</b> Savings are calculated off <b>${fmt(netMonthlySalary)}/mth</b> net take-home salary.<br>
        • <b>Upfront Cash Consumption:</b> <b>${fmt(totalEntryCash)}</b> will be deducted from savings at Age ${purchaseAge}.<br>
        • <b>Projected Net Worth at Age ${targetAge}:</b> <b>${fmt(totalNetWorth)}</b> (${((totalNetWorth / fireTarget) * 100).toFixed(0)}% of your 25x target).<br>
        • <b>Asset Allocation:</b> ${((epfBalance / totalNetWorth) * 100).toFixed(0)}% in EPF vs ${((cashBalance / totalNetWorth) * 100).toFixed(0)}% Liquid Cash.
      </div>
    `;
  } else {
    html += `
      <span class="fail">✕ FIRE Target Unreachable Under Current Assumptions</span><br>
      Deducting <b>${fmt(totalEntryCash)}</b> at Age ${purchaseAge} prevents reaching the 25x retirement target (<b>${fmt(fireTarget)}</b>) before Age 100. Consider raising your monthly savings rate or extending your target purchase age.
    `;
  }

  statusBox.innerHTML = html;
  saveData();
}

loadSavedData();
onInput();
