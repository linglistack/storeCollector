const axios = require('axios');
require('dotenv').config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

/**
 * Verify and enhance store information using Google Maps data
 */
class StoreVerifier {
  /**
   * Verify a single store's details using Google Maps
   * @param {Object} store - The store object from DeepSeek
   * @returns {Object} Enhanced store data with verified information
   */
  static async verifyStore(store) {
    try {
      // Step 1: Search for the store on Google Places
      const queryString = `${store.name} ${store.address}`.replace(/\s+/g, '+');
      const searchResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${queryString}&key=${GOOGLE_API_KEY}`
      );
      
      // If no results, return the original with a verification flag
      if (searchResponse.data.status !== 'OK' || searchResponse.data.results.length === 0) {
        return {
          ...store,
          verified: false,
          verificationAttempted: true
        };
      }
      
      // Get the top matched place
      const placeId = searchResponse.data.results[0].place_id;
      
      // Step 2: Get detailed information for the place
      const detailsResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,geometry,url&key=${GOOGLE_API_KEY}`
      );
      
      if (detailsResponse.data.status !== 'OK') {
        return {
          ...store,
          verified: false,
          verificationAttempted: true
        };
      }
      
      const placeDetails = detailsResponse.data.result;
      
      // Step 3: Combine data, prioritizing Google's verified information
      return {
        id: store.id,
        name: placeDetails.name || store.name,
        address: placeDetails.formatted_address || store.address,
        phone: placeDetails.formatted_phone_number || store.phone,
        contact: store.contact || 'N/A', // Keep original email as Google doesn't provide emails
        email: store.contact || 'N/A',
        location: placeDetails.geometry?.location,
        googleMapsUrl: placeDetails.url,
        website: placeDetails.website || null,
        placeId: placeId,
        verified: true,
        originalData: {
          name: store.name,
          address: store.address,
          phone: store.phone
        }
      };
    } catch (error) {
      console.error(`Error verifying store ${store.name}:`, error.message);
      return {
        ...store,
        verified: false,
        verificationError: error.message,
        verificationAttempted: true
      };
    }
  }
  
  /**
   * Verify multiple store results in parallel
   * @param {Array} stores - Array of store objects from DeepSeek
   * @returns {Array} Enhanced store data with verified information
   */
  static async verifyStores(stores) {
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < stores.length; i += batchSize) {
      const batch = stores.slice(i, i + batchSize);
      const batchPromises = batch.map(store => this.verifyStore(store));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Pause between batches to avoid hitting rate limits
      if (i + batchSize < stores.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

module.exports = StoreVerifier; 