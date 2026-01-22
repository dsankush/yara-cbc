// Product Configuration
const PRODUCT_CONFIG = {
    'YaraMila Complex': { packSize: '25 Kg', pricePerUnit: 2400, cashbackPerUnit: 40, budget: 75000 },
    'YaraLiva Nitrabor': { packSize: '25 Kg', pricePerUnit: 1600, cashbackPerUnit: 25, budget: 50000 },
    'YaraVita Seniphos': { packSize: '500 ML', pricePerUnit: 850, cashbackPerUnit: 20, budget: 35000 },
    'YaraVita Bortrac': { packSize: '250 ML', pricePerUnit: 500, cashbackPerUnit: 10, budget: 15000 },
    'YaraVita Zintrac 700': { packSize: '250 ML', pricePerUnit: 450, cashbackPerUnit: 10, budget: 25000 }
};

const CASHBACK_THRESHOLD = 10000;

// Global variables
let rawData = [];
let filteredData = [];
let charts = {};
let farmerCashbackRegistry = new Map(); // Track which farmers have received cashback

// NEW: Variables for cashback CSV data
let cashbackData = [];
let actualTotalCashback = 0;
let actualCashbackWinners = 0;

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadCSVData();
    loadCashbackCSV(); // NEW: Load cashback CSV
    setupEventListeners();
});

// NEW: Load Cashback CSV Data
async function loadCashbackCSV() {
    try {
        const response = await fetch('yara_cashback.csv');
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            dynamicTyping: false,
            skipEmptyLines: true,
            complete: (results) => {
                cashbackData = results.data;
                processCashbackData();
                // Update KPIs after loading cashback data
                updateCashbackKPIs();
            },
            error: (error) => {
                console.error('Error parsing cashback CSV:', error);
                // Don't alert - just log the error and continue with zeros
                console.log('Cashback data not available. Using default values.');
            }
        });
    } catch (error) {
        console.error('Error loading cashback CSV:', error);
        // Don't alert - just log the error and continue
        console.log('yara_cashback.csv not found. Using default values.');
    }
}

// NEW: Process Cashback Data
function processCashbackData() {
    let totalCashback = 0;
    const uniqueNumbers = new Set();

    cashbackData.forEach(row => {
        // Parse cashback amount (remove any currency symbols or commas)
        const cashbackAmount = parseFloat(String(row['Cashback Amount'] || '0').replace(/[₹,]/g, '')) || 0;
        totalCashback += cashbackAmount;

        // Add unique numbers
        const number = String(row['Number'] || '').trim();
        if (number && number !== '') {
            uniqueNumbers.add(number);
        }
    });

    actualTotalCashback = totalCashback;
    actualCashbackWinners = uniqueNumbers.size;

    console.log('Cashback Data Processed:');
    console.log('Total Cashback:', actualTotalCashback);
    console.log('Unique Winners:', actualCashbackWinners);
}

// NEW: Update Cashback KPIs
function updateCashbackKPIs() {
    // Update Total Cashback
    const totalCashbackElement = document.getElementById('totalCashback');
    if (totalCashbackElement) {
        totalCashbackElement.textContent = `₹${actualTotalCashback.toLocaleString('en-IN')}`;
    }

    // Update Cashback Winners
    const cashbackWinnersElement = document.getElementById('cashbackWinners');
    if (cashbackWinnersElement) {
        cashbackWinnersElement.textContent = actualCashbackWinners.toLocaleString('en-IN');
    }
}

// Load CSV Data
async function loadCSVData() {
    try {
        const response = await fetch('yara_cbc.csv');
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            dynamicTyping: false,
            skipEmptyLines: true,
            complete: (results) => {
                rawData = results.data;
                processData();
                initializeFilters();
                filteredData = [...rawData];
                updateDashboard();
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                alert('Error loading data. Please check the CSV file.');
            }
        });
    } catch (error) {
        console.error('Error loading CSV:', error);
        alert('Error loading CSV file. Please ensure yara_cbc.csv is in the same directory.');
    }
}

// Process Data - Build Cashback Registry (One-Time Rule)
function processData() {
    // Sort by date to process chronologically
    const sortedData = [...rawData].sort((a, b) => {
        const dateA = parseDate(a['Date of Entry']);
        const dateB = parseDate(b['Date of Entry']);
        return dateA - dateB;
    });

    farmerCashbackRegistry.clear();

    sortedData.forEach(row => {
        const farmerId = row['Farmer Mobile'];
        const approvalStatus = row['Approval Status'];

        // Skip if not verified/approved
        if (approvalStatus !== 'Verified') {
            return;
        }

        // Skip if farmer already received cashback
        if (farmerCashbackRegistry.has(farmerId)) {
            return;
        }

        // Calculate purchase value for this transaction
        const purchaseValue = calculateTransactionValue(row);

        // Check if meets threshold
        if (purchaseValue >= CASHBACK_THRESHOLD) {
            const cashback = calculateTransactionCashback(row);
            
            farmerCashbackRegistry.set(farmerId, {
                orderId: row['Order ID'],
                date: row['Date of Entry'],
                purchaseValue: purchaseValue,
                cashbackAmount: cashback,
                products: extractTransactionProducts(row)
            });
        }
    });
}

// Calculate Transaction Value (Single Order)
function calculateTransactionValue(row) {
    let totalValue = 0;
    
    for (let i = 1; i <= 5; i++) {
        const productName = extractProductName(row[`Product Name ${i}`]);
        const quantity = parseInt(row[`Product Quantity ${i}`]) || 0;
        
        if (productName && quantity > 0) {
            const config = PRODUCT_CONFIG[productName];
            if (config) {
                totalValue += config.pricePerUnit * quantity;
            }
        }
    }
    
    return totalValue;
}

// Calculate Transaction Cashback
function calculateTransactionCashback(row) {
    let totalCashback = 0;
    
    for (let i = 1; i <= 5; i++) {
        const productName = extractProductName(row[`Product Name ${i}`]);
        const quantity = parseInt(row[`Product Quantity ${i}`]) || 0;
        
        if (productName && quantity > 0) {
            const config = PRODUCT_CONFIG[productName];
            if (config) {
                totalCashback += config.cashbackPerUnit * quantity;
            }
        }
    }
    
    return totalCashback;
}

// Extract Transaction Products
function extractTransactionProducts(row) {
    const products = [];
    
    for (let i = 1; i <= 5; i++) {
        const productName = extractProductName(row[`Product Name ${i}`]);
        const quantity = parseInt(row[`Product Quantity ${i}`]) || 0;
        
        if (productName && quantity > 0) {
            products.push({
                name: productName,
                quantity: quantity
            });
        }
    }
    
    return products;
}

// Setup Event Listeners
function setupEventListeners() {
    document.getElementById('universalSearch').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('dateRangeFilter').addEventListener('change', handleDateRangeChange);
    document.getElementById('startDate').addEventListener('change', applyFilters);
    document.getElementById('endDate').addEventListener('change', applyFilters);
    document.getElementById('districtFilter').addEventListener('change', applyFilters);
    document.getElementById('cropFilter').addEventListener('change', applyFilters);
    document.getElementById('productFilter').addEventListener('change', applyFilters);
    document.getElementById('retailerFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('downloadBtn').addEventListener('click', downloadData);
}

// Handle Date Range Change
function handleDateRangeChange() {
    const dateRange = document.getElementById('dateRangeFilter').value;
    const customDateRange = document.getElementById('customDateRange');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (dateRange === 'custom') {
        customDateRange.style.display = 'block';
        return;
    } else {
        customDateRange.style.display = 'none';
    }

    const today = new Date();
    let startDate = null;
    let endDate = new Date(today);

    switch (dateRange) {
        case 'today':
            startDate = new Date(today);
            break;
        case 'yesterday':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 1);
            endDate = new Date(startDate);
            break;
        case 'last7days':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'last30days':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 30);
            break;
        case 'thismonth':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'lastmonth':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        default:
            startDateInput.value = '';
            endDateInput.value = '';
            applyFilters();
            return;
    }

    if (startDate) {
        startDateInput.value = startDate.toISOString().split('T')[0];
    }
    if (endDate) {
        endDateInput.value = endDate.toISOString().split('T')[0];
    }

    applyFilters();
}

// Initialize Filters
function initializeFilters() {
    const districts = new Set();
    const crops = new Set();
    const products = new Set();
    const retailers = new Set();

    rawData.forEach(row => {
        if (row['District']) districts.add(row['District']);
        if (row['Retailer Name']) retailers.add(row['Retailer Name']);
        
        // Extract crops
        if (row['Crops Selected']) {
            const cropList = row['Crops Selected'].split(',').map(c => c.trim());
            cropList.forEach(crop => {
                if (crop) crops.add(crop);
            });
        }
        
        // Extract products
        for (let i = 1; i <= 5; i++) {
            const productName = extractProductName(row[`Product Name ${i}`]);
            if (productName) products.add(productName);
        }
    });

    populateFilter('districtFilter', Array.from(districts).sort());
    populateFilter('cropFilter', Array.from(crops).sort());
    populateFilter('productFilter', Array.from(products).sort());
    populateFilter('retailerFilter', Array.from(retailers).sort());
}

// Populate Filter Options
function populateFilter(elementId, options) {
    const select = document.getElementById(elementId);
    const firstOption = select.options[0].text;
    select.innerHTML = `<option value="">${firstOption}</option>`;
    
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}

// Extract Product Name (handles variations)
function extractProductName(productString) {
    if (!productString) return null;
    
    const productStr = String(productString).trim();
    
    for (const [name] of Object.entries(PRODUCT_CONFIG)) {
        if (productStr.includes(name)) {
            return name;
        }
    }
    
    return null;
}

// Parse Date
function parseDate(dateString) {
    if (!dateString) return new Date(0);
    
    const parts = dateString.trim().split(/[\s,/-]+/);
    
    if (parts.length >= 3) {
        const day = parseInt(parts[0]);
        const monthStr = parts[1];
        const year = parseInt(parts[2]);
        
        const months = {
            'january': 0, 'jan': 0,
            'february': 1, 'feb': 1,
            'march': 2, 'mar': 2,
            'april': 3, 'apr': 3,
            'may': 4,
            'june': 5, 'jun': 5,
            'july': 6, 'jul': 6,
            'august': 7, 'aug': 7,
            'september': 8, 'sep': 8,
            'october': 9, 'oct': 9,
            'november': 10, 'nov': 10,
            'december': 11, 'dec': 11
        };
        
        const month = months[monthStr.toLowerCase()];
        if (month !== undefined) {
            return new Date(year, month, day);
        }
    }
    
    return new Date(dateString);
}

// Apply Filters
function applyFilters() {
    const searchTerm = document.getElementById('universalSearch').value.toLowerCase();
    const startDate = document.getElementById('startDate').value ? new Date(document.getElementById('startDate').value) : null;
    const endDate = document.getElementById('endDate').value ? new Date(document.getElementById('endDate').value) : null;
    const districtFilter = document.getElementById('districtFilter').value;
    const cropFilter = document.getElementById('cropFilter').value;
    const productFilter = document.getElementById('productFilter').value;
    const retailerFilter = document.getElementById('retailerFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    filteredData = rawData.filter(row => {
        // Universal Search
        if (searchTerm) {
            const searchableText = [
                row['Farmer Name'],
                row['Farmer Mobile'],
                row['District'],
                row['Retailer Name'],
                row['Order ID'],
                row['RIN']
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchTerm)) return false;
        }

        // Date Range Filter
        if (startDate || endDate) {
            const rowDate = parseDate(row['Date of Entry']);
            if (startDate && rowDate < startDate) return false;
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                if (rowDate > endDateTime) return false;
            }
        }

        // District Filter
        if (districtFilter && row['District'] !== districtFilter) return false;

        // Crop Filter
        if (cropFilter) {
            const crops = row['Crops Selected'] ? row['Crops Selected'].split(',').map(c => c.trim()) : [];
            if (!crops.includes(cropFilter)) return false;
        }

        // Product Filter
        if (productFilter) {
            let hasProduct = false;
            for (let i = 1; i <= 5; i++) {
                const productName = extractProductName(row[`Product Name ${i}`]);
                if (productName === productFilter) {
                    hasProduct = true;
                    break;
                }
            }
            if (!hasProduct) return false;
        }

        // Retailer Filter
        if (retailerFilter && row['Retailer Name'] !== retailerFilter) return false;

        // Status Filter
        if (statusFilter && row['Approval Status'] !== statusFilter) return false;

        return true;
    });

    updateDashboard();
}

// Reset Filters
function resetFilters() {
    document.getElementById('universalSearch').value = '';
    document.getElementById('dateRangeFilter').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('districtFilter').value = '';
    document.getElementById('cropFilter').value = '';
    document.getElementById('productFilter').value = '';
    document.getElementById('retailerFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('customDateRange').style.display = 'none';
    
    filteredData = [...rawData];
    updateDashboard();
}

// Update Dashboard
function updateDashboard() {
    updateKPIs();
    updateProductChart();
    updateCashbackChart();
    updateCropChart();
    updateDistrictMap();
    updateBudgetTable();
    updateRetailerChart();
}

// Update KPIs
function updateKPIs() {
    // Total Scans
    document.getElementById('totalScans').textContent = filteredData.length.toLocaleString();

    // Unique Farmers
    const uniqueFarmers = new Set(filteredData.map(row => row['Farmer Mobile']));
    document.getElementById('uniqueFarmers').textContent = uniqueFarmers.size.toLocaleString();

    // Status Counts
    const pending = filteredData.filter(row => row['Approval Status'] === 'Pending').length;
    const verified = filteredData.filter(row => row['Approval Status'] === 'Verified').length;
    const rejected = filteredData.filter(row => row['Approval Status'] === 'Rejected').length;

    document.getElementById('pendingCount').textContent = pending.toLocaleString();
    document.getElementById('verifiedCount').textContent = verified.toLocaleString();
    document.getElementById('rejectedCount').textContent = rejected.toLocaleString();

    // MODIFIED: Use actual cashback data instead of calculated
    // These values are now updated from yara_cashback.csv
    updateCashbackKPIs();

    // Active Retailers
    const activeRetailers = new Set(filteredData.map(row => row['Retailer Name']).filter(Boolean));
    document.getElementById('activeRetailers').textContent = `${activeRetailers.size}/59`;
}

// Update Product Chart
function updateProductChart() {
    const productData = {};

    Object.keys(PRODUCT_CONFIG).forEach(product => {
        productData[product] = 0;
    });

    filteredData.forEach(row => {
        for (let i = 1; i <= 5; i++) {
            const productName = extractProductName(row[`Product Name ${i}`]);
            const quantity = parseInt(row[`Product Quantity ${i}`]) || 0;
            
            if (productName && quantity > 0) {
                productData[productName] += quantity;
            }
        }
    });

    const ctx = document.getElementById('productChart');
    
    if (charts.productChart) {
        charts.productChart.destroy();
    }

    const labels = Object.keys(productData);
    const data = Object.values(productData);

    charts.productChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Units Sold',
                data: data,
                backgroundColor: [
                    'rgba(99, 102, 241, 0.85)',
                    'rgba(59, 130, 246, 0.85)',
                    'rgba(16, 185, 129, 0.85)',
                    'rgba(245, 158, 11, 0.85)',
                    'rgba(239, 68, 68, 0.85)'
                ],
                borderColor: [
                    'rgba(99, 102, 241, 1)',
                    'rgba(59, 130, 246, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(229, 231, 235, 0.5)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 10,
                            weight: '600'
                        },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Update Cashback Chart
function updateCashbackChart() {
    const cashbackData = {
        eligible: 0,
        notEligible: 0
    };

    const filteredFarmerIds = new Set(filteredData.map(row => row['Farmer Mobile']));

    farmerCashbackRegistry.forEach((data, farmerId) => {
        if (filteredFarmerIds.has(farmerId)) {
            cashbackData.eligible++;
        }
    });

    cashbackData.notEligible = filteredFarmerIds.size - cashbackData.eligible;

    const ctx = document.getElementById('cashbackChart');
    
    if (charts.cashbackChart) {
        charts.cashbackChart.destroy();
    }

    charts.cashbackChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cashback Winners', 'Not Eligible'],
            datasets: [{
                data: [cashbackData.eligible, cashbackData.notEligible],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.85)',
                    'rgba(156, 163, 175, 0.85)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(156, 163, 175, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        color: '#4b5563',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            }
        }
    });
}

// Update Crop Chart
function updateCropChart() {
    const cropData = {};

    filteredData.forEach(row => {
        if (row['Crops Selected']) {
            const crops = row['Crops Selected'].split(',').map(c => c.trim());
            crops.forEach(crop => {
                if (crop) {
                    cropData[crop] = (cropData[crop] || 0) + 1;
                }
            });
        }
    });

    const sortedCrops = Object.entries(cropData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const ctx = document.getElementById('cropChart');
    
    if (charts.cropChart) {
        charts.cropChart.destroy();
    }

    charts.cropChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCrops.map(([crop]) => crop),
            datasets: [{
                data: sortedCrops.map(([, count]) => count),
                backgroundColor: [
                    'rgba(99, 102, 241, 0.85)',
                    'rgba(59, 130, 246, 0.85)',
                    'rgba(16, 185, 129, 0.85)',
                    'rgba(245, 158, 11, 0.85)',
                    'rgba(239, 68, 68, 0.85)',
                    'rgba(168, 85, 247, 0.85)',
                    'rgba(236, 72, 153, 0.85)',
                    'rgba(20, 184, 166, 0.85)'
                ],
                borderColor: [
                    'rgba(99, 102, 241, 1)',
                    'rgba(59, 130, 246, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)',
                    'rgba(168, 85, 247, 1)',
                    'rgba(236, 72, 153, 1)',
                    'rgba(20, 184, 166, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        font: {
                            size: 11,
                            weight: '600'
                        },
                        color: '#4b5563',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            }
        }
    });
}

// Update District Map
function updateDistrictMap() {
    const districtData = {};

    filteredData.forEach(row => {
        const district = row['District'];
        const farmerId = row['Farmer Mobile'];
        
        if (district) {
            if (!districtData[district]) {
                districtData[district] = {
                    totalFarmers: new Set(),
                    cashbackWinners: new Set()
                };
            }
            
            districtData[district].totalFarmers.add(farmerId);
            
            if (farmerCashbackRegistry.has(farmerId)) {
                districtData[district].cashbackWinners.add(farmerId);
            }
        }
    });

    const sortedDistricts = Object.entries(districtData)
        .sort((a, b) => b[1].totalFarmers.size - a[1].totalFarmers.size)
        .slice(0, 12);

    const container = document.getElementById('indiaMap');
    container.innerHTML = '<div class="district-grid"></div>';
    const gridContainer = container.querySelector('.district-grid');

    sortedDistricts.forEach(([district, data]) => {
            const card = document.createElement('div');
            card.className = 'district-card';
            card.innerHTML = `
                <h4>${district}</h4>
                <div class="district-stats">
                    <div class="stat-row">
                        <span>Total Farmers:</span>
                        <strong>${data.totalFarmers.size}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Cashback Winners:</span>
                        <strong>${data.cashbackWinners.size}</strong>
                    </div>
                </div>
            `;
            gridContainer.appendChild(card);
        });
}

// Update Budget Table
function updateBudgetTable() {
    const budgetData = {};

    Object.keys(PRODUCT_CONFIG).forEach(product => {
        budgetData[product] = {
            bagsSold: 0,
            cashbackDistributed: 0,
            farmers: new Set()
        };
    });

    // Get filtered farmer IDs
    const filteredFarmerIds = new Set(filteredData.map(row => row['Farmer Mobile']));

    // Count all bags sold (from filtered data)
    filteredData.forEach(row => {
        for (let i = 1; i <= 5; i++) {
            const productName = extractProductName(row[`Product Name ${i}`]);
            const quantity = parseInt(row[`Product Quantity ${i}`]) || 0;
            
            if (productName && quantity > 0) {
                budgetData[productName].bagsSold += quantity;
                budgetData[productName].farmers.add(row['Farmer Mobile']);
            }
        }
    });

    // Calculate cashback distributed ONLY from registry (one-time rule)
    farmerCashbackRegistry.forEach((cashbackData, farmerId) => {
        if (filteredFarmerIds.has(farmerId)) {
            cashbackData.products.forEach(product => {
                const config = PRODUCT_CONFIG[product.name];
                if (config) {
                    budgetData[product.name].cashbackDistributed += config.cashbackPerUnit * product.quantity;
                }
            });
        }
    });

    const tableHTML = `
        <table class="budget-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Bags Sold</th>
                    <th>Budget</th>
                    <th>Consumed</th>
                    <th>Remaining</th>
                    <th>Progress</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(budgetData).map(([product, data]) => {
                    const config = PRODUCT_CONFIG[product];
                    const consumed = data.cashbackDistributed;
                    const remaining = Math.max(0, config.budget - consumed);
                    const percentage = Math.min(100, (consumed / config.budget * 100)).toFixed(1);
                    
                    return `
                        <tr>
                            <td><strong>${product}</strong></td>
                            <td>${data.bagsSold.toLocaleString()}</td>
                            <td>₹${config.budget.toLocaleString()}</td>
                            <td>₹${consumed.toLocaleString()}</td>
                            <td>₹${remaining.toLocaleString()}</td>
                            <td>
                                <div>${percentage}%</div>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${percentage}%"></div>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('budgetTable').innerHTML = tableHTML;
}

// Update Retailer Chart
function updateRetailerChart() {
    const retailerData = {};

    filteredData.forEach(row => {
        const retailer = row['Retailer Name'];
        const rin = row['RIN'];
        
        if (retailer && rin) {
            if (!retailerData[retailer]) {
                retailerData[retailer] = {
                    orders: 0,
                    farmers: new Set()
                };
            }
            
            retailerData[retailer].orders += 1;
            retailerData[retailer].farmers.add(row['Farmer Mobile']);
        }
    });

    const topRetailers = Object.entries(retailerData)
        .map(([name, data]) => ({
            name,
            orders: data.orders,
            farmers: data.farmers.size
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 10);

    const ctx = document.getElementById('retailerChart');
    
    if (charts.retailerChart) {
        charts.retailerChart.destroy();
    }

    charts.retailerChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topRetailers.map(r => r.name),
            datasets: [{
                label: 'Total Orders',
                data: topRetailers.map(r => r.orders),
                backgroundColor: 'rgba(99, 102, 241, 0.85)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const retailer = topRetailers[context.dataIndex];
                            return [
                                `Orders: ${retailer.orders}`,
                                `Unique Farmers: ${retailer.farmers}`
                            ];
                        }
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(229, 231, 235, 0.5)',
                        drawBorder: false
                    }
                },
                y: {
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11,
                            weight: '600'
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Download Data
function downloadData() {
    const csv = Papa.unparse(filteredData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `yara_dashboard_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
