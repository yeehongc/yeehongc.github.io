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

function onInput() {
  const currentAge = +document.getElementById('currentAge').value;
  const targetAge = +document.getElementById('targetAge').value;
  const grossMonthlySalary = rawNum(document.getElementById('monthlySalary').value);
  
  const monthlySavingsPct = +document.getElementById('monthlySavingsPct').value / 100;
  const annualBonusMonths = +document.getElementById('annualBonusMonths').value;
  const bonusSavedPct = +document.getElementById('bonusSavedPct').value / 100;
  const salaryIncrement = +document.getElementById('salaryIncrement').value / 100;
  const cashReturnRate = +document.getElementById('cashReturnRate').value / 100;

  const currentEpf = rawNum(document.getElementById('currentEpf').value);
  const currentCash = rawNum(document.getElementById('currentCash').value);
  const epfDividendRate = +document.getElementById('epfDividend').value / 100;
  
  const epfEmployeePct = +document.getElementById('epfEmployeePct').value / 100;
  let epfEmployerPct = +document.getElementById('epfEmployerPct').value / 100;

  const monthlyRetirementExpense = rawNum(document.getElementById('retirementExpense').value);
  const annualExpense = monthlyRetirementExpense * 12;
  const fireTarget = annualExpense * 25; // 25x rule

  document.getElementById('hintAnnualExpense').textContent = `Annual expense: ${fmt(annualExpense)}/year`;
  document.getElementById('targetFireAmount').value = fireTarget.toLocaleString('en-US');

  document.getElementById('lblEpfTarget').textContent = `EPF Balance at Age ${targetAge}`;
  document.getElementById('lblCashTarget').textContent = `Cash & Liquid Savings at Age ${targetAge}`;
  document.getElementById('lblNetWorthTarget').textContent = `Total Net Worth at Age ${targetAge}`;

  // Simulation engine
  let epfBalance = currentEpf;
  let cashBalance = currentCash;
  let currMonthlySalary = grossMonthlySalary;

  const yearsToSimulate = Math.max(0, targetAge - currentAge);
  
  // Track age of retirement achievement
  let fireAge = null;

  for (let y = 0; y < yearsToSimulate; y++) {
    // 1. Calculate yearly EPF contributions
    const monthlyEpfContrib = currMonthlySalary * (epfEmployeePct + epfEmployerPct);
    const yearlyEpfContrib = monthlyEpfContrib * 12;
    epfBalance = (epfBalance + yearlyEpfContrib) * (1 + epfDividendRate);

    // 2. Calculate yearly liquid cash savings from salary & bonus
    const yearlyMonthlySavings = (currMonthlySalary * monthlySavingsPct) * 12;
    const yearlyBonus = currMonthlySalary * annualBonusMonths;
    const yearlyBonusSavings = yearlyBonus * bonusSavedPct;
    
    cashBalance = (cashBalance + yearlyMonthlySavings + yearlyBonusSavings) * (1 + cashReturnRate);

    // 3. Salary increment for next year
    currMonthlySalary *= (1 + salaryIncrement);
  }

  document.getElementById('outEpfTotal').textContent = fmt(epfBalance);
  document.getElementById('outCashTotal').textContent = fmt(cashBalance);
  
  const totalNetWorth = epfBalance + cashBalance;
  document.getElementById('outNetWorthTotal').textContent = fmt(totalNetWorth);

  // Secondary simulation to find exact age where 25x retirement amount is hit
  let simEpf = currentEpf;
  let simCash = currentCash;
  let simSalary = grossMonthlySalary;
  let simAge = currentAge;
  const maxSimAge = 100;

  while (simAge < maxSimAge) {
    const totalCurrent = simEpf + simCash;
    if (totalCurrent >= fireTarget && fireAge === null) {
      fireAge = simAge;
      break;
    }

    const monthlyEpfContrib = simSalary * (epfEmployeePct + epfEmployerPct);
    simEpf = (simEpf + monthlyEpfContrib * 12) * (1 + epfDividendRate);

    const yearlyMonthlySavings = (simSalary * monthlySavingsPct) * 12;
    const yearlyBonusSavings = (simSalary * annualBonusMonths) * bonusSavedPct;
    simCash = (simCash + yearlyMonthlySavings + yearlyBonusSavings) * (1 + cashReturnRate);

    simSalary *= (1 + salaryIncrement);
    simAge++;
  }

  const statusBox = document.getElementById('fireStatusBox');
  if (fireAge !== null && fireAge <= targetAge) {
    statusBox.innerHTML = `
      <span class="pass">✓ FIRE Target Met at Age ${fireAge}!</span><br>
      Your projected net worth hits the 25x retirement target (<b>${fmt(fireTarget)}</b>) at <b>Age ${fireAge}</b>.
      <div class="breakdown-list">
        • Projected Net Worth at Age ${targetAge}: <b>${fmt(totalNetWorth)}</b><br>
        • EPF Portion: <b>${fmt(epfBalance)}</b> (${((epfBalance/totalNetWorth)*100).toFixed(0)}%)<br>
        • Liquid Cash Portion: <b>${fmt(cashBalance)}</b> (${((cashBalance/totalNetWorth)*100).toFixed(0)}%)
      </div>
    `;
  } else if (fireAge !== null) {
    statusBox.innerHTML = `
      <span class="warn">! Reaching Retirement Target at Age ${fireAge}</span><br>
      At your target age of <b>${targetAge}</b>, your projected net worth is <b>${fmt(totalNetWorth)}</b> (reaching <b>${((totalNetWorth/fireTarget)*100).toFixed(0)}%</b> of your 25x target).
      <div class="breakdown-list">
        • Required 25x Target: <b>${fmt(fireTarget)}</b><br>
        • Age to Reach 100% Target: <b>Age ${fireAge}</b>
      </div>
    `;
  } else {
    statusBox.innerHTML = `
      <span class="fail">✕ Target Unreachable Under Current Parameters</span><br>
      Consider increasing monthly savings %, bonus allocation %, or expected investment yield to reach your 25x benchmark (<b>${fmt(fireTarget)}</b>).
    `;
  }

  saveData();
}

loadSavedData();
onInput();