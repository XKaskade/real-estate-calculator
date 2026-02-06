// ===== UTILITY FUNCTIONS =====

function getVal(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const v = parseFloat(el.value);
    return isNaN(v) ? 0 : Math.round(v * 100) / 100;
}

function fmt(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDec(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function pct(n) {
    return n.toFixed(2) + '%';
}

// ===== UI HELPERS =====

function toggleSection(btn) {
    const content = btn.nextElementSibling;
    const chevron = btn.querySelector('.chevron');
    content.classList.toggle('open');
    chevron.style.transform = content.classList.contains('open') ? '' : 'rotate(180deg)';
}

// Toggle rehab section visibility
document.getElementById('rehabToggle').addEventListener('change', function () {
    document.getElementById('rehabSection').style.display = this.checked ? 'block' : 'none';
});

// Toggle income breakdown
document.getElementById('incomeBreakdownToggle').addEventListener('change', function () {
    document.getElementById('incomeBreakdown').style.display = this.checked ? 'block' : 'none';
});

// Toggle cash purchase (hides financing)
document.getElementById('cashPurchaseToggle').addEventListener('change', function () {
    document.getElementById('financingFields').style.display = this.checked ? 'none' : 'block';
});

// Sync down payment $ <-> %
document.getElementById('downPaymentPercent').addEventListener('input', function () {
    const price = getVal('purchasePrice');
    document.getElementById('downPaymentDollar').value = Math.round(price * (this.value / 100));
});

document.getElementById('downPaymentDollar').addEventListener('input', function () {
    const price = getVal('purchasePrice');
    if (price > 0) {
        document.getElementById('downPaymentPercent').value = ((this.value / price) * 100).toFixed(1);
    }
});

document.getElementById('purchasePrice').addEventListener('input', function () {
    const pctVal = getVal('downPaymentPercent');
    document.getElementById('downPaymentDollar').value = Math.round(this.value * (pctVal / 100));
});


// ===== CORE CALCULATION ENGINE =====

function gatherInputs() {
    const purchasePrice = getVal('purchasePrice');
    const closingCost = getVal('closingCost');
    const isRehab = document.getElementById('rehabToggle').checked;
    const rehabCost = isRehab ? getVal('rehabCost') : 0;
    const arv = isRehab ? getVal('arv') : purchasePrice;
    const appreciationRate = getVal('appreciationRate') / 100;

    const isCash = document.getElementById('cashPurchaseToggle').checked;
    const downPaymentPct = getVal('downPaymentPercent') / 100;
    const interestRateAnnual = getVal('interestRate') / 100;
    const loanTermYears = getVal('loanTerm');
    const loanPoints = getVal('loanPoints');

    const monthlyIncome = getVal('monthlyIncome');
    const otherIncome = getVal('otherIncome');
    const incomeGrowth = getVal('incomeGrowth') / 100;

    const propertyTaxes = getVal('propertyTaxes');
    const propertyTaxesPeriod = document.getElementById('propertyTaxesPeriod').value;
    const insurance = getVal('insurance');
    const insurancePeriod = document.getElementById('insurancePeriod').value;

    const repairsMaintenancePct = getVal('repairsMaintenance') / 100;
    const capexPct = getVal('capex') / 100;
    const vacancyPct = getVal('vacancy') / 100;
    const managementPct = getVal('managementFees') / 100;

    const electricity = getVal('electricity');
    const gas = getVal('gas');
    const waterSewer = getVal('waterSewer');
    const hoa = getVal('hoa');
    const garbageVal = getVal('garbage');
    const otherExpense = getVal('otherExpense');

    const expenseGrowth = getVal('expenseGrowth') / 100;
    const salesExpenses = getVal('salesExpenses') / 100;

    return {
        purchasePrice, closingCost, rehabCost, arv, appreciationRate,
        isCash, downPaymentPct, interestRateAnnual, loanTermYears, loanPoints,
        monthlyIncome, otherIncome, incomeGrowth,
        propertyTaxes, propertyTaxesPeriod, insurance, insurancePeriod,
        repairsMaintenancePct, capexPct, vacancyPct, managementPct,
        electricity, gas, waterSewer, hoa, garbage: garbageVal, otherExpense,
        expenseGrowth, salesExpenses
    };
}

function calculate(inputs) {
    const {
        purchasePrice, closingCost, rehabCost, arv, appreciationRate,
        isCash, downPaymentPct, interestRateAnnual, loanTermYears, loanPoints,
        monthlyIncome, otherIncome, incomeGrowth,
        propertyTaxes, propertyTaxesPeriod, insurance, insurancePeriod,
        repairsMaintenancePct, capexPct, vacancyPct, managementPct,
        electricity, gas, waterSewer, hoa, garbage, otherExpense,
        expenseGrowth, salesExpenses
    } = inputs;

    // === Down Payment & Loan ===
    const downPayment = purchasePrice * downPaymentPct;
    const loanAmount = isCash ? 0 : (purchasePrice - downPayment);
    const pointsCost = loanAmount * (loanPoints / 100);

    // === Monthly Mortgage Payment (P&I) ===
    let monthlyMortgage = 0;
    if (!isCash && loanAmount > 0 && loanTermYears > 0) {
        const r = interestRateAnnual / 12;
        const n = loanTermYears * 12;
        if (r === 0) {
            monthlyMortgage = loanAmount / n;
        } else {
            monthlyMortgage = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        }
    }

    // === Total Cash Invested ===
    const totalCashNeeded = (isCash ? purchasePrice : downPayment) + closingCost + rehabCost + pointsCost;

    // === Monthly Income ===
    const grossMonthlyIncome = monthlyIncome + otherIncome;
    const vacancyLoss = grossMonthlyIncome * vacancyPct;
    const effectiveMonthlyIncome = grossMonthlyIncome - vacancyLoss;

    // === Monthly Operating Expenses (excludes mortgage) ===
    const monthlyPropertyTaxes = propertyTaxesPeriod === 'annual' ? propertyTaxes / 12 : propertyTaxes;
    const monthlyInsurance = insurancePeriod === 'annual' ? insurance / 12 : insurance;
    const monthlyRepairs = grossMonthlyIncome * repairsMaintenancePct;
    const monthlyCapex = grossMonthlyIncome * capexPct;
    const monthlyManagement = grossMonthlyIncome * managementPct;
    const monthlyUtilities = electricity + gas + waterSewer;
    const monthlyOtherFixed = hoa + garbage + otherExpense;

    const totalMonthlyOpEx = monthlyPropertyTaxes + monthlyInsurance + monthlyRepairs +
        monthlyCapex + monthlyManagement + monthlyUtilities + monthlyOtherFixed;

    // === NOI ===
    const annualEffectiveIncome = effectiveMonthlyIncome * 12;
    const annualOpEx = totalMonthlyOpEx * 12;
    const noi = annualEffectiveIncome - annualOpEx;

    // === Cash Flow ===
    const monthlyCashFlow = effectiveMonthlyIncome - totalMonthlyOpEx - monthlyMortgage;
    const annualCashFlow = monthlyCashFlow * 12;

    // === Key Metrics ===
    const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
    const cocReturn = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;
    const annualDebtService = monthlyMortgage * 12;
    const dscr = annualDebtService > 0 ? noi / annualDebtService : Infinity;
    const oer = annualEffectiveIncome > 0 ? (annualOpEx / annualEffectiveIncome) * 100 : 0;
    const grm = (monthlyIncome * 12) > 0 ? purchasePrice / (monthlyIncome * 12) : 0;

    // === Quick Rules ===
    const onePercentRatio = purchasePrice > 0 ? (monthlyIncome / purchasePrice) * 100 : 0;
    const onePercentPass = onePercentRatio >= 1;
    const fiftyPercentEstCashFlow = (grossMonthlyIncome * 0.5) - monthlyMortgage;

    // === Pro Forma Cap Rate (based on ARV or total investment) ===
    const totalInvestment = purchasePrice + rehabCost;
    const proFormaCapRate = totalInvestment > 0 ? (noi / totalInvestment) * 100 : 0;

    // === Amortization for equity buildup ===
    function getYearEndBalance(principal, monthlyRate, totalPayments, yearNum) {
        if (monthlyRate === 0) {
            const monthlyPrincipal = principal / totalPayments;
            return principal - monthlyPrincipal * yearNum * 12;
        }
        let balance = principal;
        const paymentsToMake = Math.min(yearNum * 12, totalPayments);
        for (let i = 0; i < paymentsToMake; i++) {
            const interest = balance * monthlyRate;
            const principalPayment = monthlyMortgage - interest;
            balance -= principalPayment;
        }
        return Math.max(balance, 0);
    }

    // === 5-Year Projection ===
    const projection = [];
    const r = interestRateAnnual / 12;
    const n = loanTermYears * 12;

    for (let year = 1; year <= 5; year++) {
        const propertyValue = purchasePrice * Math.pow(1 + appreciationRate, year);
        const yearlyIncome = annualEffectiveIncome * Math.pow(1 + incomeGrowth, year - 1);
        const yearlyExpenses = annualOpEx * Math.pow(1 + expenseGrowth, year - 1);
        const yearlyMortgage = annualDebtService;
        const yearlyCashFlow = yearlyIncome - yearlyExpenses - yearlyMortgage;

        const balanceStart = isCash ? 0 : getYearEndBalance(loanAmount, r, n, year - 1);
        const balanceEnd = isCash ? 0 : getYearEndBalance(loanAmount, r, n, year);
        const equityBuildup = balanceStart - balanceEnd;
        const totalEquity = propertyValue - balanceEnd;

        const appreciation = purchasePrice * Math.pow(1 + appreciationRate, year) -
            purchasePrice * Math.pow(1 + appreciationRate, year - 1);
        const totalROI = totalCashNeeded > 0
            ? ((yearlyCashFlow + equityBuildup + appreciation) / totalCashNeeded) * 100
            : 0;

        projection.push({
            year, propertyValue, yearlyIncome, yearlyExpenses,
            yearlyMortgage, yearlyCashFlow, totalEquity, totalROI
        });
    }

    return {
        // Inputs for display
        downPayment, loanAmount, pointsCost,

        // Monthly
        monthlyMortgage, grossMonthlyIncome, vacancyLoss, effectiveMonthlyIncome,
        monthlyPropertyTaxes, monthlyInsurance, monthlyRepairs, monthlyCapex,
        monthlyManagement, monthlyUtilities, monthlyOtherFixed,
        totalMonthlyOpEx, monthlyCashFlow,

        // Annual
        annualCashFlow, noi, annualDebtService,

        // Metrics
        capRate, cocReturn, dscr, oer, grm, totalCashNeeded,
        onePercentRatio, onePercentPass, fiftyPercentEstCashFlow,
        proFormaCapRate,

        // Projection
        projection
    };
}


// ===== RENDER RESULTS =====

function calculateAll() {
    const inputs = gatherInputs();
    const results = calculate(inputs);
    renderResults(inputs, results);
    document.getElementById('results').style.display = 'block';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });

    // Build sensitivity analysis with base inputs
    buildSensitivity(inputs);
}

function renderResults(inputs, r) {
    // 1% Rule
    document.getElementById('rule1value').textContent = r.onePercentRatio.toFixed(2) + '%';
    const rule1status = document.getElementById('rule1status');
    rule1status.textContent = r.onePercentPass ? 'PASSES' : 'DOES NOT PASS';
    rule1status.className = 'rule-status ' + (r.onePercentPass ? 'pass' : 'fail');
    document.getElementById('rule1percent').style.borderLeft = `4px solid ${r.onePercentPass ? 'var(--positive)' : 'var(--negative)'}`;

    // 50% Rule
    document.getElementById('rule50value').textContent = fmtDec(r.fiftyPercentEstCashFlow);
    document.getElementById('rule50percent').style.borderLeft = `4px solid ${r.fiftyPercentEstCashFlow >= 0 ? 'var(--positive)' : 'var(--negative)'}`;

    // GRM
    document.getElementById('grmValue').textContent = r.grm > 0 ? r.grm.toFixed(1) : 'N/A';

    // Key Metrics
    setCashMetric('cocReturn', r.cocReturn, true);
    setCashMetric('monthlyCashFlow', r.monthlyCashFlow, false, true);
    document.getElementById('capRate').textContent = pct(r.capRate);
    document.getElementById('noiValue').textContent = fmt(r.noi);
    document.getElementById('dscrValue').textContent = r.dscr === Infinity ? 'N/A (No Debt)' : r.dscr.toFixed(2);
    document.getElementById('oerValue').textContent = pct(r.oer);
    document.getElementById('totalCashNeeded').textContent = fmt(r.totalCashNeeded);
    document.getElementById('monthlyMortgage').textContent = inputs.isCash ? '$0 (Cash)' : fmtDec(r.monthlyMortgage);

    // Income Breakdown
    const incBody = document.getElementById('incomeBreakdownTable');
    incBody.innerHTML = `
        <tr><td>Gross Monthly Rent</td><td>${fmtDec(inputs.monthlyIncome)}</td></tr>
        ${inputs.otherIncome > 0 ? `<tr><td>Other Income</td><td>${fmtDec(inputs.otherIncome)}</td></tr>` : ''}
        <tr><td>Vacancy Loss (${(inputs.vacancyPct * 100).toFixed(1)}%)</td><td class="negative">-${fmtDec(r.vacancyLoss)}</td></tr>
    `;
    document.getElementById('totalEffectiveIncome').textContent = fmtDec(r.effectiveMonthlyIncome);

    // Expense Breakdown
    const expBody = document.getElementById('expenseBreakdownTable');
    expBody.innerHTML = `
        <tr><td>Property Taxes</td><td>${fmtDec(r.monthlyPropertyTaxes)}</td></tr>
        <tr><td>Insurance</td><td>${fmtDec(r.monthlyInsurance)}</td></tr>
        <tr><td>Repairs & Maintenance (${(inputs.repairsMaintenancePct * 100).toFixed(1)}%)</td><td>${fmtDec(r.monthlyRepairs)}</td></tr>
        <tr><td>Capital Expenditures (${(inputs.capexPct * 100).toFixed(1)}%)</td><td>${fmtDec(r.monthlyCapex)}</td></tr>
        <tr><td>Management Fees (${(inputs.managementPct * 100).toFixed(1)}%)</td><td>${fmtDec(r.monthlyManagement)}</td></tr>
        <tr><td>Electricity</td><td>${fmtDec(inputs.electricity)}</td></tr>
        <tr><td>Gas</td><td>${fmtDec(inputs.gas)}</td></tr>
        <tr><td>Water & Sewer</td><td>${fmtDec(inputs.waterSewer)}</td></tr>
        <tr><td>HOA Fees</td><td>${fmtDec(inputs.hoa)}</td></tr>
        <tr><td>Garbage</td><td>${fmtDec(inputs.garbage)}</td></tr>
        <tr><td>Other</td><td>${fmtDec(inputs.otherExpense)}</td></tr>
    `;
    document.getElementById('totalMonthlyExpenses').textContent = fmtDec(r.totalMonthlyOpEx);

    // Cash Flow Summary
    document.getElementById('cfIncome').textContent = fmtDec(r.effectiveMonthlyIncome);
    document.getElementById('cfExpenses').textContent = '-' + fmtDec(r.totalMonthlyOpEx);
    document.getElementById('cfExpenses').className = 'negative';
    document.getElementById('cfMortgage').textContent = '-' + fmtDec(r.monthlyMortgage);
    document.getElementById('cfMortgage').className = 'negative';

    const cfNet = document.getElementById('cfNet');
    cfNet.textContent = fmtDec(r.monthlyCashFlow);
    cfNet.className = r.monthlyCashFlow >= 0 ? 'positive' : 'negative';

    const cfAnnual = document.getElementById('cfAnnual');
    cfAnnual.textContent = fmtDec(r.annualCashFlow);
    cfAnnual.className = r.annualCashFlow >= 0 ? 'positive' : 'negative';

    // 5-Year Projection
    const projBody = document.getElementById('projectionTable');
    projBody.innerHTML = r.projection.map(p => `
        <tr>
            <td>${p.year}</td>
            <td>${fmt(p.propertyValue)}</td>
            <td>${fmt(p.yearlyIncome)}</td>
            <td>${fmt(p.yearlyExpenses)}</td>
            <td>${fmt(p.yearlyMortgage)}</td>
            <td class="${p.yearlyCashFlow >= 0 ? 'positive' : 'negative'}">${fmt(p.yearlyCashFlow)}</td>
            <td>${fmt(p.totalEquity)}</td>
            <td class="${p.totalROI >= 0 ? 'positive' : 'negative'}">${pct(p.totalROI)}</td>
        </tr>
    `).join('');
}

function setCashMetric(id, value, isPercent, isCurrency) {
    const el = document.getElementById(id);
    el.textContent = isPercent ? pct(value) : (isCurrency ? fmtDec(value) : value);
    el.className = 'metric-value ' + (value >= 0 ? 'positive' : 'negative');
}


// ===== SENSITIVITY ANALYSIS =====

let currentSensVariable = 'purchasePrice';

function showSensitivity(variable, btn) {
    currentSensVariable = variable;
    document.querySelectorAll('.sens-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    buildSensitivity(gatherInputs());
}

function buildSensitivity(baseInputs) {
    buildOneVariableSensitivity(baseInputs);
    buildTwoVariableMatrix(baseInputs);
}

function buildOneVariableSensitivity(baseInputs) {
    const configs = {
        purchasePrice: {
            label: 'Purchase Price',
            key: 'purchasePrice',
            steps: [-20, -15, -10, -5, 0, 5, 10, 15, 20],
            format: (base, stepPct) => {
                const val = base * (1 + stepPct / 100);
                return { display: fmt(val) + ` (${stepPct > 0 ? '+' : ''}${stepPct}%)`, value: val };
            }
        },
        rent: {
            label: 'Monthly Rent',
            key: 'monthlyIncome',
            steps: [-15, -10, -5, 0, 5, 10, 15],
            format: (base, stepPct) => {
                const val = base * (1 + stepPct / 100);
                return { display: fmt(val) + ` (${stepPct > 0 ? '+' : ''}${stepPct}%)`, value: val };
            }
        },
        interestRate: {
            label: 'Interest Rate',
            key: 'interestRateAnnual',
            steps: [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5],
            format: (base, stepAbs) => {
                const val = base + stepAbs / 100;
                return { display: (val * 100).toFixed(1) + '%' + ` (${stepAbs > 0 ? '+' : ''}${stepAbs}%)`, value: val };
            }
        },
        vacancy: {
            label: 'Vacancy Rate',
            key: 'vacancyPct',
            steps: [0, 3, 5, 8, 10, 15],
            format: (_base, stepAbs) => {
                return { display: stepAbs + '%', value: stepAbs / 100 };
            },
            absolute: true
        },
        expenses: {
            label: 'Total OpEx Change',
            key: 'expenseMultiplier',
            steps: [-20, -10, 0, 10, 20, 30],
            format: (_base, stepPct) => {
                return { display: (stepPct > 0 ? '+' : '') + stepPct + '%', value: 1 + stepPct / 100 };
            }
        }
    };

    const config = configs[currentSensVariable];
    const baseResult = calculate(baseInputs);

    const thead = document.getElementById('sensitivityHead');
    thead.innerHTML = `<tr>
        <th>${config.label}</th>
        <th>Monthly Payment</th>
        <th>Monthly Cash Flow</th>
        <th>Annual Cash Flow</th>
        <th>CoC Return</th>
        <th>Cap Rate</th>
    </tr>`;

    const tbody = document.getElementById('sensitivityBody');
    tbody.innerHTML = '';

    config.steps.forEach(step => {
        const modified = { ...baseInputs };
        let formatted;

        if (config.key === 'expenseMultiplier') {
            formatted = config.format(null, step);
            // Apply multiplier to all expense-related fields
            modified.propertyTaxes = baseInputs.propertyTaxes * formatted.value;
            modified.insurance = baseInputs.insurance * formatted.value;
            modified.electricity = baseInputs.electricity * formatted.value;
            modified.gas = baseInputs.gas * formatted.value;
            modified.waterSewer = baseInputs.waterSewer * formatted.value;
            modified.hoa = baseInputs.hoa * formatted.value;
            modified.garbage = baseInputs.garbage * formatted.value;
            modified.otherExpense = baseInputs.otherExpense * formatted.value;
        } else if (config.key === 'interestRateAnnual') {
            formatted = config.format(baseInputs.interestRateAnnual, step);
            modified.interestRateAnnual = Math.max(formatted.value, 0);
        } else if (config.key === 'vacancyPct') {
            formatted = config.format(baseInputs.vacancyPct, step);
            modified.vacancyPct = formatted.value;
        } else if (config.key === 'purchasePrice') {
            formatted = config.format(baseInputs[config.key], step);
            modified.purchasePrice = formatted.value;
            // Recalculate down payment dollar amount based on same percentage
            modified.downPaymentPct = baseInputs.downPaymentPct;
        } else {
            formatted = config.format(baseInputs[config.key], step);
            modified[config.key] = formatted.value;
        }

        const r = calculate(modified);
        const isBase = (config.absolute && step === baseInputs.vacancyPct * 100) ||
            (!config.absolute && step === 0);

        const tr = document.createElement('tr');
        if (isBase) tr.classList.add('base-row');
        tr.innerHTML = `
            <td class="${isBase ? 'base-row' : ''}">${formatted.display}${isBase ? ' (base)' : ''}</td>
            <td class="${isBase ? 'base-row' : ''}">${fmtDec(r.monthlyMortgage)}</td>
            <td class="${isBase ? 'base-row' : ''} ${r.monthlyCashFlow >= 0 ? 'positive' : 'negative'}">${fmtDec(r.monthlyCashFlow)}</td>
            <td class="${isBase ? 'base-row' : ''} ${r.annualCashFlow >= 0 ? 'positive' : 'negative'}">${fmtDec(r.annualCashFlow)}</td>
            <td class="${isBase ? 'base-row' : ''} ${r.cocReturn >= 0 ? 'positive' : 'negative'}">${pct(r.cocReturn)}</td>
            <td class="${isBase ? 'base-row' : ''}">${pct(r.capRate)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Mark vacancy base row
    if (currentSensVariable === 'vacancy') {
        const baseVac = baseInputs.vacancyPct * 100;
        const rows = tbody.querySelectorAll('tr');
        const steps = configs.vacancy.steps;
        steps.forEach((s, i) => {
            if (s === baseVac && rows[i]) {
                rows[i].querySelectorAll('td').forEach(td => td.classList.add('base-row'));
            }
        });
    }
}

function buildTwoVariableMatrix(baseInputs) {
    const priceSteps = [-15, -10, -5, 0, 5, 10, 15];
    const rentSteps = [-15, -10, -5, 0, 5, 10, 15];

    const thead = document.getElementById('matrixHead');
    thead.innerHTML = `<tr>
        <th>Price \\ Rent</th>
        ${rentSteps.map(rs => `<th>Rent ${rs > 0 ? '+' : ''}${rs}%</th>`).join('')}
    </tr>`;

    const tbody = document.getElementById('matrixBody');
    tbody.innerHTML = '';

    priceSteps.forEach(ps => {
        const tr = document.createElement('tr');
        const priceVal = baseInputs.purchasePrice * (1 + ps / 100);
        let rowHtml = `<td style="font-weight:600; text-align:left;">Price ${ps > 0 ? '+' : ''}${ps}%</td>`;

        rentSteps.forEach(rs => {
            const modified = { ...baseInputs };
            modified.purchasePrice = priceVal;
            modified.monthlyIncome = baseInputs.monthlyIncome * (1 + rs / 100);

            const r = calculate(modified);
            const isBase = ps === 0 && rs === 0;
            const cellClass = isBase ? 'base-cell' : (r.cocReturn >= 0 ? 'cell-positive' : 'cell-negative');
            const textClass = r.cocReturn >= 0 ? 'positive' : 'negative';

            rowHtml += `<td class="${cellClass} ${textClass}">${pct(r.cocReturn)}</td>`;
        });

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });
}


// ===== INITIALIZE =====
// Run calculations on page load if values present
document.addEventListener('DOMContentLoaded', function () {
    // Set initial down payment sync
    const price = getVal('purchasePrice');
    const pctVal = getVal('downPaymentPercent');
    document.getElementById('downPaymentDollar').value = Math.round(price * (pctVal / 100));
});
