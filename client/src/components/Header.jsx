import React from 'react';

function Header() {
  return (
    <header className="bg-gradient-to-r from-brand-600 to-brand-700 shadow-md">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-7xl">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-white tracking-tight sm:text-4xl">
            Retail Store Finder
          </h1>
          <p className="mt-2 text-brand-100 text-lg font-light max-w-2xl mx-auto sm:mx-0">
            Find the perfect retail stores for your products and services
          </p>
        </div>
      </div>
    </header>
  );
}

export default Header; 