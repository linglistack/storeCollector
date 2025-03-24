import React from 'react';
import ExportButton from './ExportButton';

function ResultsTable({ 
  results, 
  isEmpty, 
  hasMore, 
  loadingMore, 
  onLoadMore, 
  onSelectStore,
  selectedStore
}) {
  if (isEmpty) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-4 flex h-12 sm:h-16 w-12 sm:w-16 items-center justify-center rounded-full bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 sm:h-8 w-6 sm:w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900">No stores found</h3>
          <p className="mt-2 text-xs sm:text-sm text-gray-500">
            We couldn't find any retail stores matching your search criteria. Try adjusting your search parameters or expanding your search area.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 border-b border-gray-200 bg-gray-50/50 p-3 sm:p-4 md:px-6">
          <div>
            <h2 className="text-base sm:text-lg font-medium text-gray-900">Matching Retail Stores</h2>
            <p className="text-xs sm:text-sm text-gray-500">Found {results.length} stores sorted by distance</p>
          </div>
          
          <div className="flex-shrink-0">
            <ExportButton results={results} />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4 md:w-1/5">
                  Store Name
                </th>
                <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  Distance
                </th>
                <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4 md:w-1/5">
                  Contact
                </th>
                <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4 md:w-1/5">
                  Address
                </th>
                <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 md:w-1/5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map(store => (
                <tr 
                  key={store.placeId} 
                  className={`hover:bg-blue-50 transition-colors cursor-pointer ${selectedStore?.placeId === store.placeId ? 'bg-blue-50' : ''}`}
                  onClick={() => onSelectStore(store)}
                >
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">
                    <div className="font-medium text-gray-900 truncate max-w-[150px] sm:max-w-[200px] md:max-w-[250px]">
                      {store.name}
                    </div>
                    {store.rating && (
                      <span className="text-yellow-500 text-xs">
                        {Array(Math.round(store.rating)).fill('⭐').join('')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {store.distanceText}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                    <div>
                      {store.phone !== 'N/A' && (
                        <div className="mb-1 truncate max-w-[150px] sm:max-w-[200px]">📞 {store.phone}</div>
                      )}
                      {store.email !== 'N/A' && (
                        <div className="truncate max-w-[150px] sm:max-w-[200px]">✉️ {store.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                    <div className="truncate max-w-[150px] sm:max-w-[200px] md:max-w-[250px]">
                      {store.address}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStore(store);
                        }}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                      >
                        <svg className="mr-1 h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        Map
                      </button>
                      
                      {store.website && (
                        <a 
                          href={store.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="mr-1 h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Site
                        </a>
                      )}
                      
                      <a 
                        href={store.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="mr-1 h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12 1.586l-4 4V12a1 1 0 001 1h6a1 1 0 001-1V5.586l-4-4zM4 3a1 1 0 011-1h10a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V3z" clipRule="evenodd" />
                        </svg>
                        Directions
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {hasMore && (
        <div className="flex justify-center">
          <button 
            onClick={onLoadMore} 
            disabled={loadingMore}
            className="relative inline-flex h-8 sm:h-10 min-w-[160px] sm:min-w-[200px] items-center justify-center rounded-full border border-gray-300 bg-white px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70"
          >
            {/* Normal state - visible when not loading */}
            <span className={`flex items-center transition-opacity duration-200 ${loadingMore ? 'opacity-0' : 'opacity-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Load More Stores
            </span>
            
            {/* Loading state - positioned absolutely to avoid layout shift */}
            <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${loadingMore ? 'opacity-100' : 'opacity-0'}`}>
              <svg className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
          </button>
        </div>
      )}
      
      {!hasMore && results.length > 0 && (
        <div className="flex justify-center">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            No more stores found in this area
          </span>
        </div>
      )}
    </div>
  );
}

export default ResultsTable;