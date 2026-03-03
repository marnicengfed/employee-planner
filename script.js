// Client-side logic for the employee timeline planner

// Remove any stray text node that may appear before the first element (e.g. "index.html" rendered above the page).
if (document.body && document.body.firstChild && document.body.firstChild.nodeType === Node.TEXT_NODE) {
  const txt = document.body.firstChild.textContent.trim();
  // If the text looks like a filename or other extraneous string, remove it.
  if (txt.toLowerCase().includes('index.html')) {
    document.body.firstChild.remove();
  }
}

// API endpoints for interacting with serverless functions
const API_EMPLOYEES = '/.netlify/functions/employees';
const API_SHOPS = '/.netlify/functions/shops';

let employees = [];
let shops = [];
let currentShop = '';

// DOM elements
const shopSelect = document.getElementById('shopSelect');
const addShopBtn = document.getElementById('addShopBtn');
const removeShopBtn = document.getElementById('removeShopBtn');
const activeCountEl = document.getElementById('activeCount');
const hoverDateEl = document.getElementById('hoverDate');
const timelineContainer = document.getElementById('timelineContainer');
const employeeTableBody = document.querySelector('#employeeTable tbody');
const employeeForm = document.getElementById('employeeForm');
const employeeIdInput = document.getElementById('employeeId');
const nameInput = document.getElementById('name');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const shopInput = document.getElementById('shopInput');
const formTitle = document.getElementById('formTitle');
const cancelBtn = document.getElementById('cancelBtn');

// Utility to parse YYYY-MM-DD strings into Date objects (local timezone)
function parseDate(str) {
  return str ? new Date(str + 'T00:00:00') : null;
}

// Utility to format Date objects to YYYY-MM-DD strings
function formatDate(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Compute the number of months between two dates
function monthsBetween(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

// Load list of shops from server
async function loadShops() {
  try {
    const res = await fetch(API_SHOPS);
    const data = await res.json();
    // Expect array of objects with at least a name property
    shops = data.map(s => s.name);
    // If we don't have a current shop yet, choose the first available
    if (!currentShop && shops.length > 0) {
      currentShop = shops[0];
    }
    buildShopOptions();
  } catch (err) {
    console.error(err);
  }
}

// Load all employees for a given shop
async function loadAllEmployees() {
  try {
    // Ensure we have shops loaded first
    await loadShops();
    // Load employees for the current shop if defined
    if (currentShop) {
      await loadEmployeesForShop(currentShop);
    }
  } catch (err) {
    console.error(err);
  }
}

// Load employees for the current shop
async function loadEmployeesForShop(shop) {
  try {
    const url = shop ? `${API_EMPLOYEES}?shop=${encodeURIComponent(shop)}` : API_EMPLOYEES;
    const res = await fetch(url);
    const data = await res.json();
    employees = data;
    updateActiveCount();
    updateEmployeeTable();
    renderTimeline();
  } catch (err) {
    console.error(err);
  }
}

// Build shop select options from shops array
function buildShopOptions() {
  shopSelect.innerHTML = '';
  // If there are no shops, leave select empty
  shops.forEach(shopName => {
    const option = document.createElement('option');
    option.value = shopName;
    option.textContent = shopName;
    shopSelect.appendChild(option);
  });
  if (currentShop) {
    shopSelect.value = currentShop;
    shopInput.value = currentShop;
  }
}

// Update active employees count for today or hovered date
function updateActiveCount(date = new Date()) {
  const count = employees.filter(e => {
    const start = parseDate(e.start_date);
    const end = parseDate(e.end_date);
    return start <= date && (!end || end >= date);
  }).length;
  activeCountEl.textContent = `Active employees: ${count}`;
}

// Update employee table UI
function updateEmployeeTable() {
  employeeTableBody.innerHTML = '';
  employees.forEach(emp => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.textContent = emp.name;
    const startTd = document.createElement('td');
    startTd.textContent = emp.start_date;
    const endTd = document.createElement('td');
    endTd.textContent = emp.end_date || '';
    const shopTd = document.createElement('td');
    shopTd.textContent = emp.shop || '';
    const actionsTd = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => startEditEmployee(emp));
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteEmployee(emp.id));
    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);
    tr.appendChild(nameTd);
    tr.appendChild(startTd);
    tr.appendChild(endTd);
    tr.appendChild(shopTd);
    tr.appendChild(actionsTd);
    employeeTableBody.appendChild(tr);
  });
}

// Render timeline visualization
function renderTimeline() {
  timelineContainer.innerHTML = '';
  if (employees.length === 0) {
    timelineContainer.style.height = '40px';
    return;
  }
  // Determine timeline start and end dates
  let minStart = parseDate(employees[0].start_date);
  let maxEnd = parseDate(employees[0].end_date) || new Date();
  employees.forEach(emp => {
    const s = parseDate(emp.start_date);
    const e = parseDate(emp.end_date) || new Date();
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  });
  // Extend maxEnd by one year to visualise future planning
  const extended = new Date(maxEnd);
  extended.setFullYear(maxEnd.getFullYear() + 1);
  maxEnd = extended;
  // Compute total months
  const totalMonths = monthsBetween(minStart, maxEnd) + 1;
  const monthWidth = 80; // px per month
  const totalWidth = totalMonths * monthWidth;
  timelineContainer.style.width = `${totalWidth}px`;
  // Create month grid labels at the top
  const monthLabelContainer = document.createElement('div');
  monthLabelContainer.style.position = 'absolute';
  monthLabelContainer.style.top = '0';
  monthLabelContainer.style.left = '0';
  monthLabelContainer.style.height = '20px';
  monthLabelContainer.style.width = `${totalWidth}px`;
  monthLabelContainer.style.display = 'flex';
  monthLabelContainer.style.fontSize = '0.75rem';
  monthLabelContainer.style.color = '#555';
  monthLabelContainer.style.borderBottom = '1px solid #ccc';
  for (let i = 0; i < totalMonths; i++) {
    const dt = new Date(minStart);
    dt.setMonth(minStart.getMonth() + i);
    const label = document.createElement('div');
    label.style.width = `${monthWidth}px`;
    label.style.textAlign = 'center';
    label.textContent = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    monthLabelContainer.appendChild(label);
  }
  timelineContainer.appendChild(monthLabelContainer);
  // For each employee, create a bar
  employees.forEach((emp, index) => {
    const start = parseDate(emp.start_date);
    const end = parseDate(emp.end_date) || maxEnd;
    const startIdx = monthsBetween(minStart, start);
    const endIdx = monthsBetween(minStart, end);
    const bar = document.createElement('div');
    bar.className = 'timeline-row';
    bar.style.top = `${25 + index * 30}px`; // offset below month labels
    bar.style.left = `${startIdx * monthWidth}px`;
    bar.style.width = `${(endIdx - startIdx + 1) * monthWidth}px`;
    bar.textContent = emp.name;
    bar.title = `${emp.name}: ${emp.start_date} - ${emp.end_date || 'Present'}`;
    timelineContainer.appendChild(bar);
  });
  // Set container height based on number of employees
  timelineContainer.style.height = `${employees.length * 30 + 40}px`;
}

// Start editing an employee record
function startEditEmployee(emp) {
  formTitle.textContent = 'Edit Employee';
  employeeIdInput.value = emp.id;
  nameInput.value = emp.name;
  startDateInput.value = emp.start_date;
  endDateInput.value = emp.end_date || '';
  shopInput.value = emp.shop;
  // Scroll to form
  window.scrollTo({ top: document.getElementById('formContainer').offsetTop - 50, behavior: 'smooth' });
}

// Reset the form to add mode
function resetForm() {
  formTitle.textContent = 'Add Employee';
  employeeIdInput.value = '';
  employeeForm.reset();
}

// Delete employee
async function deleteEmployee(id) {
  if (!confirm('Delete this employee?')) return;
  try {
    const url = `${API_EMPLOYEES}?id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await loadEmployeesForShop(currentShop);
  } catch (err) {
    console.error(err);
    alert('Error deleting employee');
  }
}

// Submit form (add or edit)
employeeForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id = employeeIdInput.value;
  const payload = {
    id: id || undefined,
    name: nameInput.value.trim(),
    start_date: startDateInput.value,
    end_date: endDateInput.value || null,
    shop: shopInput.value.trim() || currentShop,
  };
  const method = id ? 'PUT' : 'POST';
  try {
    const res = await fetch(API_EMPLOYEES, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save');
    resetForm();
    currentShop = payload.shop;
    // Ensure shop exists in shops list
    if (!shops.includes(currentShop)) {
      // Persist new shop via API
      await fetch(API_SHOPS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentShop }),
      });
    }
    await loadShops();
    shopSelect.value = currentShop;
    shopInput.value = currentShop;
    await loadEmployeesForShop(currentShop);
  } catch (err) {
    console.error(err);
    alert('Error saving employee');
  }
});

// Cancel editing
cancelBtn.addEventListener('click', () => {
  resetForm();
});

// Handle shop selection change
shopSelect.addEventListener('change', () => {
  currentShop = shopSelect.value;
  shopInput.value = currentShop;
  loadEmployeesForShop(currentShop);
});

// Add shop button
addShopBtn.addEventListener('click', () => {
  const name = prompt('Enter new shop name');
  if (name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    currentShop = trimmed;
    // Persist to server
    fetch(API_SHOPS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: currentShop }),
    })
      .then(() => loadShops())
      .then(() => {
        shopSelect.value = currentShop;
        shopInput.value = currentShop;
        employees = [];
        updateActiveCount();
        updateEmployeeTable();
        renderTimeline();
      })
      .catch(err => console.error(err));
  }
});

// Remove current shop and its employees
removeShopBtn.addEventListener('click', async () => {
  if (!currentShop) return;
  const confirmDelete = confirm('Delete this shop and all its employees?');
  if (!confirmDelete) return;
  try {
    // First delete employees of this shop
    // Fetch current employees
    const resEmployees = await fetch(`${API_EMPLOYEES}?shop=${encodeURIComponent(currentShop)}`);
    const empList = await resEmployees.json();
    // Delete each employee sequentially
    for (const emp of empList) {
      await fetch(`${API_EMPLOYEES}?id=${encodeURIComponent(emp.id)}`, { method: 'DELETE' });
    }
    // Delete shop itself
    await fetch(`${API_SHOPS}?name=${encodeURIComponent(currentShop)}`, { method: 'DELETE' });
    // Reload shops and select first one
    currentShop = '';
    await loadShops();
    if (shops.length > 0) {
      currentShop = shops[0];
    }
    shopInput.value = currentShop;
    await loadEmployeesForShop(currentShop);
  } catch (err) {
    console.error(err);
    alert('Error deleting shop');
  }
});

// Handle hover over timeline to update active count at that date
timelineContainer.addEventListener('mousemove', e => {
  const rect = timelineContainer.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  // Determine date from offsetX relative to month width
  const monthWidth = 80;
  // Determine minStart and maxEnd like in renderTimeline
  if (employees.length === 0) return;
  let minStart = parseDate(employees[0].start_date);
  let maxEnd = parseDate(employees[0].end_date) || new Date();
  employees.forEach(emp => {
    const s = parseDate(emp.start_date);
    const e = parseDate(emp.end_date) || new Date();
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  });
  const extended = new Date(maxEnd);
  extended.setFullYear(maxEnd.getFullYear() + 1);
  maxEnd = extended;
  const totalMonths = monthsBetween(minStart, maxEnd) + 1;
  const totalWidth = totalMonths * monthWidth;
  const ratio = offsetX / totalWidth;
  const monthsOffset = Math.floor(ratio * totalMonths);
  const hoverDate = new Date(minStart);
  hoverDate.setMonth(minStart.getMonth() + monthsOffset);
  hoverDateEl.textContent = hoverDate.toISOString().split('T')[0];
  updateActiveCount(hoverDate);
});

// When mouse leaves timeline, reset count and hover date
timelineContainer.addEventListener('mouseleave', () => {
  hoverDateEl.textContent = '';
  updateActiveCount();
});

// Initial load
loadAllEmployees();
