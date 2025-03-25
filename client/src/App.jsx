import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './components/Header';
import SearchForm from './components/SearchForm';
import ResultsTable from './components/ResultsTable';
import Footer from './components/Footer';
import StoreMap from './components/StoreMap';

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api'
});

const API_URL = process.env.NODE_ENV === 'production' ? 'https://store-collector-api.vercel.app/api' : 'api'

function App() {
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [lastSearchParams, setLastSearchParams] = useState({});
  const [seenIds, setSeenIds] = useState([]);
  const [category, setCategory] = useState('');
  const [selectedStore, setSelectedStore] = useState(null);
  const [centerLocation, setCenterLocation] = useState(null);

  const fetchZipcodes = async () => {
    try {
      const { data } = await api.get('/zipcodes');
      console.log('zipcodes data:', data);
    } catch (err) {
      console.error('Error fetching zipcodes:', err);
    } 
  };

  // useEffect(() => {
  //   fetchZipcodes();
  // }, []);
  
  const handleSearch = async (searchParams) => {
    setIsLoading(true);
    setHasSearched(true);
    setPage(1);
    setSearchResults([]);
    setNextPageToken(null);
    setSeenIds([]);
    setCategory('');
    setSelectedStore(null);
    
    try {
      // Pass the structured data directly
      const response = await axios.post(`${API_URL}/search-stores`, {
        product: searchParams.product,
        retailStore: searchParams.retailStore,
        zipCode: searchParams.zipCode,
        page: 1,
        radius: 10000 // 10km initial radius
      });
      
      // Store the next page token for later use
      setNextPageToken(response.data.nextPageToken);
      
      // Save data for future requests
      setLastSearchParams(searchParams);
      setSeenIds(response.data.seenIds || []);
      setCategory(response.data.category || '');
      setCenterLocation(response.data.location);
      
      // Format the results
      const formattedResults = response.data.results;
      setSearchResults(formattedResults);
      setHasMore(!!response.data.nextPageToken);
      
      // Select the first store if available
      if (formattedResults.length > 0) {
        setSelectedStore(formattedResults[0]);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      let errorMessage = 'Failed to fetch results';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      alert(`Error: ${errorMessage}`);
      
      setSearchResults([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const nextPage = page + 1;
    
    try {
      const response = await axios.post(`${API_URL}/search-stores`, {
        product: lastSearchParams.product,
        retailStore: lastSearchParams.retailStore,
        zipCode: lastSearchParams.zipCode,
        page: nextPage,
        nextPageToken: nextPageToken,
        radius: 10000 * Math.ceil(nextPage / 2), // Increase radius for later pages
        seenIds: seenIds,
        category: category // Pass the category determined earlier
      });
      
      // Update state with new data
      setNextPageToken(response.data.nextPageToken);
      setSeenIds(response.data.seenIds || []);
      
      // Add the new results to existing ones
      const newResults = response.data.results;
      setSearchResults(prev => [...prev, ...newResults]);
      setPage(nextPage);
      setHasMore(!!response.data.nextPageToken);
    } catch (error) {
      console.error('Error loading more results:', error);
      let errorMessage = 'Failed to load more results';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      alert(`Error: ${errorMessage}`);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };
  
  const handleStoreSelect = (store) => {
    setSelectedStore(store);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-6 sm:px-6 lg:px-8 max-w-7xl">
        <SearchForm onSearch={handleSearch} />
        
        {isLoading ? (
          <div className="mt-16 flex flex-col items-center justify-center">
            <div className="relative w-20 h-20">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-700 font-medium">Searching for retail stores...</p>
          </div>
        ) : (
          hasSearched && (
            <div className="space-y-6">
              {/* Show the map if we have search results and a center location */}
              {searchResults.length > 0 && centerLocation && (
                <StoreMap 
                  stores={searchResults} 
                  centerLocation={centerLocation}
                  selectedStore={selectedStore}
                  setSelectedStore={setSelectedStore}
                />
              )}
              
              <ResultsTable 
                results={searchResults} 
                isEmpty={searchResults.length === 0}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
                onSelectStore={handleStoreSelect}
                selectedStore={selectedStore}
              />
              
              {category && (
                <div className="text-sm text-gray-500 text-center">
                  Finding stores related to: <span className="font-medium">{category}</span>
                </div>
              )}
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  );
}

export default App;
