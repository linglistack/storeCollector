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
    const { product, retailStore, zipCode, page = 1, radius = 10000, seenIds = [] } = req.body;
    
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
    
    // Calculate the search radius (increases with pagination)
    const searchRadius = Math.min(radius * Math.ceil(page / 2), 50000); // Max 50km
    
    // If there's a next page token, use that instead of running a new search
    const nextPageToken = req.body.nextPageToken;
    
    let placesResponse;
    
    if (nextPageToken) {
      // Use the page token for pagination
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
    } else {
      // Run a new search
      console.log(`Searching for "${searchQuery}" near ${lat},${lng} with radius ${searchRadius}m`);
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${searchRadius}&keyword=${encodeURIComponent(searchQuery)}&type=store&key=${GOOGLE_API_KEY}`
      );
    }
    
    if (placesResponse.data.status !== 'OK' && placesResponse.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places API error: ${placesResponse.data.status}`);
    }
    
    // Step 4: Process each result to get detailed information
    const places = placesResponse.data.results;
    console.log(`Found ${places.length} places in the initial search`);
    
    // Filter out places we've already seen
    const newPlaces = places.filter(place => !seenIds.includes(place.place_id));
    console.log(`Filtered to ${newPlaces.length} new places`);
    
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
    res.json({
      results: uniqueStores,
      nextPageToken: placesResponse.data.next_page_token || null,
      seenIds: allSeenIds,
      page: page,
      radius: searchRadius,
      category: category, // Send the category back for pagination
      searchQuery: searchQuery,
      location: { lat, lng },
      source: "Google Places API with DeepSeek categorization"
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