// --- Toast Notifications ---

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const bgClass = type === 'success' ? 'bg-success text-white' : (type === 'danger' ? 'bg-danger text-white' : 'bg-primary text-white');

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center border-0 ${bgClass}`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

// Childcare Tracker Application

// --- Local Storage Wrappers ---

function getCustomers() {
    return JSON.parse(localStorage.getItem('customers')) || [];
}

function saveCustomers(customers) {
    localStorage.setItem('customers', JSON.stringify(customers));
}

function getPayments() {
    return JSON.parse(localStorage.getItem('payments')) || [];
}

function savePayments(payments) {
    localStorage.setItem('payments', JSON.stringify(payments));
}

function getClosedDays() {
    return JSON.parse(localStorage.getItem('closedDays')) || [];
}

function saveClosedDays(days) {
    localStorage.setItem('closedDays', JSON.stringify(days));
}

// --- Customer Management ---

function openCustomerModal(id = null) {
    const form = document.getElementById('customer-form');
    form.reset();
    document.getElementById('customerId').value = '';
    const deleteBtn = document.getElementById('deleteCustomerBtn');
    deleteBtn.classList.add('d-none');
    deleteBtn.onclick = null;

    if (id) {
        const customers = getCustomers();
        const customer = customers.find(c => c.id === id);
        if (customer) {
            document.getElementById('customerId').value = customer.id;
            document.getElementById('parentName').value = customer.parentName;
            document.getElementById('childName').value = customer.childName;
            document.getElementById('startDate').value = customer.startDate;
            document.getElementById('endDate').value = customer.endDate || '';

            // Support backward compatibility
            const rate = customer.rateAmount || customer.weeklyRate || 50.00;
            const freq = customer.paymentFrequency || 'weekly';
            document.getElementById('rateAmount').value = rate.toFixed(2);
            document.getElementById('paymentFrequency').value = freq;

            deleteBtn.classList.remove('d-none');
            deleteBtn.onclick = () => deleteCustomer(id);
        }
    }
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMondayOfDateString(dateStr) {
    // Treat dateStr 'YYYY-MM-DD' as local
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = date.getDay();
    // Monday is 1, Sunday is 0. If Sunday, subtract 6 days. Else subtract dayOfWeek - 1
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return getLocalDateString(monday);
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

function handleCustomerSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('customerId').value;
    const parentName = document.getElementById('parentName').value;
    const childName = document.getElementById('childName').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const rateAmount = parseFloat(document.getElementById('rateAmount').value) || 0.00;
    const paymentFrequency = document.getElementById('paymentFrequency').value;

    const customers = getCustomers();

    if (id) {
        // Edit existing customer
        const index = customers.findIndex(c => c.id === id);
        if (index > -1) {
            customers[index] = { ...customers[index], parentName, childName, startDate, endDate, rateAmount, paymentFrequency };
        }
        showToast('Customer updated successfully!');
    } else {
        // Add new customer
        const newCustomer = {
            id: Date.now().toString(),
            parentName,
            childName,
            startDate,
            endDate,
            rateAmount,
            paymentFrequency,
            creditBalance: 0
        };
        customers.push(newCustomer);
        showToast('Customer added successfully!');
    }

    saveCustomers(customers);

    // Close modal
    const modalEl = document.getElementById('customerModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    renderCustomers();
    // Re-generate payments just in case dates changed
    generatePayments();
}

function deleteCustomer(id) {
    if (confirm("Are you sure you want to delete this customer? All their associated payments will also be deleted.")) {
        let customers = getCustomers();
        customers = customers.filter(c => c.id !== id);
        saveCustomers(customers);

        let payments = getPayments();
        payments = payments.filter(p => p.customerId !== id);
        savePayments(payments);

        // Close modal
        const modalEl = document.getElementById('customerModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        renderCustomers();
        renderDuePayments();
        showToast('Customer deleted.', 'danger');
    }
}

function populateDuePaymentsFilter(customers) {
    const filterSelect = document.getElementById('duePaymentsFilter');
    const historySelect = document.getElementById('historyPaymentsFilter');

    // Save current selections to restore them if possible
    const currentVal = filterSelect.value;
    const currentHistoryVal = historySelect.value;

    filterSelect.innerHTML = '<option value="">All Customers</option>';
    historySelect.innerHTML = '<option value="">All Customers</option>';

    customers.forEach(c => {
        const option1 = document.createElement('option');
        option1.value = c.id;
        option1.textContent = `${c.childName} (${c.parentName})`;
        filterSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = c.id;
        option2.textContent = `${c.childName} (${c.parentName})`;
        historySelect.appendChild(option2);
    });

    // Restore previous selection if it still exists
    if (currentVal && customers.find(c => c.id === currentVal)) {
        filterSelect.value = currentVal;
    }
    if (currentHistoryVal && customers.find(c => c.id === currentHistoryVal)) {
        historySelect.value = currentHistoryVal;
    }
}

function renderCustomers() {
    const list = document.getElementById('customers-list');
    const customers = getCustomers();
    list.innerHTML = '';

    // Update the dropdown filter with current customers
    populateDuePaymentsFilter(customers);

    if (customers.length === 0) {
        list.innerHTML = '<p class="text-muted">No customers added yet.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-group';
    customers.forEach(customer => {
        const creditDisplay = (customer.creditBalance && customer.creditBalance > 0)
            ? `<br><small class="text-success fw-bold">Credit Balance: $${customer.creditBalance.toFixed(2)}</small>`
            : '';

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div>
                <strong>${customer.childName}</strong> (Parent: ${customer.parentName})<br>
                <small class="text-muted">Rate: $${(customer.rateAmount || customer.weeklyRate || 50.00).toFixed(2)} / ${customer.paymentFrequency || 'weekly'} | Start: ${formatDisplayDate(customer.startDate)}</small>
                ${customer.endDate ? `<br><small class="text-danger">Ends: ${formatDisplayDate(customer.endDate)}</small>` : ''}
                ${creditDisplay}
            </div>
            <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#customerModal" onclick="openCustomerModal('${customer.id}')">Edit</button>
        `;
        ul.appendChild(li);
    });
    list.appendChild(ul);
}


// --- Closed Days Management ---

function handleClosedDaySubmit(event) {
    event.preventDefault();
    const dateInput = document.getElementById('closedDate').value;
    const closedDays = getClosedDays();

    if (dateInput && !closedDays.includes(dateInput)) {
        closedDays.push(dateInput);
        closedDays.sort();
        saveClosedDays(closedDays);
        document.getElementById('closedDate').value = '';
        renderClosedDays();
        showToast('Closed day recorded!');
        // Payments amounts would technically need to be recalculated if a day is closed *after* generation.
        // We'll leave the generation logic as is, assuming closed days are added before payment week starts.
    }
}

function removeClosedDay(date) {
    let closedDays = getClosedDays();
    closedDays = closedDays.filter(d => d !== date);
    saveClosedDays(closedDays);
    renderClosedDays();
    showToast('Closed day removed.', 'danger');
}

function renderClosedDays() {
    const list = document.getElementById('closed-days-list');
    const closedDays = getClosedDays();
    list.innerHTML = '';

    if (closedDays.length === 0) {
        list.innerHTML = '<li class="list-group-item text-muted">No closed days recorded.</li>';
        return;
    }

    closedDays.forEach(date => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            ${formatDisplayDate(date)}
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeClosedDay('${date}')">Remove</button>
        `;
        list.appendChild(li);
    });
}

// --- Payment Generation & Management ---

function processCredits() {
    let customers = getCustomers();
    let payments = getPayments();
    let changed = false;

    customers.forEach(customer => {
        if (!customer.creditBalance || customer.creditBalance <= 0) return;

        // Get due payments sorted from oldest to newest
        let duePayments = payments.filter(p => p.customerId === customer.id && p.status === 'Due')
                                  .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));

        for (let payment of duePayments) {
            if (customer.creditBalance <= 0) break;

            if (customer.creditBalance >= payment.amount) {
                // Pay in full
                customer.creditBalance -= payment.amount;
                payment.status = 'Paid';
                payment.paidDate = getMondayOfDateString(payment.weekStart);
                changed = true;
            } else {
                // Partial payment (Split the payment record to track partial data)
                const paidAmount = customer.creditBalance;

                // Add a new 'Paid' record for the credited amount
                const partialPaidPayment = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substring(7),
                    customerId: payment.customerId,
                    weekStart: payment.weekStart,
                    amount: paidAmount,
                    status: 'Paid',
                    paidDate: getMondayOfDateString(payment.weekStart)
                };
                payments.push(partialPaidPayment);

                // Reduce the 'Due' amount for the existing record
                payment.amount -= paidAmount;
                customer.creditBalance = 0;
                changed = true;
            }
        }
    });

    if (changed) {
        saveCustomers(customers);
        savePayments(payments);
        renderCustomers();
        renderDuePayments();
    }
}

function generatePayments() {
    const customers = getCustomers();
    const closedDays = getClosedDays();
    let payments = getPayments();

    const today = new Date();
    // Normalizing today to start of day
    today.setHours(0,0,0,0);

    let paymentsUpdated = false;

    customers.forEach(customer => {
        let currentPeriodStart = new Date(customer.startDate + 'T00:00:00');

        // Find the most recent Monday for the start date
        const dayOfWeek = currentPeriodStart.getDay();
        const diffToMonday = currentPeriodStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        currentPeriodStart.setDate(diffToMonday);

        const endLimit = customer.endDate ? new Date(customer.endDate + 'T00:00:00') : today;

        // Ensure we process up to the current period, but not beyond today
        let actualEndLimit = endLimit < today ? endLimit : today;

        const rateAmount = customer.rateAmount || customer.weeklyRate || 50.00;
        const freq = customer.paymentFrequency || 'weekly';

        while (currentPeriodStart <= actualEndLimit) {
            const periodStartStr = getLocalDateString(currentPeriodStart);

            // Determine period end date based on frequency
            let periodEnd = new Date(currentPeriodStart);
            let periodDays = 7;
            if (freq === 'bi-weekly') {
                periodEnd.setDate(periodEnd.getDate() + 13);
                periodDays = 14;
            } else if (freq === 'monthly') {
                // Approximate monthly to roughly 4 weeks for simple Mon-Fri business logic,
                // or accurately calculate exact working days. Let's step by exact month.
                periodEnd.setMonth(periodEnd.getMonth() + 1);
                periodEnd.setDate(periodEnd.getDate() - 1);
                // Approximate period days to difference in days
                periodDays = Math.round((periodEnd - currentPeriodStart) / (1000 * 60 * 60 * 24)) + 1;
            } else {
                // Weekly
                periodEnd.setDate(periodEnd.getDate() + 6);
                periodDays = 7;
            }

            // Check if payment already generated for this period/customer
            const existingPayment = payments.find(p => p.customerId === customer.id && p.weekStart === periodStartStr);

            if (!existingPayment) {
                // Calculate working days in this period (Mon - Fri)
                let workingDaysList = [];
                for (let i = 0; i < periodDays; i++) {
                    let d = new Date(currentPeriodStart);
                    d.setDate(d.getDate() + i);
                    let dw = d.getDay();
                    if (dw !== 0 && dw !== 6) { // Mon-Fri
                        workingDaysList.push(d);
                    }
                }

                let totalWorkingDays = workingDaysList.length;
                let actualWorkingDays = totalWorkingDays;

                workingDaysList.forEach(day => {
                    const dayStr = getLocalDateString(day);
                    const isBeforeStart = dayStr < customer.startDate;
                    const isAfterEnd = customer.endDate && dayStr > customer.endDate;
                    const isClosed = closedDays.includes(dayStr);

                    if (isBeforeStart || isAfterEnd || isClosed) {
                        actualWorkingDays--;
                    }
                });

                if (actualWorkingDays > 0) {
                    let dailyRate = rateAmount / totalWorkingDays;
                    let amountToCharge = dailyRate * actualWorkingDays;

                    // Round to nearest 2 decimals
                    amountToCharge = Math.round(amountToCharge * 100) / 100;

                    payments.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        customerId: customer.id,
                        weekStart: periodStartStr, // keeping variable name weekStart for backward compatibility in rest of codebase
                        amount: amountToCharge,
                        status: 'Due',
                        paidDate: null
                    });
                    paymentsUpdated = true;
                }
            }

            // Move to next period
            if (freq === 'monthly') {
                currentPeriodStart.setMonth(currentPeriodStart.getMonth() + 1);
            } else if (freq === 'bi-weekly') {
                currentPeriodStart.setDate(currentPeriodStart.getDate() + 14);
            } else {
                currentPeriodStart.setDate(currentPeriodStart.getDate() + 7);
            }
        }
    });

    if (paymentsUpdated) {
        savePayments(payments);
    }
    renderDuePayments();

    // Automatically apply any outstanding credits to newly generated payments
    if (paymentsUpdated) {
        processCredits();
    }
}

function markAsPaid(paymentId) {
    const payments = getPayments();
    const index = payments.findIndex(p => p.id === paymentId);
    if (index > -1) {
        payments[index].status = 'Paid';
        payments[index].paidDate = getMondayOfDateString(payments[index].weekStart);
        savePayments(payments);
        renderDuePayments();
        renderPaymentHistory();
        showToast('Payment marked as paid!');
    }
}

function renderDuePayments() {
    const dashboard = document.getElementById('payments-dashboard');
    const payments = getPayments();
    const customers = getCustomers();
    const filterSelect = document.getElementById('duePaymentsFilter');
    const selectedCustomerId = filterSelect.value;

    // Filter and sort by weekStart descending
    let duePayments = payments.filter(p => p.status === 'Due');

    if (selectedCustomerId) {
        duePayments = duePayments.filter(p => p.customerId === selectedCustomerId);
    }

    duePayments.sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));

    if (duePayments.length === 0) {
        dashboard.innerHTML = '<div class="alert alert-success">All caught up! No payments are currently due for the selected filter.</div>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-group';

    // Create an array of understated Bootstrap background color classes
    const subtleColors = [
        'bg-primary-subtle',
        'bg-secondary-subtle',
        'bg-success-subtle',
        'bg-danger-subtle',
        'bg-warning-subtle',
        'bg-info-subtle',
        'bg-light'
    ];

    duePayments.forEach(payment => {
        const customer = customers.find(c => c.id === payment.customerId);
        if (!customer) return;

        // Find index of customer to consistently assign a color class
        const customerIndex = customers.findIndex(c => c.id === payment.customerId);
        const colorClass = subtleColors[customerIndex % subtleColors.length];

        const li = document.createElement('li');
        li.className = `list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm rounded ${colorClass}`;
        li.innerHTML = `
            <div>
                <h5 class="mb-1">${customer.childName} <small class="text-muted">(${customer.parentName})</small></h5>
                <p class="mb-1 text-danger fw-bold">Amount Due: $${payment.amount.toFixed(2)}</p>
                <small class="text-muted">Period Start: ${formatDisplayDate(payment.weekStart)}</small>
            </div>
            <button class="btn btn-success" onclick="markAsPaid('${payment.id}')">Mark as Paid</button>
        `;
        ul.appendChild(li);
    });

    dashboard.innerHTML = '';
    dashboard.appendChild(ul);
}

function renderPaymentHistory() {
    const dashboard = document.getElementById('payment-history-dashboard');
    const payments = getPayments();
    const customers = getCustomers();
    const filterSelect = document.getElementById('historyPaymentsFilter');
    const selectedCustomerId = filterSelect.value;

    // Filter and sort by paidDate descending
    let historyPayments = payments.filter(p => p.status === 'Paid');

    if (selectedCustomerId) {
        historyPayments = historyPayments.filter(p => p.customerId === selectedCustomerId);
    }

    historyPayments.sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));

    if (historyPayments.length === 0) {
        dashboard.innerHTML = '<div class="alert alert-secondary">No payment history available.</div>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-group';

    const subtleColors = [
        'bg-primary-subtle',
        'bg-secondary-subtle',
        'bg-success-subtle',
        'bg-danger-subtle',
        'bg-warning-subtle',
        'bg-info-subtle',
        'bg-light'
    ];

    historyPayments.forEach(payment => {
        const customer = customers.find(c => c.id === payment.customerId);
        if (!customer) return;

        const customerIndex = customers.findIndex(c => c.id === payment.customerId);
        const colorClass = subtleColors[customerIndex % subtleColors.length];

        const li = document.createElement('li');
        li.className = `list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm rounded ${colorClass}`;

        li.innerHTML = `
            <div>
                <h5 class="mb-1">${customer.childName} <small class="text-muted">(${customer.parentName})</small></h5>
                <p class="mb-1 text-success fw-bold">Amount Paid: $${payment.amount.toFixed(2)}</p>
                <small class="text-muted">Period Start: ${formatDisplayDate(payment.weekStart)} <br> Paid Date: ${formatDisplayDate(payment.paidDate)}</small>
            </div>
            <span class="badge bg-success rounded-pill">Paid</span>
        `;
        ul.appendChild(li);
    });

    dashboard.innerHTML = '';
    dashboard.appendChild(ul);
}


// --- Bulk Payment Management ---

function populateBulkPaymentCustomers() {
    const select = document.getElementById('bulkCustomer');
    const customers = getCustomers();
    select.innerHTML = '<option value="">-- Select Customer --</option>';

    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${customer.childName} (Parent: ${customer.parentName})`;
        select.appendChild(option);
    });

    document.getElementById('bulk-payment-form').reset();
}

function handleBulkPaymentSubmit(event) {
    event.preventDefault();
    const customerId = document.getElementById('bulkCustomer').value;
    const amountStr = document.getElementById('bulkAmount').value;
    const amount = parseFloat(amountStr);

    if (!customerId || isNaN(amount) || amount <= 0) return;

    let customers = getCustomers();
    const customerIndex = customers.findIndex(c => c.id === customerId);

    if (customerIndex > -1) {
        // Initialize creditBalance if it doesn't exist on older records
        if (typeof customers[customerIndex].creditBalance !== 'number') {
            customers[customerIndex].creditBalance = 0;
        }
        customers[customerIndex].creditBalance += amount;
        saveCustomers(customers);

        // Close modal
        const modalEl = document.getElementById('bulkPaymentModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        renderCustomers();
        processCredits();
        showToast(`Bulk payment of $${amount.toFixed(2)} applied!`);
    }
}

// --- Tax Receipt Management ---

function populateReceiptCustomers() {
    const select = document.getElementById('receiptCustomer');
    const customers = getCustomers();
    select.innerHTML = '<option value="">-- Select Customer --</option>';

    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = `${customer.childName} (Parent: ${customer.parentName})`;
        select.appendChild(option);
    });

    document.getElementById('receipt-output').classList.add('d-none');
    document.getElementById('tax-receipt-form').reset();
}

function handleTaxYearChange() {
    const yearSelect = document.getElementById('quickTaxYear').value;
    const startInput = document.getElementById('receiptStartDate');
    const endInput = document.getElementById('receiptEndDate');

    if (yearSelect) {
        startInput.value = `${yearSelect}-01-01`;
        endInput.value = `${yearSelect}-12-31`;
    } else {
        startInput.value = '';
        endInput.value = '';
    }
}

function handleTaxReceiptSubmit(event) {
    event.preventDefault();

    const customerId = document.getElementById('receiptCustomer').value;
    const startDate = document.getElementById('receiptStartDate').value;
    const endDate = document.getElementById('receiptEndDate').value;

    if (!customerId || !startDate || !endDate) return;

    const customers = getCustomers();
    const payments = getPayments();

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Filter paid payments within the date range (using weekStart as the reference)
    const paidPayments = payments.filter(p => {
        if (p.customerId !== customerId || p.status !== 'Paid') return false;

        // We use the weekStart to determine if it falls within the requested receipt period
        return p.weekStart >= startDate && p.weekStart <= endDate;
    });

    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);

    // Sort payments chronologically by weekStart
    paidPayments.sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));

    let tableHTML = `
        <table class="table table-sm table-striped table-bordered mt-4">
            <thead class="table-light">
                <tr>
                    <th>Period Start</th>
                    <th>Date Paid</th>
                    <th class="text-end">Amount</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (paidPayments.length === 0) {
        tableHTML += `<tr><td colspan="3" class="text-center text-muted">No payments found in this period.</td></tr>`;
    } else {
        paidPayments.forEach(p => {
            tableHTML += `
                <tr>
                    <td>${p.weekStart}</td>
                    <td>${p.paidDate}</td>
                    <td class="text-end">$${p.amount.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    tableHTML += `
            </tbody>
        </table>
    `;

    const todayStr = getLocalDateString(new Date());

    const receiptHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Tax Receipt - ${customer.childName}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                @media print {
                    .d-print-none { display: none !important; }
                }
                body { background-color: white; }
            </style>
        </head>
        <body class="p-4">
            <h4 class="text-center mb-0">Childcare Tax Receipt / Invoice</h4>
            <div class="text-center text-muted mb-3"><small>Date Issued: ${todayStr}</small></div>

            <div class="row mb-4">
                <div class="col-6">
                    <strong>Provider:</strong><br>
                    Tater Tots Childcare<br>
                    <!-- Add address/contact info here if needed -->
                </div>
                <div class="col-6 text-end">
                    <strong>Billed To:</strong><br>
                    ${customer.parentName}<br>
                    <strong>Child:</strong> ${customer.childName}<br>
                </div>
            </div>

            <h5 class="mb-3">Summary</h5>
            <table class="table table-bordered mb-4">
                <tbody>
                    <tr>
                        <th style="width: 30%">Service Period</th>
                        <td>${startDate} to ${endDate}</td>
                    </tr>
                    <tr>
                        <th>Total Amount Paid</th>
                        <td class="text-success fw-bold">$${totalPaid.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <h5 class="mb-3">Payment Details</h5>
            ${tableHTML}

            <div class="text-center mt-4 d-print-none">
                <button type="button" class="btn btn-primary" onclick="window.print()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-printer me-2" viewBox="0 0 16 16">
                      <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
                      <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
                    </svg>
                    Print Receipt
                </button>
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
}

// --- PIN Authentication ---
const CORRECT_PIN = '84528452';

function checkAuthStatus() {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
    if (isAuthenticated) {
        unlockApp();
    }
}

function handlePinSubmit(event) {
    event.preventDefault();
    const pinInput = document.getElementById('pinInput').value;
    const errorEl = document.getElementById('pin-error');

    if (pinInput === CORRECT_PIN) {
        sessionStorage.setItem('isAuthenticated', 'true');
        unlockApp();
    } else {
        errorEl.classList.remove('d-none');
        document.getElementById('pinInput').value = '';
    }
}

function unlockApp() {
    document.getElementById('pin-overlay').classList.add('d-none');
    document.getElementById('app-wrapper').classList.remove('d-none');

    // Initialize App data only after unlocking
    renderCustomers();
    renderClosedDays();
    generatePayments();
}

// --- App Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');

    // Event listeners
    document.getElementById('pin-form').addEventListener('submit', handlePinSubmit);
    document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
    document.getElementById('closed-days-form').addEventListener('submit', handleClosedDaySubmit);
    document.getElementById('bulk-payment-form').addEventListener('submit', handleBulkPaymentSubmit);
    document.getElementById('tax-receipt-form').addEventListener('submit', handleTaxReceiptSubmit);

    // Check if already authenticated in this session
    checkAuthStatus();
});
