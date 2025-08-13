import React, { useState, useEffect } from 'react';
import { Button, Spinner, Input } from './ui';
import { fetchDashboardData } from '../services/apiService';

interface DashboardItem {
  id: string;
  createdTime: string;
  "Item ID": string;
  "Form ID": string;
  "Total Items in Submission": number;
  "Total Weight in Submission": number;
  "Description": string;
  "Category": string;
  "Donor Name": string;
  "Weight (lbs)": number;
  "Quantity": number;
  "Estimated Value": number;
  "Price Per Unit": number;
  "Confidence Level": string;
  "Pricing Source": string;
  "Search Results Summary": string;
  "Pricing Notes": string;
  "Processing Date": string;
  "Created At": string;
  "Last Modified": string;
}

interface DashboardProps {
  onNavigateHome: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateHome }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<DashboardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Date filtering
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalItems: 0,
    totalWeight: 0,
    totalValue: 0,
    uniqueForms: 0
  });

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    setEndDate(todayStr);
    setStartDate(thirtyDaysAgoStr);
    
    console.log('📅 Default date range set:');
    console.log('  Start:', thirtyDaysAgoStr);
    console.log('  End:', todayStr);
  }, []);

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Filter items when dates change
  useEffect(() => {
    filterItemsByDate();
  }, [items, startDate, endDate]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchDashboardData();
      console.log('🎯 Dashboard received data:', data);
      console.log('📊 Data count:', data.length);
      
      if (data.length > 0) {
        console.log('📄 Sample item dates:');
        data.slice(0, 3).forEach((item, index) => {
          console.log(`  Item ${index + 1}:`, item.createdTime, new Date(item.createdTime).toLocaleDateString());
        });
      }
      
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const filterItemsByDate = () => {
    console.log('🔍 Starting date filtering...');
    console.log('📅 Filter range:', startDate, 'to', endDate);
    console.log('📦 Total items before filtering:', items.length);
    
    if (!startDate || !endDate) {
      console.log('⚠️ No date range set, showing all items');
      setFilteredItems(items);
      calculateSummaryStats(items);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the entire end date
    
    console.log('📅 Parsed date range:');
    console.log('  Start:', start.toISOString());
    console.log('  End:', end.toISOString());

    const filtered = items.filter((item, index) => {
      const itemDate = new Date(item.createdTime);
      const isInRange = itemDate >= start && itemDate <= end;
      
      if (index < 3) { // Log first 3 items for debugging
        console.log(`📄 Item ${index + 1}:`, {
          description: item.Description.substring(0, 30) + '...',
          createdTime: item.createdTime,
          parsedDate: itemDate.toISOString(),
          isInRange: isInRange
        });
      }
      
      return isInRange;
    });

    console.log('✅ Items after filtering:', filtered.length);
    setFilteredItems(filtered);
    calculateSummaryStats(filtered);
  };

  const calculateSummaryStats = (itemsToCalculate: DashboardItem[]) => {
    const stats = itemsToCalculate.reduce(
      (acc, item) => ({
        totalItems: acc.totalItems + (item.Quantity || 0),
        totalWeight: acc.totalWeight + (item["Weight (lbs)"] || 0) * (item.Quantity || 0),
        totalValue: acc.totalValue + (item["Estimated Value"] || 0),
        uniqueForms: acc.uniqueForms
      }),
      { totalItems: 0, totalWeight: 0, totalValue: 0, uniqueForms: 0 }
    );

    // Count unique form IDs
    const uniqueFormIds = new Set(itemsToCalculate.map(item => item["Form ID"]));
    stats.uniqueForms = uniqueFormIds.size;

    setSummaryStats(stats);
  };

  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      alert('No data to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Date Created',
      'Form ID', 
      'Description',
      'Category',
      'Donor Name',
      'Weight (lbs)',
      'Quantity',
      'Total Weight',
      'Estimated Value',
      'Price Per Unit',
      'Confidence Level',
      'Pricing Source'
    ];

    // Convert data to CSV format
    const csvData = filteredItems.map(item => [
      new Date(item.createdTime).toLocaleDateString(),
      item["Form ID"],
      `"${item.Description.replace(/"/g, '""')}"`, // Escape quotes
      item.Category,
      item["Donor Name"],
      item["Weight (lbs)"],
      item.Quantity,
      (item["Weight (lbs)"] * item.Quantity).toFixed(2),
      item["Estimated Value"].toFixed(2),
      item["Price Per Unit"].toFixed(2),
      item["Confidence Level"],
      item["Pricing Source"]
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const dateRange = startDate && endDate 
      ? `${startDate}_to_${endDate}`
      : new Date().toISOString().split('T')[0];
    
    link.setAttribute('download', `inventory_export_${dateRange}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // CLEAR ALL FILTERS FUNCTION
  const clearAllFilters = () => {
    console.log('🧹 Clearing all date filters');
    setStartDate('');
    setEndDate('');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Spinner className="w-12 h-12 mx-auto mb-4" />
            <p className="text-slate-300 text-lg">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
        <div className="flex items-center justify-between mb-8">
          <Button onClick={onNavigateHome} variant="secondary">
            ← Back to Main
          </Button>
        </div>
        <div className="bg-red-900/50 border border-red-600/50 rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold text-red-300 mb-2">Error Loading Data</h3>
          <p className="text-red-200 mb-4">{error}</p>
          <Button onClick={loadDashboardData} variant="primary">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Button onClick={onNavigateHome} variant="secondary">
          ← Back to Main
        </Button>
        <div className="flex-1">
          <header className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-100 sm:text-5xl">Inventory Dashboard</h1>
            <p className="mt-3 text-lg text-slate-300">View and analyze your recorded inventory data</p>
            <div className="mt-4 h-1 w-24 bg-blue-500 mx-auto rounded-full" />
          </header>
        </div>
        <div className="w-32"></div>
      </div>

      {/* DEBUG INFO */}
      <div className="bg-slate-700 rounded-lg p-4 mb-6 text-sm">
        <h3 className="text-slate-200 font-bold mb-2">🔧 Debug Info:</h3>
        <div className="text-slate-300 space-y-1">
          <div>📦 Total items loaded: <span className="text-green-400">{items.length}</span></div>
          <div>🔍 Items after filtering: <span className="text-blue-400">{filteredItems.length}</span></div>
          <div>📅 Date range: <span className="text-yellow-400">{startDate || 'none'}</span> to <span className="text-yellow-400">{endDate || 'none'}</span></div>
          {items.length > 0 && (
            <div>📄 Sample date: <span className="text-purple-400">{items[0]?.createdTime}</span></div>
          )}
        </div>
      </div>

      {/* Filters and Export */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End Date" 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Button
            onClick={clearAllFilters}
            variant="secondary"
            className="h-10"
          >
            Clear Filters
          </Button>
          <Button
            onClick={exportToCSV}
            variant="primary"
            className="h-10"
            disabled={filteredItems.length === 0}
          >
            📄 Export CSV
          </Button>
          <Button
            onClick={loadDashboardData}
            variant="secondary"
            className="h-10"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Total Submissions</h3>
          <p className="text-3xl font-bold text-amber-500">{summaryStats.uniqueForms}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Total Items</h3>
          <p className="text-3xl font-bold text-amber-500">{summaryStats.totalItems}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Total Weight</h3>
          <p className="text-3xl font-bold text-amber-500">{summaryStats.totalWeight.toFixed(1)} lbs</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Total Value</h3>
          <p className="text-3xl font-bold text-amber-500">{formatCurrency(summaryStats.totalValue)}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-slate-100">
            Inventory Items 
            <span className="text-slate-400 text-lg ml-2">
              ({filteredItems.length} items shown)
            </span>
            {items.length !== filteredItems.length && (
              <span className="text-yellow-400 text-sm ml-2">
                ({items.length - filteredItems.length} filtered out)
              </span>
            )}
          </h2>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            {items.length === 0 ? (
              <p className="text-slate-400 text-lg">No inventory data found.</p>
            ) : (
              <div>
                <p className="text-slate-400 text-lg mb-4">No items found for the selected date range.</p>
                <Button onClick={clearAllFilters} variant="secondary">
                  Clear Date Filters to Show All Items
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Donor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Weight</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Form ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredItems.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-850'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {formatDate(item.createdTime)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-200 max-w-xs">
                      <div className="truncate" title={item.Description}>
                        {item.Description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <span className="px-2 py-1 bg-slate-700 rounded-full text-xs">
                        {item.Category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {item["Donor Name"]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {item["Weight (lbs)"]} lbs
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {item.Quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div className="flex flex-col">
                        <span className="font-medium">{formatCurrency(item["Estimated Value"])}</span>
                        <span className="text-xs text-slate-400">
                          {item["Confidence Level"]} confidence
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">
                      {item["Form ID"]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
