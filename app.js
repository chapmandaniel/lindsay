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

    if (id) {
        const customers = getCustomers();
        const customer = customers.find(c => c.id === id);
        if (customer) {
            document.getElementById('customerId').value = customer.id;
            document.getElementById('parentName').value = customer.parentName;
            document.getElementById('childName').value = customer.childName;
            document.getElementById('startDate').value = customer.startDate;
            document.getElementById('endDate').value = customer.endDate || '';
            // weeklyRate is fixed
        }
    }
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function handleCustomerSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('customerId').value;
    const parentName = document.getElementById('parentName').value;
    const childName = document.getElementById('childName').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const weeklyRate = 50.00; // Fixed rate

    const customers = getCustomers();

    if (id) {
        // Edit existing customer
        const index = customers.findIndex(c => c.id === id);
        if (index > -1) {
            customers[index] = { ...customers[index], parentName, childName, startDate, endDate, weeklyRate };
        }
    } else {
        // Add new customer
        const newCustomer = {
            id: Date.now().toString(),
            parentName,
            childName,
            startDate,
            endDate,
            weeklyRate
        };
        customers.push(newCustomer);
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

function renderCustomers() {
    const list = document.getElementById('customers-list');
    const customers = getCustomers();
    list.innerHTML = '';

    if (customers.length === 0) {
        list.innerHTML = '<p class="text-muted">No customers added yet.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-group';
    customers.forEach(customer => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div>
                <strong>${customer.childName}</strong> (Parent: ${customer.parentName})<br>
                <small class="text-muted">Rate: $${customer.weeklyRate.toFixed(2)}/wk | Start: ${customer.startDate}</small>
                ${customer.endDate ? `<br><small class="text-danger">Ends: ${customer.endDate}</small>` : ''}
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
        // Payments amounts would technically need to be recalculated if a day is closed *after* generation.
        // We'll leave the generation logic as is, assuming closed days are added before payment week starts.
    }
}

function removeClosedDay(date) {
    let closedDays = getClosedDays();
    closedDays = closedDays.filter(d => d !== date);
    saveClosedDays(closedDays);
    renderClosedDays();
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
            ${date}
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeClosedDay('${date}')">Remove</button>
        `;
        list.appendChild(li);
    });
}

// --- Payment Generation & Management ---

function generatePayments() {
    const customers = getCustomers();
    const closedDays = getClosedDays();
    let payments = getPayments();

    const today = new Date();
    // Normalizing today to start of day
    today.setHours(0,0,0,0);

    let paymentsUpdated = false;

    customers.forEach(customer => {
        let currentWeekStart = new Date(customer.startDate + 'T00:00:00');
        // Find the most recent Monday for the start date
        const dayOfWeek = currentWeekStart.getDay();
        const diffToMonday = currentWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        currentWeekStart.setDate(diffToMonday);

        const endLimit = customer.endDate ? new Date(customer.endDate + 'T00:00:00') : today;

        // Ensure we process up to the current week, but not beyond today
        let actualEndLimit = endLimit < today ? endLimit : today;

        while (currentWeekStart <= actualEndLimit) {
            const weekStartStr = getLocalDateString(currentWeekStart);
            let weekEnd = new Date(currentWeekStart);
            weekEnd.setDate(weekEnd.getDate() + 4); // Friday of that week

            // Check if payment already generated for this week/customer
            const existingPayment = payments.find(p => p.customerId === customer.id && p.weekStart === weekStartStr);

            if (!existingPayment) {
                // Calculate amount
                let amountToCharge = customer.weeklyRate; // Default 50.00
                let actualWorkingDays = 5;

                // Adjust for start/end date mid-week
                let mon = new Date(currentWeekStart);
                let tue = new Date(currentWeekStart); tue.setDate(tue.getDate() + 1);
                let wed = new Date(currentWeekStart); wed.setDate(wed.getDate() + 2);
                let thu = new Date(currentWeekStart); thu.setDate(thu.getDate() + 3);
                let fri = new Date(currentWeekStart); fri.setDate(fri.getDate() + 4);

                const weekDays = [mon, tue, wed, thu, fri];

                weekDays.forEach(day => {
                    const dayStr = getLocalDateString(day);
                    const isBeforeStart = dayStr < customer.startDate;
                    const isAfterEnd = customer.endDate && dayStr > customer.endDate;
                    const isClosed = closedDays.includes(dayStr);

                    if (isBeforeStart || isAfterEnd || isClosed) {
                        actualWorkingDays--;
                        amountToCharge -= 10.00; // Deduct $10 for each day
                    }
                });

                if (actualWorkingDays > 0) {
                    payments.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        customerId: customer.id,
                        weekStart: weekStartStr,
                        amount: amountToCharge,
                        status: 'Due',
                        paidDate: null
                    });
                    paymentsUpdated = true;
                }
            }

            // Move to next week Monday
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }
    });

    if (paymentsUpdated) {
        savePayments(payments);
    }
    renderDuePayments();
}

function markAsPaid(paymentId) {
    const payments = getPayments();
    const index = payments.findIndex(p => p.id === paymentId);
    if (index > -1) {
        payments[index].status = 'Paid';
        payments[index].paidDate = getLocalDateString(new Date());
        savePayments(payments);
        renderDuePayments();
    }
}

function renderDuePayments() {
    const dashboard = document.getElementById('payments-dashboard');
    const payments = getPayments();
    const customers = getCustomers();

    // Sort by weekStart descending
    const duePayments = payments.filter(p => p.status === 'Due').sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));

    if (duePayments.length === 0) {
        dashboard.innerHTML = '<div class="alert alert-success">All caught up! No payments are currently due.</div>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-group';

    duePayments.forEach(payment => {
        const customer = customers.find(c => c.id === payment.customerId);
        if (!customer) return;

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm rounded';
        li.innerHTML = `
            <div>
                <h5 class="mb-1">${customer.childName} <small class="text-muted">(${customer.parentName})</small></h5>
                <p class="mb-1 text-danger fw-bold">Amount Due: $${payment.amount.toFixed(2)}</p>
                <small class="text-muted">Week of: ${payment.weekStart}</small>
            </div>
            <button class="btn btn-success" onclick="markAsPaid('${payment.id}')">Mark as Paid</button>
        `;
        ul.appendChild(li);
    });

    dashboard.innerHTML = '';
    dashboard.appendChild(ul);
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

    const output = document.getElementById('receipt-output');
    output.classList.remove('d-none');

    const todayStr = getLocalDateString(new Date());

    output.innerHTML = `
        <h4 class="text-center">Tax Receipt</h4>
        <hr>
        <p><strong>Provider:</strong> Childcare Tracker</p>
        <p><strong>Parent Name:</strong> ${customer.parentName}</p>
        <p><strong>Child Name:</strong> ${customer.childName}</p>
        <p><strong>Service Period:</strong> ${startDate} to ${endDate}</p>
        <p><strong>Date Issued:</strong> ${todayStr}</p>
        <hr>
        <h5 class="text-end text-success">Total Amount Paid: $${totalPaid.toFixed(2)}</h5>
        <div class="text-center mt-3">
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="window.print()">Print Receipt</button>
        </div>
    `;
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
    document.getElementById('tax-receipt-form').addEventListener('submit', handleTaxReceiptSubmit);

    // Check if already authenticated in this session
    checkAuthStatus();
});
