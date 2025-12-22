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

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadCSVData();
    setupEventListeners();
});

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
            row['Crops Selected'].split(',').forEach(crop => {
                const trimmedCrop = crop.trim();
                if (trimmedCrop) crops.add(trimmedCrop);
            });
        }

        // Extract products
        for (let i = 1; i <= 5; i++) {
            const productName = row[`Product Name ${i}`];
            if (productName) {
                const cleanProduct = extractProductName(productName);
                if (cleanProduct) products.add(cleanProduct);
            }
        }
    });

    populateSelect('districtFilter', Array.from(districts).sort());
    populateSelect('cropFilter', Array.from(crops).sort());
    populateSelect('productFilter', Array.from(products).sort());
    populateSelect('retailerFilter', Array.from(retailers).sort());
}

// Populate Select Dropdown
function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    const currentOptions = select.querySelectorAll('option:not([value=""])');
    currentOptions.forEach(opt => opt.remove());
    
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });
}

// Extract Product Name from Product String
function extractProductName(productString) {
    if (!productString) return null;
    
    for (const productName in PRODUCT_CONFIG) {
        if (productString.includes(productName)) {
            return productName;
        }
    }
    return null;
}

// Apply Filters
function applyFilters() {
    const searchTerm = document.getElementById('universalSearch').value.toLowerCase();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const selectedDistrict = document.getElementById('districtFilter').value;
    const selectedCrop = document.getElementById('cropFilter').value;
    const selectedProduct = document.getElementById('productFilter').value;
    const selectedRetailer = document.getElementById('retailerFilter').value;
    const selectedStatus = document.getElementById('statusFilter').value;

    filteredData = rawData.filter(row => {
        // Universal Search
        if (searchTerm) {
            const searchableText = Object.values(row).join(' ').toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }

        // Date Range Filter
        if (startDate || endDate) {
            const rowDate = parseDate(row['Date of Entry']);
            if (rowDate) {
                if (startDate && rowDate < new Date(startDate)) return false;
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    endDateTime.setHours(23, 59, 59, 999);
                    if (rowDate > endDateTime) return false;
                }
            }
        }

        // District Filter
        if (selectedDistrict && row['District'] !== selectedDistrict) {
            return false;
        }

        // Crop Filter
        if (selectedCrop) {
            const rowCrops = row['Crops Selected'] ? row['Crops Selected'].split(',').map(c => c.trim()) : [];
            if (!rowCrops.includes(selectedCrop)) {
                return false;
            }
        }

        // Product Filter
        if (selectedProduct) {
            let hasProduct = false;
            for (let i = 1; i <= 5; i++) {
                const productName = extractProductName(row[`Product Name ${i}`]);
                if (productName && productName === selectedProduct) {
                    hasProduct = true;
                    break;
                }
            }
            if (!hasProduct) return false;
        }

        // Retailer Filter
        if (selectedRetailer && row['Retailer Name'] !== selectedRetailer) {
            return false;
        }

        // Status Filter
        if (selectedStatus && row['Approval Status'] !== selectedStatus) {
            return false;
        }

        return true;
    });

    updateDashboard();
}

// Parse Date
function parseDate(dateString) {
    if (!dateString) return null;
    const parts = dateString.split(/[-\s:]/);
    if (parts.length >= 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
    }
    return null;
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
    const uniqueFarmers = new Set(filteredData.map(row => row['Farmer Mobile'])).size;
    document.getElementById('uniqueFarmers').textContent = uniqueFarmers.toLocaleString();

    // Status Counts
    const pending = filteredData.filter(row => row['Approval Status'] === 'Pending').length;
    const verified = filteredData.filter(row => row['Approval Status'] === 'Verified').length;
    const rejected = filteredData.filter(row => row['Approval Status'] === 'Rejected').length;

    document.getElementById('pendingCount').textContent = pending.toLocaleString();
    document.getElementById('verifiedCount').textContent = verified.toLocaleString();
    document.getElementById('rejectedCount').textContent = rejected.toLocaleString();

    // Cashback Winners and Total Cashback (Based on Registry)
    const filteredFarmerIds = new Set(filteredData.map(row => row['Farmer Mobile']));
    let cashbackWinners = 0;
    let totalCashback = 0;

    farmerCashbackRegistry.forEach((cashbackData, farmerId) => {
        if (filteredFarmerIds.has(farmerId)) {
            cashbackWinners++;
            totalCashback += cashbackData.cashbackAmount;
        }
    });

    document.getElementById('cashbackWinners').textContent = cashbackWinners.toLocaleString();
    document.getElementById('totalCashback').textContent = `₹${totalCashback.toLocaleString()}`;

    // Active Retailers
    const activeRetailers = new Set(filteredData.map(row => row['RIN'])).size;
    document.getElementById('activeRetailers').textContent = `${activeRetailers}/59`;
}

// Update Product Chart
function updateProductChart() {
    const productCounts = {};
    
    Object.keys(PRODUCT_CONFIG).forEach(product => {
        productCounts[product] = 0;
    });

    filteredData.forEach(row => {
        for (let i = 1; i <= 5; i++) {
            const productName = extractProductName(row[`Product Name ${i}`]);
            const quantity = parseInt(row[`Product Quantity ${i}`]) || 0;
            
            if (productName && quantity > 0) {
                productCounts[productName] = (productCounts[productName] || 0) + quantity;
            }
        }
    });

    const ctx = document.getElementById('productChart');
    
    if (charts.productChart) {
        charts.productChart.destroy();
    }

    charts.productChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(productCounts),
            datasets: [{
                label: 'Units Ordered',
                data: Object.values(productCounts),
                backgroundColor: [
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(46, 204, 113, 0.8)',
                    'rgba(155, 89, 182, 0.8)',
                    'rgba(241, 196, 15, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ],
                borderColor: [
                    'rgba(52, 152, 219, 1)',
                    'rgba(46, 204, 113, 1)',
                    'rgba(155, 89, 182, 1)',
                    'rgba(241, 196, 15, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 2
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
                    callbacks: {
                        label: (context) => `Units: ${context.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => value.toLocaleString()
                    }
                }
            }
        }
    });
}

// Update Cashback Chart
function updateCashbackChart() {
    const cashbackByProduct = {};
    
    Object.keys(PRODUCT_CONFIG).forEach(product => {
        cashbackByProduct[product] = 0;
    });

    // Get filtered farmer IDs
    const filteredFarmerIds = new Set(filteredData.map(row => row['Farmer Mobile']));

    // Aggregate cashback by product from registry
    farmerCashbackRegistry.forEach((cashbackData, farmerId) => {
        if (filteredFarmerIds.has(farmerId)) {
            cashbackData.products.forEach(product => {
                const config = PRODUCT_CONFIG[product.name];
                if (config) {
                    cashbackByProduct[product.name] += config.cashbackPerUnit * product.quantity;
                }
            });
        }
    });

    const ctx = document.getElementById('cashbackChart');
    
    if (charts.cashbackChart) {
        charts.cashbackChart.destroy();
    }

    charts.cashbackChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cashbackByProduct),
            datasets: [{
                data: Object.values(cashbackByProduct),
                backgroundColor: [
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(46, 204, 113, 0.8)',
                    'rgba(155, 89, 182, 0.8)',
                    'rgba(241, 196, 15, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ₹${value.toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });
}

// Update Crop Chart
function updateCropChart() {
    const cropCounts = {};

    filteredData.forEach(row => {
        if (row['Crops Selected']) {
            const crops = row['Crops Selected'].split(',');
            crops.forEach(crop => {
                const trimmedCrop = crop.trim();
                if (trimmedCrop) {
                    cropCounts[trimmedCrop] = (cropCounts[trimmedCrop] || 0) + 1;
                }
            });
        }
    });

    const sortedCrops = Object.entries(cropCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const ctx = document.getElementById('cropChart');
    
    if (charts.cropChart) {
        charts.cropChart.destroy();
    }

    charts.cropChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: sortedCrops.map(item => item[0]),
            datasets: [{
                data: sortedCrops.map(item => item[1]),
                backgroundColor: [
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(46, 204, 113, 0.8)',
                    'rgba(155, 89, 182, 0.8)',
                    'rgba(241, 196, 15, 0.8)',
                    'rgba(231, 76, 60, 0.8)',
                    'rgba(52, 73, 94, 0.8)',
                    'rgba(26, 188, 156, 0.8)',
                    'rgba(230, 126, 34, 0.8)',
                    'rgba(149, 165, 166, 0.8)',
                    'rgba(192, 57, 43, 0.8)'
                ],
                borderColor: '#ffffff',
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
                        boxWidth: 15,
                        padding: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ${value.toLocaleString()} farmers`;
                        }
                    }
                }
            }
        }
    });
}

// Update District Map
function updateDistrictMap() {
    const districtData = {};
    const filteredFarmerIds = new Set(filteredData.map(row => row['Farmer Mobile']));

    filteredData.forEach(row => {
        const district = row['District'];
        if (district) {
            if (!districtData[district]) {
                districtData[district] = {
                    totalFarmers: new Set(),
                    cashbackWinners: new Set()
                };
            }
            
            districtData[district].totalFarmers.add(row['Farmer Mobile']);
        }
    });

    // Add cashback winners from registry
    farmerCashbackRegistry.forEach((cashbackData, farmerId) => {
        if (filteredFarmerIds.has(farmerId)) {
            // Find district for this farmer
            const farmerRow = filteredData.find(row => row['Farmer Mobile'] === farmerId);
            if (farmerRow && farmerRow['District']) {
                const district = farmerRow['District'];
                if (districtData[district]) {
                    districtData[district].cashbackWinners.add(farmerId);
                }
            }
        }
    });

    const mapContainer = document.getElementById('indiaMap');
    mapContainer.innerHTML = '<div class="map-container"></div>';
    const container = mapContainer.querySelector('.map-container');

    Object.entries(districtData)
        .sort((a, b) => b[1].totalFarmers.size - a[1].totalFarmers.size)
        .forEach(([district, data]) => {
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
            container.appendChild(card);
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
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
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
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true
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
