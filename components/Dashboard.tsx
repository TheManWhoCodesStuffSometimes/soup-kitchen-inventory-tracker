import React, { useState, useEffect } from 'react';
import { Button, Spinner, Input, Select } from './ui';
import { fetchDashboardData } from '../services/apiService';
import { DashboardItem, SoupKitchenCategory } from '../types';

interface DashboardProps {
  onNavigateHome: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateHome }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<DashboardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [soupKitchenCategoryFilter, setSoupKitchenCategoryFilter] = useState<string>('');
  const [foodTypeFilter, setFoodTypeFilter] = useState<string>('');
  
  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalItems: 0,
    totalWeight: 0,
    totalValue: 0,
    uniqueForms: 0,
    // NEW: Soup Kitchen Category breakdown
    perishable: { count: 0, value: 0 },
    catering: { count: 0, value: 0 },
    shelfStable: { count: 0, value: 0 }
  });

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Filter items when filters change
  useEffect(() => {
    filterItems();
  }, [items, startDate, endDate, soupKitchenCategoryFilter, foodTypeFilter]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchDashboardData();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = items;

    // Date filtering
    if (startDate && endDate) {
      filtered = filtered.filter(item => {
        const itemDateStr = item["Processing Date"].split('T')[0];
        return itemDateStr >= startDate && itemDateStr <= endDate;
      });
    }

    // Soup Kitchen Category filtering
    if (soupKitchenCategoryFilter) {
      filtered = filtered.filter(item => 
        item["Soup Kitchen Category"] === soupKitchenCategoryFilter
      );
    }

    // Food Type filtering
    if (foodTypeFilter) {
      filtered = filtered.filter(item => 
        item["Food Type"] === foodTypeFilter
      );
    }

    setFilteredItems(filtered);
    calculateSummaryStats(filtered);
  };

  const calculateSummaryStats = (itemsToCalculate: DashboardItem[]) => {
    const stats = itemsToCalculate.reduce(
      (acc, item) => {
        const itemCount = item.Quantity || 0;
        const itemValue = item["Estimated Value"] || 0;
        
        acc.totalItems += itemCount;
        acc.totalWeight += (item["Weight (lbs)"] || 0) * itemCount;
        acc.totalValue += itemValue;
        
        // NEW: Soup Kitchen Category breakdown
        const skCategory = item["Soup Kitchen Category"];
        if (skCategory === 'Perishable') {
          acc.perishable.count += itemCount;
          acc.perishable.value += itemValue;
        } else if (skCategory === 'Catering/Banquet') {
          acc.catering.count += itemCount;
          acc.catering.value += itemValue;
        } else if (skCategory === 'Shelf Stable') {
          acc.shelfStable.count += itemCount;
          acc.shelfStable.value += itemValue;
        }
        
        return acc;
      },
      { 
        totalItems: 0, 
        totalWeight: 0, 
        totalValue: 0, 
        uniqueForms: 0,
        perishable: { count: 0, value: 0 },
        catering: { count: 0, value: 0 },
        shelfStable: { count: 0, value: 0 }
      }
    );

    // Count unique form IDs
    const uniqueFormIds = new Set(itemsToCalculate.map(item => item["Form ID"]));
    stats.uniqueForms = uniqueFormIds.size;

    setSummaryStats(stats);
  };

  // Get unique values for filter dropdowns
  const getUniqueValues = (field: keyof DashboardItem) => {
    const uniqueValues = [...new Set(items.map(item => item[field]))];
    return uniqueValues.filter(value => value && value !== '').sort();
  };

  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      alert('No data to export');
      return;
    }

    // Define CSV headers - UPDATED with new field names
    const headers = [
      'Date Created',
      'Form ID', 
      'Description',
      'Food Type', // UPDATED: was 'Category'
      'Soup Kitchen Category', // NEW
      'Donor Name',
      'Weight (lbs)',
      'Quantity',
      'Total Weight',
      'Estimated Value',
      'Price Per Unit',
      'Confidence Level',
      'Pricing Source'
    ];

    // Convert data to CSV format - UPDATED field references
    const csvData = filteredItems.map(item => [
      new Date(item["Processing Date"]).toLocaleDateString(),
      item["Form ID"],
      `"${item.Description.replace(/"/g, '""')}"`, // Escape quotes
      item["Food Type"], // UPDATED: was item.Category
      item["Soup Kitchen Category"], // NEW
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

  const clearAllFilters = () => {
    setStartDate('');
    setEndDate('');
    setSoupKitchenCategoryFilter('');
    setFoodTypeFilter('');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 xl:p-8 font-sans">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Spinner className="w-12 h-12 mx-auto mb-4" />
              <p className="text-slate-300 text-lg">Loading dashboard data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 xl:p-8 font-sans">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <Button onClick={onNavigateHome} variant="secondary" className="min-h-[44px] touch-manipulation">
              ← Back
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 xl:p-8 font-sans">
        {/* Header - Mobile responsive */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Button onClick={onNavigateHome} variant="secondary" className="min-h-[44px] touch-manipulation">
            ← Back
          </Button>
          <div className="flex-1 px-2 sm:px-4">
            <header className="text-center">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-100">
                Inventory Dashboard
              </h1>
              <p className="mt-2 sm:mt-3 text-sm sm:text-base lg:text-lg text-slate-300">
                View and analyze your recorded inventory data
              </p>
              <div className="mt-3 sm:mt-4 h-1 w-16 sm:w-24 bg-blue-500 mx-auto rounded-full" />
            </header>
          </div>
          <div className="w-16 sm:w-20 lg:w-32"></div>
        </div>

        {/* Filters and Export - Mobile optimized */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:items-end">
            {/* Date filters - Mobile: Full width rows, Desktop: Two columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:contents">
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
            </div>
            
            {/* Category filters - Mobile: Full width rows, Desktop: Two columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:contents">
              <Select
                label="SK Category"
                value={soupKitchenCategoryFilter}
                onChange={(e) => setSoupKitchenCategoryFilter(e.target.value)}
              >
                <option value="">All SK Categories</option>
                <option value="Perishable">Perishable</option>
                <option value="Catering/Banquet">Catering/Banquet</option>
                <option value="Shelf Stable">Shelf Stable</option>
              </Select>
              
              <Select
                label="Food Type"
                value={foodTypeFilter}
                onChange={(e) => setFoodTypeFilter(e.target.value)}
              >
                <option value="">All Food Types</option>
                {getUniqueValues("Food Type").map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>
            
            {/* Action buttons - Mobile: Full width stack, Desktop: Two columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:contents">
              <Button
                onClick={clearAllFilters}
                variant="secondary"
                className="h-12 lg:h-10 touch-manipulation"
              >
                Clear All
              </Button>
              <Button
                onClick={exportToCSV}
                variant="primary"
                className="h-12 lg:h-10 touch-manipulation"
                disabled={filteredItems.length === 0}
              >
                📄 Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Statistics - Mobile responsive grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="bg-slate-800 p-3 sm:p-6 rounded-xl border border-slate-700">
            <h3 className="text-xs sm:text-sm font-medium text-slate-400 mb-1 sm:mb-2">Total Submissions</h3>
            <p className="text-xl sm:text-3xl font-bold text-amber-500">{summaryStats.uniqueForms}</p>
          </div>
          <div className="bg-slate-800 p-3 sm:p-6 rounded-xl border border-slate-700">
            <h3 className="text-xs sm:text-sm font-medium text-slate-400 mb-1 sm:mb-2">Total Items</h3>
            <p className="text-xl sm:text-3xl font-bold text-amber-500">{summaryStats.totalItems}</p>
          </div>
          <div className="bg-slate-800 p-3 sm:p-6 rounded-xl border border-slate-700">
            <h3 className="text-xs sm:text-sm font-medium text-slate-400 mb-1 sm:mb-2">Total Weight</h3>
            <p className="text-xl sm:text-3xl font-bold text-amber-500">{summaryStats.totalWeight.toFixed(1)} lbs</p>
          </div>
          <div className="bg-slate-800 p-3 sm:p-6 rounded-xl border border-slate-700">
            <h3 className="text-xs sm:text-sm font-medium text-slate-400 mb-1 sm:mb-2">Total Value</h3>
            <p className="text-xl sm:text-3xl font-bold text-amber-500">{formatCurrency(summaryStats.totalValue)}</p>
          </div>
        </div>

        {/* Soup Kitchen Category Breakdown - Mobile responsive */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-green-900/30 border border-green-600/30 p-4 sm:p-6 rounded-xl">
            <h3 className="text-sm font-medium text-green-300 mb-2 flex items-center">
              <span className="mr-2">🥬</span>Perishable
            </h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xl sm:text-2xl font-bold text-green-400">{summaryStats.perishable.count}</p>
                <p className="text-xs text-green-300">items</p>
              </div>
              <div className="text-right">
                <p className="text-sm sm:text-lg font-semibold text-green-400">{formatCurrency(summaryStats.perishable.value)}</p>
                <p className="text-xs text-green-300">value</p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-900/30 border border-purple-600/30 p-4 sm:p-6 rounded-xl">
            <h3 className="text-sm font-medium text-purple-300 mb-2 flex items-center">
              <span className="mr-2">🍽️</span>Catering/Banquet
            </h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xl sm:text-2xl font-bold text-purple-400">{summaryStats.catering.count}</p>
                <p className="text-xs text-purple-300">items</p>
              </div>
              <div className="text-right">
                <p className="text-sm sm:text-lg font-semibold text-purple-400">{formatCurrency(summaryStats.catering.value)}</p>
                <p className="text-xs text-purple-300">value</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-900/30 border border-blue-600/30 p-4 sm:p-6 rounded-xl md:col-span-1">
            <h3 className="text-sm font-medium text-blue-300 mb-2 flex items-center">
              <span className="mr-2">📦</span>Shelf Stable
            </h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xl sm:text-2xl font-bold text-blue-400">{summaryStats.shelfStable.count}</p>
                <p className="text-xs text-blue-300">items</p>
              </div>
              <div className="text-right">
                <p className="text-sm sm:text-lg font-semibold text-blue-400">{formatCurrency(summaryStats.shelfStable.value)}</p>
                <p className="text-xs text-blue-300">value</p>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table - Mobile optimized */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
              Inventory Items 
              <span className="text-slate-400 text-sm sm:text-lg ml-2">
                ({filteredItems.length} items)
              </span>
            </h2>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <p className="text-slate-400 text-base sm:text-lg">No items found for the selected filters.</p>
            </div>
          ) : (
            <>
              {/* Mobile: Card view, Desktop: Table view */}
              <div className="block sm:hidden">
                {/* Mobile Card Layout */}
                <div className="divide-y divide-slate-700">
                  {filteredItems.map((item, index) => {
                    const getSKCategoryColor = (category: string) => {
                      switch (category) {
                        case 'Perishable': return 'bg-green-900/50 text-green-300 border-green-600';
                        case 'Catering/Banquet': return 'bg-purple-900/50 text-purple-300 border-purple-600';
                        case 'Shelf Stable': return 'bg-blue-900/50 text-blue-300 border-blue-600';
                        default: return 'bg-slate-700 text-slate-300 border-slate-600';
                      }
                    };

                    return (
                      <div key={item.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="text-slate-200 font-medium text-sm leading-tight pr-2">
                            {item.Description}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                            {formatDate(item["Processing Date"]).split(',')[0]}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">Food Type:</span>
                            <span className="ml-1 px-2 py-1 bg-slate-700 rounded text-slate-300">
                              {item["Food Type"]}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">SK Category:</span>
                            <span className={`ml-1 px-2 py-1 rounded text-xs border ${getSKCategoryColor(item["Soup Kitchen Category"])}`}>
                              {item["Soup Kitchen Category"]}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <div>
                            <span className="text-slate-400">Donor:</span>
                            <span className="ml-1">{item["Donor Name"]}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Weight:</span>
                            <span className="ml-1">{item["Weight (lbs)"]} lbs × {item.Quantity}</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-xs">
                            <span className="text-slate-400">Value:</span>
                            <span className="ml-1 font-medium text-slate-200">
                              {formatCurrency(item["Estimated Value"])}
                            </span>
                            <span className="ml-1 text-slate-500">
                              ({item["Confidence Level"]})
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {item["Form ID"]}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Description</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Food Type</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">SK Category</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Donor</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Weight</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Qty</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Value</th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Form ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredItems.map((item, index) => {
                      // Color coding for SK Category
                      const getSKCategoryColor = (category: string) => {
                        switch (category) {
                          case 'Perishable': return 'bg-green-900/50 text-green-300 border-green-600';
                          case 'Catering/Banquet': return 'bg-purple-900/50 text-purple-300 border-purple-600';
                          case 'Shelf Stable': return 'bg-blue-900/50 text-blue-300 border-blue-600';
                          default: return 'bg-slate-700 text-slate-300 border-slate-600';
                        }
                      };
                      
                      return (
                        <tr key={item.id} className={index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-850'}>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {formatDate(item["Processing Date"])}
                          </td>
                          <td className="px-4 lg:px-6 py-4 text-sm text-slate-200 max-w-xs">
                            <div className="truncate" title={item.Description}>
                              {item.Description}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            <span className="px-2 py-1 bg-slate-700 rounded-full text-xs">
                              {item["Food Type"]}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs border ${getSKCategoryColor(item["Soup Kitchen Category"])}`}>
                              {item["Soup Kitchen Category"]}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {item["Donor Name"]}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {item["Weight (lbs)"]} lbs
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {item.Quantity}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            <div className="flex flex-col">
                              <span className="font-medium">{formatCurrency(item["Estimated Value"])}</span>
                              <span className="text-xs text-slate-400">
                                {item["Confidence Level"]} confidence
                              </span>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">
                            {item["Form ID"]}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Refresh Button */}
        <div className="text-center mt-6 sm:mt-8">
          <Button onClick={loadDashboardData} variant="secondary" className="min-h-[44px] touch-manipulation">
            🔄 Refresh Data
          </Button>
        </div>
      </div>
    </div>
  );
};
