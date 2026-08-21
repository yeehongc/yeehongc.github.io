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

let mode = 'forward';

function setMode(m) {
  mode = m;
  document.getElementById('tabForward').classList.toggle('active', m === 'forward');
  document.getElementById('tabReverse').classList.toggle('active', m === 'reverse');
  document.getElementById('priceField').style.display = m === 'forward' ? 'block' : 'none';
  document.getElementById('repayField').style.display = m === 'reverse' ? 'block' : 'none';
  document.getElementById('reversePriceStat').style.display = m === 'reverse' ? 'block' : 'none';
  document.getElementById('outMonthlyLabel').textContent = m === 'forward' ? 'Monthly repayment' : 'Monthly repayment (input)';
  onInput();
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
  if (isForeigner) return price * 0.08;
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

function setVal(id, value) {
  document.getElementById(id).textContent = fmt(value);
}

function setExempt(nameId, exempt, label) {
  document.getElementById(nameId).innerHTML = label + (exempt ? '<span class="exempt-tag">EXEMPT</span>' : '');
}

function onInput() {
  const dp = +document.getElementById('dp').value;
  const rate = +document.getElementById('rate').value;
  let duration = +document.getElementById('duration').value;
  const age = +document.getElementById('age').value;
  const income = rawNum(document.getElementById('income').value);
  const epfWithdrawal = rawNum(document.getElementById('epfWithdrawal').value);
  const renoPct = +document.getElementById('renovationPct').value / 100;

  const isForeigner = document.getElementById('citizenStatus').value === 'foreigner';
  const firstTimer = document.getElementById('firstTimer').checked && !isForeigner;
  const sameLawyer = document.getElementById('sameLawyer').checked;
  const valuationWaived = document.getElementById('valuationWaived').checked;

  const maxTenure = Math.max(1, 70 - age);
  const warnEl = document.getElementById('tenureWarn');
  if (duration > maxTenure) {
    warnEl.style.display = 'block';
    warnEl.textContent = `Capped at ${maxTenure} yrs (loan ending by age 70).`;
    duration = maxTenure;
    document.getElementById('duration').value = maxTenure;
  } else {
    warnEl.style.display = 'none';
  }

  const r = (rate / 100) / 12;
  const n = duration * 12;

  let principal, monthly, totalInterest, price;

  if (mode === 'forward') {
    price = rawNum(document.getElementById('price').value);
    principal = price * (1 - dp / 100);
    monthly = r === 0 ? principal / n : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    totalInterest = monthly * n - principal;
  } else {
    monthly = rawNum(document.getElementById('affordRepay').value);
    principal = r === 0 ? monthly * n : monthly * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
    totalInterest = monthly * n - principal;
    price = principal / (1 - dp / 100);
    document.getElementById('outPrice').textContent = fmt(price);
  }

  document.getElementById('outPrincipal').textContent = fmt(principal);
  document.getElementById('outInterest').textContent = fmt(totalInterest);
  document.getElementById('outMonthly').textContent = fmt(monthly);

  const monthlyIncome = income / 12;
  const ratio = monthlyIncome > 0 ? (monthly / monthlyIncome) * 100 : 0;
  const box = document.getElementById('affordBox');
  let cls = 'ok', msg = 'comfortably within what most banks look for';
  if (ratio > 70) { cls = 'bad'; msg = 'above the ~70% total debt-servicing range most Malaysian banks look for'; }
  else if (ratio > 50) { cls = 'caution'; msg = 'within range but on the higher side'; }
  
  if (monthlyIncome > 0) {
    box.innerHTML = `Monthly repayment is <b class="${cls}">${ratio.toFixed(1)}%</b> of your monthly income (${fmt(monthlyIncome)}) — ${msg}.`;
  } else {
    box.innerHTML = `Enter an annual income above to see how this repayment compares to your income.`;
  }

  document.getElementById('f1').innerHTML = mode === 'forward'
    ? `Principal (P)  =  Property price × (1 − Down payment %)\n              =  ${fmt(price)} × ${(100 - dp)}%  =  <span class="plug">${fmt(principal)}</span>`
    : `P  =  M × [(1+r)ⁿ − 1] / [r(1+r)ⁿ]   (solved from your affordable repayment)`;
  document.getElementById('f2').textContent = `r (monthly rate)  =  ${rate.toFixed(2)}% / 12  =  ${(r * 100).toFixed(4)}%`;
  document.getElementById('f3').textContent = `n (instalments)   =  ${duration} yrs × 12  =  ${n} months`;
  document.getElementById('f4').innerHTML = mode === 'forward'
    ? `M  =  P × r(1+r)ⁿ / [(1+r)ⁿ − 1]  =  <span class="plug">${fmt(monthly)}</span> / month`
    : `Property price  =  P / (1 − Down payment %)  =  ${fmt(principal)} / ${(100 - dp)}%  =  <span class="plug">${fmt(price)}</span>`;

  // Renovation
  const renoAmt = price * renoPct;
  document.getElementById('hintRenoRm').textContent = `${fmt(renoAmt)} total renovation budget`;
  
  // Total cash calculation
  const grossDp = price * (dp / 100);
  const netDp = Math.max(0, grossDp - epfWithdrawal);

  //const downPayment = price * (dp / 100);
  let motDuty = motStampDuty(price, isForeigner);
  let loanDuty = principal * 0.005;
  const motExempt = firstTimer && price <= 500000;
  if (motExempt) { motDuty = 0; loanDuty = 0; }

  const legalSpa = legalFeeScale(price);
  const legalSpaSst = legalSpa * 0.08;
  let legalLoan = legalFeeScale(principal);
  if (sameLawyer) legalLoan *= 0.5;
  const legalLoanSst = legalLoan * 0.08;

  const disbursements = rawNum(document.getElementById('disb').value) || 0;
  const bankFee = rawNum(document.getElementById('bankFee').value) || 0;

  let valFee = valuationWaived ? 0 : valuationFeeScale(price);
  const valSst = valFee * 0.08;

  const total = netDp + + renoAmt + motDuty + loanDuty + legalSpa + legalSpaSst + legalLoan + legalLoanSst + disbursements + valFee + valSst + bankFee;

  document.getElementById('descDp').textContent = `Property price × ${dp}%`;
  //setVal('valDp', downPayment);
  setVal('valDp', grossDp);
  document.getElementById('valEpf').textContent = `-${fmt(epfWithdrawal)}`;
  setVal('valNetDp', netDp);

  document.getElementById('descReno').textContent = `Property price × ${(renoPct * 100).toFixed(0)}%`;
  setVal('valReno', renoAmt);

  setExempt('nameMot', motExempt, 'MOT stamp duty');
  document.getElementById('descMot').textContent = isForeigner ? 'Flat 8% of property price (foreigner rate, from 1 Jan 2026)' : 'Tiered 1% / 2% / 3% / 4% on property price';
  setVal('valMot', motDuty);

  setExempt('nameLoanDuty', motExempt, 'Loan agreement stamp duty');
  setVal('valLoanDuty', loanDuty);

  setVal('valLegalSpa', legalSpa);
  setVal('valLegalSpaSst', legalSpaSst);

  document.getElementById('descLegalLoan').textContent = sameLawyer ? 'Same scale on loan amount, 50% concurrent-firm discount applied' : 'Same scale, applied to the loan amount';
  setVal('valLegalLoan', legalLoan);
  setVal('valLegalLoanSst', legalLoanSst);

  document.getElementById('descVal').textContent = valuationWaived ? 'Waived by bank' : 'Typical scale: 0.25% / 0.20% / 0.167% / 0.125% by value band (min RM300)';
  setVal('valVal', valFee);
  setVal('valValSst', valSst);

  setVal('valTotal', total);

  saveData();
}

loadSavedData();
onInput();