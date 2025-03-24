import React, { useState } from 'react';

function SearchForm({ onSearch }) {
  const [formData, setFormData] = useState({
    product: '',
    retailStore: '',
    zipCode: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(formData);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
      <div className="p-6 sm:p-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Find Retail Stores</h2>
          <p className="mt-1 text-gray-500 text-sm">Enter your criteria below to discover matching retail stores</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="product" className="block text-sm font-medium text-gray-700">
                Product or Category
              </label>
              <input
                type="text"
                id="product"
                name="product"
                value={formData.product}
                onChange={handleChange}
                placeholder="e.g., Organic Foods, Electronics"
                required
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            
            {/* <div className="space-y-2">
              <label htmlFor="retailStore" className="block text-sm font-medium text-gray-700">
                Retail Store (Optional)
              </label>
              <input
                type="text"
                id="retailStore"
                name="retailStore"
                value={formData.retailStore}
                onChange={handleChange}
                placeholder="e.g., Target, Walmart"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div> */}
            
            <div className="space-y-2">
              <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">
                ZIP Code
              </label>
              <input
                type="text"
                id="zipCode"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="e.g., 90210"
                pattern="[0-9]{5}"
                title="Five digit ZIP code"
                required
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
          
          <div className="flex justify-center pt-2">
            <button 
              type="submit" 
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              Search Stores
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SearchForm; 