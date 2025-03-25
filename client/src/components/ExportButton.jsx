import React from 'react';

function ExportButton({ results }) {
  const exportToExcel = () => {
    // This is just a placeholder implementation
    // In a real app, you would use a library like xlsx to generate the Excel file
    try {
      // Create CSV content
      const headers = ['Store Name', 'Address', 'Phone', 'Email', 'Website', 'Distance'];
      const csvRows = [headers];
      
      // Add data rows
      results.forEach(store => {
        // Format the address to include city, state, and country
        let fullAddress = store.address || '';
        
        // If the address doesn't already include the city/state/country info, add it
        if (store.city || store.state || store.country) {
          // Only add comma if the address isn't empty and doesn't already end with a comma
          if (fullAddress && !fullAddress.trim().endsWith(',')) {
            fullAddress += ', ';
          }
          
          // Add city if available
          if (store.city) {
            fullAddress += store.city;
            // Add comma if state or country follows
            if (store.state || store.country) {
              fullAddress += ', ';
            }
          }
          
          // Add state if available
          if (store.state) {
            fullAddress += store.state;
            // Add comma if country follows
            if (store.country) {
              fullAddress += ', ';
            }
          }
          
          // Add country if available
          if (store.country) {
            fullAddress += store.country;
          }
        }
        
        csvRows.push([
          store.name,
          fullAddress, // Use the combined address field
          store.phone,
          store.email,
          store.website || 'N/A',
          store.distanceText || 'N/A'
        ]);
      });
      
      // Convert to CSV string
      const csvContent = csvRows.map(row => 
        row.map(cell => {
          // Properly escape fields containing commas, quotes, or newlines
          if (cell && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      ).join('\n');
      
      // Create a Blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `retail_stores_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  return (
    <button 
      onClick={exportToExcel} 
      disabled={results.length === 0}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Export Results
    </button>
  );
}

export default ExportButton; 