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
  const [searchStrategy, setSearchStrategy] = useState('primary');
  const [currentDistanceRange, setCurrentDistanceRange] = useState(1);

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
    setSearchStrategy('primary');
    setCurrentDistanceRange(1); // Reset to first distance range
    
    try {
      // Pass the structured data directly
      const response = await axios.post(`${API_URL}/search-stores`, {
        product: searchParams.product,
        retailStore: searchParams.retailStore,
        zipCode: searchParams.zipCode,
        page: 1,
        baseRadius: 5000, // 5km base radius
        searchStrategy: 'primary', // Always start with primary strategy
        currentDistanceRange: 1 // Start with first distance range
      });
      
      // Log debugging information
      if (response.data.debug) {
        console.log('===== INITIAL SEARCH DEBUG =====');
        console.log(`Strategy: ${response.data.debug.strategy}, Range: ${response.data.debug.range}`);
        console.log(`Places found: ${response.data.debug.placesFound}, New places: ${response.data.debug.newPlaces}`);
        console.log(`After distance filter: ${response.data.debug.afterDistanceFilter}`);
        console.log(`NextPageToken: ${response.data.debug.hasNextPageToken}`);
        console.log(`Unique stores: ${response.data.debug.uniqueStoresCount}`);
        console.log(`Has more: ${response.data.hasMore}`);
        console.log('================================');
      }
      
      // Store the next page token for later use
      setNextPageToken(response.data.nextPageToken);
      
      // Save data for future requests
      setLastSearchParams(searchParams);
      setSeenIds(response.data.seenIds || []);
      setCategory(response.data.category || '');
      setCenterLocation(response.data.location);
      setSearchStrategy(response.data.searchStrategy || 'primary');
      setCurrentDistanceRange(response.data.currentDistanceRange || 1);
      
      // Format the results
      const formattedResults = response.data.results;
      setSearchResults(formattedResults);
      setHasMore(!!response.data.hasMore || !!response.data.nextPageToken);
      
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
    
    // Set a flag to track whether we've successfully found new results
    let foundNewResults = false;
    // Set a maximum number of automatic retries to avoid infinite loops
    let maxRetries = 3;
    let retryCount = 0;
    
    // Keep trying until we find new results or hit retry limit
    while (!foundNewResults && retryCount < maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1} to load more stores (page ${nextPage})`);
        
        const response = await axios.post(`${API_URL}/search-stores`, {
          product: lastSearchParams.product,
          retailStore: lastSearchParams.retailStore,
          zipCode: lastSearchParams.zipCode,
          page: nextPage,
          nextPageToken: nextPageToken,
          baseRadius: 5000, // 5km base radius
          seenIds: seenIds,
          category: category,
          searchStrategy: nextPageToken ? 'primary' : searchStrategy,
          currentDistanceRange: currentDistanceRange // Pass the current distance range
        });
        
        // Log debugging information
        if (response.data.debug) {
          console.log('===== SEARCH DEBUG (CLIENT) =====');
          console.log(`Strategy: ${response.data.debug.strategy}, Range: ${response.data.debug.range}`);
          console.log(`Places found: ${response.data.debug.placesFound}, New places: ${response.data.debug.newPlaces}`);
          console.log(`After distance filter: ${response.data.debug.afterDistanceFilter}`);
          console.log(`NextPageToken: ${response.data.debug.hasNextPageToken}`);
          console.log(`Unique stores: ${response.data.debug.uniqueStoresCount}`);
          console.log(`Has more: ${response.data.hasMore}`);
          console.log('================================');
        }
        
        // Update state with new data
        setNextPageToken(response.data.nextPageToken);
        setSeenIds(response.data.seenIds || []);
        setSearchStrategy(response.data.searchStrategy || 'primary');
        setCurrentDistanceRange(response.data.currentDistanceRange || currentDistanceRange);
        
        // Add the new results to existing ones
        const newResults = response.data.results;
        
        // If we got new results, mark as successful and exit the retry loop
        if (newResults.length > 0) {
          console.log(`Found ${newResults.length} new stores`);
          foundNewResults = true;
          
          setSearchResults(prev => {
            // Combine and sort by distance
            const combined = [...prev, ...newResults];
            return combined.sort((a, b) => a.distance - b.distance);
          });
          
          setPage(nextPage);
          setHasMore(!!response.data.hasMore);
          break; // Exit the retry loop
        }
        
        // If no new results but switching strategy/range, update state and try again
        if (newResults.length === 0 && response.data.hasMore) {
          console.log('No new results in current request, but more may be available');
          // Update strategy and range for next attempt
          setSearchStrategy(response.data.searchStrategy);
          setCurrentDistanceRange(response.data.currentDistanceRange);
          
          retryCount++;
          
          // Give the server a moment before retrying
          if (retryCount < maxRetries) {
            console.log(`Waiting before retry attempt ${retryCount + 1}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          // If we have no new results and no more to fetch, exit the loop
          console.log('No more stores to fetch');
          setHasMore(false);
          break;
        }
      } catch (error) {
        console.error('Error loading more results:', error);
        let errorMessage = 'Failed to load more results';
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
        alert(`Error: ${errorMessage}`);
        setHasMore(false);
        break; // Exit the retry loop on error
      }
    }
    
    // After all retries, if we still haven't found new results but the server says there are more,
    // increment the page number and update the UI to prepare for the next attempt
    if (!foundNewResults && hasMore) {
      console.log('Continuing search on next user action');
      setPage(nextPage);
    }
    
    setLoadingMore(false);
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
                currentDistanceRange={currentDistanceRange}
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
