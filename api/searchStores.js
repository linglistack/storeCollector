const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

// API keys
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com/v1';

/**
 * Search for retail stores using Google Maps Places API with DeepSeek categorization
 * @route POST /api/search-stores
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    console.log("Request body:", req.body);
    const { 
      product, 
      retailStore, 
      zipCode, 
      page = 1,
      baseRadius = 5000, // Base radius in meters (5km)
      seenIds = [],
      searchStrategy = 'primary',
      currentDistanceRange = 1 // Track which distance range we're on
    } = req.body;
    
    // Ensure we have the basic search parameters
    if (!product && !retailStore) {
      return res.status(400).json({ error: 'Product or retailStore is required' });
    }
    
    if (!zipCode) {
      return res.status(400).json({ error: 'ZIP code is required' });
    }

    // Step 1: Use DeepSeek to determine the appropriate business categories for the product
    let category = '';
    
    if (!req.body.category && page === 1) {
      console.log(`Using DeepSeek to determine category for product: ${product}`);
      
      try {
        const deepseekResponse = await axios.post(
          `${DEEPSEEK_API_BASE_URL}/chat/completions`,
          {
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: `You are an assistant that helps determine the most relevant Google Places API category for products. You should return ONLY the best-matching category name, with no additional text or explanation.`
              },
              {
                role: "user",
                content: `What is the most appropriate Google Places business category or search keyword for finding stores that sell: "${product}"? Return ONLY the category or search term, nothing else.`
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        category = deepseekResponse.data.choices[0].message.content.trim();
        console.log(`DeepSeek determined category: "${category}" for product: "${product}"`);
      } catch (error) {
        console.error('Error determining category with DeepSeek:', error.message);
        // Fall back to using the product name directly
        category = product;
      }
    } else {
      // Use the category from the request if provided (for pagination)
      category = req.body.category || product;
    }

    // Step 2: Get geocode for the ZIP code
    const geocodeResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${zipCode}&key=${GOOGLE_API_KEY}`
    );
    
    if (geocodeResponse.data.status !== 'OK') {
      throw new Error(`Geocoding error: ${geocodeResponse.data.status}`);
    }
    
    const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
    console.log(`Geocoded ZIP ${zipCode} to lat: ${lat}, lng: ${lng}`);
    
    // Step 3: Construct search query for Google Places
    let searchQuery = retailStore ? retailStore : '';
    if (category) {
      searchQuery += (searchQuery ? ' ' : '') + category;
    }
    
    // Calculate the search radius based on the current distance range
    // Distance ranges increase as follows: 0-5km, 5-10km, 10-15km, 15-20km, etc.
    const distanceMultiplier = req.body.currentDistanceRange || currentDistanceRange;
    const minRadius = (distanceMultiplier - 1) * baseRadius;
    const maxRadius = distanceMultiplier * baseRadius;
    
    console.log(`Using distance range ${distanceMultiplier}: ${minRadius/1000}km to ${maxRadius/1000}km`);
    
    let placesResponse;
    let alternativeSearch = false;
    let useDistanceFilter = true; // Flag to indicate if we should filter by distance
    
    // Use different search strategies based on the current state
    const nextPageToken = req.body.nextPageToken;
    
    if (nextPageToken) {
      // Use the page token for pagination (Google's built-in pagination)
      console.log(`Using page token for page ${page}`);
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextPageToken}&key=${GOOGLE_API_KEY}`
      );
      
      // If we're using a page token, we need to wait a bit for the results to be ready
      if (placesResponse.data.status === 'INVALID_REQUEST') {
        console.log('Page token not ready yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        placesResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextPageToken}&key=${GOOGLE_API_KEY}`
        );
      }
    } else if (searchStrategy === 'primary') {
      // Primary search strategy - standard nearby search
      // For primary search, we use the max radius but will filter results by distance later
      console.log(`Primary search for "${searchQuery}" near ${lat},${lng} with radius ${maxRadius}m`);
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${maxRadius}&keyword=${encodeURIComponent(searchQuery)}&type=store&key=${GOOGLE_API_KEY}`
      );
    } else if (searchStrategy === 'grid') {
      // Grid search strategy - search in a grid pattern around the original location
      // Calculate grid coordinates based on the page number
      // Use a 3x3 grid around the original point
      const gridSize = 3;
      const gridIndex = page % (gridSize * gridSize); // To cycle through grid positions
      const gridRow = Math.floor(gridIndex / gridSize);
      const gridCol = gridIndex % gridSize;
      
      // Offset in degrees (approximately 1km per 0.01 degrees)
      // Scale offset based on current distance range
      const baseOffset = 0.01 * distanceMultiplier;
      
      // Calculate new center point
      const gridLat = lat + ((gridRow - 1) * baseOffset);
      const gridLng = lng + ((gridCol - 1) * baseOffset);
      
      console.log(`Grid search (#${gridIndex}) at coordinates ${gridLat},${gridLng}, distance range: ${minRadius/1000}km-${maxRadius/1000}km`);
      
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${gridLat},${gridLng}&radius=${maxRadius}&keyword=${encodeURIComponent(searchQuery)}&type=store&key=${GOOGLE_API_KEY}`
      );
      alternativeSearch = true;
    } else if (searchStrategy === 'keyword') {
      // Keyword variation strategy - try different related keywords
      // Define alternative keywords based on the product/category
      const keywords = [
        `${category} store`,
        `buy ${category}`,
        `${category} retailer`,
        `${category} shop`,
        `purchase ${category}`,
        retailStore || ''
      ].filter(k => k); // Remove empty strings
      
      // Choose keyword based on page number
      const keywordIndex = page % keywords.length;
      const keyword = keywords[keywordIndex];
      
      console.log(`Keyword search using: "${keyword}" near ${lat},${lng}, distance range: ${minRadius/1000}km-${maxRadius/1000}km`);
      
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${maxRadius}&keyword=${encodeURIComponent(keyword)}&type=store&key=${GOOGLE_API_KEY}`
      );
      alternativeSearch = true;
    } else if (searchStrategy === 'type') {
      // Type-based search - use different Google place types
      // Define common retail place types
      const placeTypes = [
        'store', 
        'shopping_mall', 
        'department_store', 
        'supermarket', 
        'electronics_store',
        'home_goods_store',
        'clothing_store',
        'furniture_store'
      ];
      
      // Choose type based on page number
      const typeIndex = page % placeTypes.length;
      const placeType = placeTypes[typeIndex];
      
      console.log(`Type search using: "${placeType}" near ${lat},${lng}, distance range: ${minRadius/1000}km-${maxRadius/1000}km`);
      
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${maxRadius}&keyword=${encodeURIComponent(category)}&type=${placeType}&key=${GOOGLE_API_KEY}`
      );
      alternativeSearch = true;
      
      // For type-based searches with larger distance ranges, don't filter as strictly by distance
      if (distanceMultiplier > 3) {
        useDistanceFilter = false;
      }
    } else {
      // Fallback search - just use the product keyword directly
      console.log(`Fallback search for "${product}" near ${lat},${lng}, distance range: ${minRadius/1000}km-${maxRadius/1000}km`);
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${maxRadius}&keyword=${encodeURIComponent(product)}&key=${GOOGLE_API_KEY}`
      );
      alternativeSearch = true;
      useDistanceFilter = false; // For fallback, don't restrict by distance
    }
    
    if (placesResponse.data.status !== 'OK' && placesResponse.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places API error: ${placesResponse.data.status}`);
    }
    
    // Step 4: Process each result to get detailed information
    const places = placesResponse.data.results;
    console.log(`Found ${places.length} places in the search`);
    
    // Filter out places we've already seen
    let newPlaces = places.filter(place => !seenIds.includes(place.place_id));
    console.log(`Filtered to ${newPlaces.length} new places after removing seen places`);
    
    // Pre-calculate distances to filter by distance range
    let placesWithDistance = await Promise.all(newPlaces.map(async (place) => {
      const distance = calculateDistance(
        lat, lng, 
        place.geometry.location.lat, place.geometry.location.lng
      );
      return { place, distance };
    }));
    
    // Filter by distance range, if applicable
    if (useDistanceFilter) {
      // For the first distance range, include everything up to maxRadius
      if (distanceMultiplier === 1) {
        placesWithDistance = placesWithDistance.filter(({ distance }) => {
          return distance < maxRadius/1000;
        });
      } else {
        placesWithDistance = placesWithDistance.filter(({ distance }) => {
          return distance >= minRadius/1000 && distance < maxRadius/1000;
        });
      }
      console.log(`Filtered to ${placesWithDistance.length} places in distance range ${distanceMultiplier === 1 ? 0 : minRadius/1000}km-${maxRadius/1000}km`);
    }
    
    // Sort by distance (important for the user experience)
    placesWithDistance.sort((a, b) => a.distance - b.distance);
    
    // Extract places after filtering and sorting
    newPlaces = placesWithDistance.map(item => item.place);
    
    // If we've run out of new places and have tried other strategies, try extended search
    // This is a more comprehensive search that combines multiple approaches
    if (newPlaces.length === 0 && searchStrategy === 'type' && distanceMultiplier > 8 && page > 40) {
      console.log('Attempting extended search to find additional stores...');
      
      // Try a text search instead of nearby search for more results
      try {
        console.log(`Extended search: text search for "${searchQuery}" near ${lat},${lng}`);
        const textSearchResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&location=${lat},${lng}&radius=${maxRadius}&type=store&key=${GOOGLE_API_KEY}`
        );
        
        if (textSearchResponse.data.status === 'OK') {
          const textSearchPlaces = textSearchResponse.data.results;
          console.log(`Extended search found ${textSearchPlaces.length} places via text search`);
          
          // Filter out places we've already seen
          const newTextSearchPlaces = textSearchPlaces.filter(place => !seenIds.includes(place.place_id));
          console.log(`Filtered to ${newTextSearchPlaces.length} new places from text search`);
          
          if (newTextSearchPlaces.length > 0) {
            newPlaces = newTextSearchPlaces;
            nextSearchStrategy = 'extended';
            console.log('Using results from extended search');
          }
        }
      } catch (error) {
        console.error('Error in extended text search:', error.message);
      }
      
      // If text search didn't find anything, try findplacefromtext endpoint
      if (newPlaces.length === 0) {
        try {
          // This endpoint works differently - it finds exact matches for specific stores
          // Try specific retail chains that might sell the product
          const retailers = [
            retailStore,
            `${category} store`,
            `${product} retailer`,
            `${product} store`,
            "walmart",
            "target",
            "best buy",
            "home depot",
            "lowes",
            "costco",
            "whole foods",
            "trader joes",
            "kroger",
            "safeway",
            "publix",
            "walgreens",
            "cvs"
          ].filter(r => r); // Remove empty/undefined values
          
          // Try a few popular retailers
          for (const retailer of retailers.slice(0, 5)) { // Limit to 5 to avoid too many requests
            console.log(`Extended search: finding place from text for "${retailer}" near ${lat},${lng}`);
            const findPlaceResponse = await axios.get(
              `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(retailer)}&inputtype=textquery&locationbias=circle:${maxRadius}@${lat},${lng}&fields=place_id,name,geometry,formatted_address,types&key=${GOOGLE_API_KEY}`
            );
            
            if (findPlaceResponse.data.status === 'OK' && findPlaceResponse.data.candidates.length > 0) {
              const findPlaceCandidates = findPlaceResponse.data.candidates;
              console.log(`Extended search found ${findPlaceCandidates.length} places via findplacefromtext for "${retailer}"`);
              
              // Filter out places we've already seen
              const newFindPlaceCandidates = findPlaceCandidates.filter(place => !seenIds.includes(place.place_id));
              
              if (newFindPlaceCandidates.length > 0) {
                // For findplacefromtext, we need to convert the candidates to the standard format
                newPlaces = newFindPlaceCandidates.map(candidate => ({
                  ...candidate,
                  geometry: candidate.geometry,
                  vicinity: candidate.formatted_address
                }));
                nextSearchStrategy = 'extended';
                console.log(`Using results from extended search (findplacefromtext for "${retailer}")`);
                break; // Stop after finding at least one result
              }
            }
          }
        } catch (error) {
          console.error('Error in findplacefromtext search:', error.message);
        }
      }
    }
    
    // If we've run out of new places, determine next search strategy
    let nextSearchStrategy = searchStrategy;
    let nextDistanceRange = distanceMultiplier;
    
    // Determine if we should move to the next distance range or switch strategies
    if (newPlaces.length === 0 && !placesResponse.data.next_page_token) {
      if (searchStrategy === 'primary') {
        // If primary strategy has no results in current range, try next range
        if (distanceMultiplier < 15) { // Increase max distance to 75km (15 * 5km)
          nextDistanceRange = distanceMultiplier + 1;
          console.log(`Increasing distance range to ${nextDistanceRange}`);
        } else {
          // If we've exhausted reasonable distance ranges, switch to grid strategy
          nextSearchStrategy = 'grid';
          nextDistanceRange = 1; // Reset to first distance range
          console.log('Switching to grid search strategy, resetting distance range');
        }
      } else if (searchStrategy === 'grid') {
        // If grid strategy has no results in current range, try next range or switch strategy
        if (distanceMultiplier < 10 && page % 9 === 0) { // After trying all grid positions
          nextDistanceRange = distanceMultiplier + 1;
          console.log(`Increasing distance range for grid search to ${nextDistanceRange}`);
        } else if (page >= 18) { // After trying all grid positions in multiple ranges
          nextSearchStrategy = 'keyword';
          console.log('Switching to keyword search strategy');
        }
      } else if (searchStrategy === 'keyword' && page % 6 === 0) {
        // After trying all keywords, try next distance range or switch strategy
        if (distanceMultiplier < 10) {
          nextDistanceRange = distanceMultiplier + 1;
          console.log(`Increasing distance range for keyword search to ${nextDistanceRange}`);
        } else if (page >= 30) {
          nextSearchStrategy = 'type';
          console.log('Switching to type search strategy');
        }
      } else if (searchStrategy === 'type' && page % 8 === 0) {
        // After trying all types, try next distance range
        if (distanceMultiplier < 12) {
          nextDistanceRange = distanceMultiplier + 1;
          console.log(`Increasing distance range for type search to ${nextDistanceRange}`);
        }
      }
    }
    
    // If we don't have any new results and we've tried all reasonable options, mark as no more results
    let hasMore = !!placesResponse.data.next_page_token || newPlaces.length > 0;
    
    // Even if we don't have new places but we're switching strategy or distance range, keep searching
    if (newPlaces.length === 0 && (nextSearchStrategy !== searchStrategy || nextDistanceRange !== distanceMultiplier)) {
      hasMore = true;
      console.log('No new places but switching strategy or range, continuing search');
    }
    
    // If using next page token, rely on Google's next page token for hasMore
    if (nextPageToken) {
      hasMore = !!placesResponse.data.next_page_token;
      // If no more next page token but we're on page < 3, try the next search strategy
      if (!hasMore && page < 3) {
        if (distanceMultiplier < 15) {
          nextDistanceRange = distanceMultiplier + 1;
          hasMore = true;
        } else {
          nextSearchStrategy = 'grid';
          nextDistanceRange = 1;
          hasMore = true;
        }
      }
    }
    // Only stop searching after exhausting all strategies and distance ranges
    else if (searchStrategy === 'type' && newPlaces.length === 0 && distanceMultiplier >= 12 && page > 50) {
      hasMore = false;
      console.log('Exhausted all search strategies and distance ranges, stopping search');
    }
    
    // Fetch details for each place
    const storesPromises = newPlaces.map(async (place, index) => {
      try {
        // Get detailed information
        const detailsResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,url,geometry,international_phone_number,opening_hours,photos,rating&key=${GOOGLE_API_KEY}`
        );
        
        if (detailsResponse.data.status !== 'OK') {
          console.warn(`Failed to get details for place ${place.place_id}: ${detailsResponse.data.status}`);
          return null;
        }
        
        const details = detailsResponse.data.result;
        
        // Generate a placeholder email if not available
        let email = 'N/A';
        if (details.website) {
          try {
            const domain = new URL(details.website).hostname.replace('www.', '');
            email = `contact@${domain}`;
          } catch (e) {
            console.warn(`Failed to extract domain from website ${details.website}`);
          }
        }
        
        // Calculate distance from center point (ZIP code)
        const distance = calculateDistance(
          lat, lng, 
          place.geometry.location.lat, place.geometry.location.lng
        );
        
        // Get photo URL if available
        let photoUrl = null;
        if (details.photos && details.photos.length > 0) {
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${details.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
        }
        
        return {
          id: `place-${page}-${index}`,
          placeId: place.place_id,
          name: details.name || place.name,
          address: details.formatted_address || place.vicinity,
          phone: details.formatted_phone_number || details.international_phone_number || 'N/A',
          email: email,
          contact: email,
          website: details.website || null,
          location: details.geometry?.location || place.geometry.location,
          googleMapsUrl: details.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          distance: distance, // Distance in kilometers
          distanceText: `${distance.toFixed(1)} km`,
          openNow: details.opening_hours?.open_now,
          rating: details.rating,
          photoUrl: photoUrl,
          verified: true
        };
      } catch (error) {
        console.error(`Error processing place ${place.place_id}:`, error.message);
        return null;
      }
    });
    
    let stores = await Promise.all(storesPromises);
    stores = stores.filter(store => store !== null);
    
    console.log(`Successfully processed ${stores.length} stores with details`);
    
    // Step 5: Filter out stores with duplicate phone numbers or emails
    const seenPhones = new Set();
    const seenEmails = new Set();
    const uniqueStores = [];
    
    for (const store of stores) {
      // Skip stores with N/A phone or email
      const hasUniquePhone = store.phone === 'N/A' || !seenPhones.has(store.phone);
      const hasUniqueEmail = store.email === 'N/A' || !seenEmails.has(store.email);
      
      // Only add stores with unique contact info
      if (hasUniquePhone && hasUniqueEmail) {
        uniqueStores.push(store);
        
        // Track the phone and email
        if (store.phone !== 'N/A') {
          seenPhones.add(store.phone);
        }
        if (store.email !== 'N/A') {
          seenEmails.add(store.email);
        }
      } else {
        console.log(`Filtered out duplicate store: ${store.name} (phone: ${store.phone}, email: ${store.email})`);
      }
    }
    
    console.log(`Filtered to ${uniqueStores.length} unique stores after removing duplicates`);
    
    // Step 6: Sort by distance (nearest first)
    uniqueStores?.sort((a, b) => a.distance - b.distance);
    
    // Get all place IDs we've seen so far (to track for future pagination)
    const allSeenIds = [...seenIds, ...places.map(place => place.place_id)];
    
    // Send the results back to the client
    console.log(`===== SEARCH SUMMARY =====`);
    console.log(`Strategy: ${nextSearchStrategy}, Range: ${nextDistanceRange}`);
    console.log(`Results: ${uniqueStores.length}, Has more: ${hasMore}`);
    console.log(`Places found: ${places.length}, New places: ${newPlaces.length}`);
    console.log(`After distance filter: ${placesWithDistance.length}`);
    console.log(`NextPageToken: ${!!placesResponse.data.next_page_token}`);
    console.log(`==========================`);
    
    // Include debug information in the response
    res.json({
      results: uniqueStores,
      nextPageToken: placesResponse.data.next_page_token || null,
      seenIds: allSeenIds,
      page: page,
      searchQuery: searchQuery,
      location: { lat, lng },
      searchStrategy: nextSearchStrategy,
      currentDistanceRange: nextDistanceRange,
      hasMore: hasMore,
      category: category,
      source: "Google Places API with DeepSeek categorization",
      debug: {
        strategy: nextSearchStrategy,
        range: nextDistanceRange,
        placesFound: places.length,
        newPlaces: newPlaces.length,
        afterDistanceFilter: placesWithDistance?.length || 0,
        hasNextPageToken: !!placesResponse.data.next_page_token,
        uniqueStoresCount: uniqueStores.length
      }
    });
    
  } catch (error) {
    console.error('API Error:', error.message);
    
    // Provide helpful error information
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.response) {
      console.error('API Response Status:', error.response.status);
      console.error('API Response Data:', error.response.data);
      
      if (error.response.data?.error_message) {
        errorMessage = error.response.data.error_message;
      }
      
      statusCode = error.response.status;
    }
    
    res.status(statusCode).json({
      error: 'Server error',
      message: errorMessage
    });
  }
});

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Simple health check route
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    api: 'Google Places API with DeepSeek categorization',
    apiKeyConfigured: !!GOOGLE_API_KEY && !!DEEPSEEK_API_KEY
  });
});

module.exports = router; 