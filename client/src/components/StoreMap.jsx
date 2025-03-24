import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '300px', // Smaller height on mobile
  borderRadius: '0.5rem'
};

// Additional styles for larger screens applied in the component

function StoreMap({ stores, centerLocation, selectedStore, setSelectedStore }) {
  // Track if the Maps API is loaded
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapContainerHeight, setMapContainerHeight] = useState('300px');
  const mapRef = useRef(null);
  
  // Use the useJsApiLoader hook instead of LoadScript component
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_API_KEY,
    id: 'google-map-script' // Important: this ensures the script is loaded only once
  });
  
  const handleMarkerClick = (store) => {
    setSelectedStore(store);
  };

  // Handle Maps API load event
  const handleLoad = (map) => {
    mapRef.current = map;
    setMapsLoaded(true);
  };
  
  const handleUnmount = () => {
    mapRef.current = null;
  };

  // Update map height based on screen size
  useEffect(() => {
    const updateMapHeight = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setMapContainerHeight('400px');
      } else if (window.innerWidth >= 640) { // sm breakpoint
        setMapContainerHeight('350px');
      } else {
        setMapContainerHeight('300px');
      }
    };

    // Set initial height
    updateMapHeight();
    
    // Add resize listener
    window.addEventListener('resize', updateMapHeight);
    
    // Cleanup
    return () => window.removeEventListener('resize', updateMapHeight);
  }, []);
  
  // Ensure we have valid data
  if (!stores || stores.length === 0 || !centerLocation) return null;
  
  // Show loading indicator while Google Maps loads
  if (!isLoaded) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-medium text-gray-900">Store Locations</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Loading map...</p>
        </div>
        <div className="flex items-center justify-center" style={{height: mapContainerHeight}}>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  // Show error if Google Maps failed to load
  if (loadError) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-medium text-gray-900">Store Locations</h2>
          <p className="text-xs sm:text-sm text-red-500 mt-1">Error loading map. Please refresh the page.</p>
        </div>
        <div className="p-6 text-center text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="mt-2">Failed to load Google Maps</p>
        </div>
      </div>
    );
  }

  const responsiveMapContainerStyle = {
    ...mapContainerStyle,
    height: mapContainerHeight
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-gray-200">
        <h2 className="text-base sm:text-lg font-medium text-gray-900">Store Locations</h2>
        {selectedStore ? (
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Showing {stores.length} stores • <span className="font-medium truncate">{selectedStore.name}</span> selected
          </p>
        ) : (
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Showing {stores.length} stores • Click a marker to see store details
          </p>
        )}
      </div>
      
      {/* Using GoogleMap directly instead of wrapping in LoadScript */}
      <GoogleMap
        mapContainerStyle={responsiveMapContainerStyle}
        center={selectedStore?.location || centerLocation}
        zoom={selectedStore ? 14 : 11}
        onLoad={handleLoad}
        onUnmount={handleUnmount}
        options={{
          fullscreenControl: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
        }}
      >
        {/* Center Pin for ZIP code */}
        {centerLocation && (
          <Marker
            position={centerLocation}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
              scaledSize: mapsLoaded ? new window.google.maps.Size(30, 30) : null
            }}
          />
        )}
        
        {/* Store markers */}
        {stores && stores.map((store) => (
          <Marker
            key={store.placeId}
            position={store.location}
            onClick={() => handleMarkerClick(store)}
            // Only apply animation if Maps API is loaded
            animation={mapsLoaded && selectedStore?.placeId === store.placeId 
              ? window.google.maps.Animation.BOUNCE 
              : null}
          />
        ))}
        
        {/* Info window for selected store */}
        {selectedStore && (
          <InfoWindow
            position={selectedStore.location}
            onCloseClick={() => setSelectedStore(null)}
          >
            <div className="p-2 max-w-[250px]">
              <h3 className="font-medium text-gray-900 text-sm truncate">{selectedStore.name}</h3>
              
              {selectedStore.photoUrl && (
                <img 
                  src={selectedStore.photoUrl} 
                  alt={selectedStore.name} 
                  className="w-full h-20 object-cover my-2 rounded"
                />
              )}
              
              <p className="text-xs text-gray-700 mt-1 truncate">{selectedStore.address}</p>
              
              <div className="mt-2 text-xs">
                {selectedStore.phone !== 'N/A' && (
                  <p className="text-gray-700 truncate">
                    <span className="inline-block w-5">📞</span> {selectedStore.phone}
                  </p>
                )}
                
                {selectedStore.email !== 'N/A' && (
                  <p className="text-gray-700 truncate">
                    <span className="inline-block w-5">✉️</span> {selectedStore.email}
                  </p>
                )}
                
                <p className="text-gray-700">
                  <span className="inline-block w-5">📍</span> {selectedStore.distanceText} away
                </p>
                
                {selectedStore.rating && (
                  <p className="text-gray-700">
                    <span className="inline-block w-5">⭐</span> {selectedStore.rating}/5
                  </p>
                )}
              </div>
              
              <div className="mt-2 flex gap-2">
                {selectedStore.website && (
                  <a 
                    href={selectedStore.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    Website
                  </a>
                )}
                
                <a 
                  href={selectedStore.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                >
                  Directions
                </a>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

export default StoreMap; 