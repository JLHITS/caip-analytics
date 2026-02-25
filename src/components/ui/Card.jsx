import React from 'react';

// Reusable card wrapper component with glass morphism effect
// Provides consistent styling across the dashboard
const Card = ({ children, className = '', ...props }) => (
  <div
    data-card="true"
    {...props}
    className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md ${className}`}
  >
    {children}
  </div>
);

export default Card;
