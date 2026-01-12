import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Building2, Users, MapPin } from 'lucide-react';
import { searchPractices, getPracticeCount } from '../../utils/pracPopUtils';

/**
 * Practice lookup component with searchable dropdown
 * Allows users to search by ODS code or postcode and auto-fill practice details
 */
const PracticeLookup = ({ onSelect, className = '' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [practiceCount, setPracticeCount] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load practice count on mount
  useEffect(() => {
    setPracticeCount(getPracticeCount());
  }, []);

  // Search when query changes
  useEffect(() => {
    if (query.length >= 2) {
      const matches = searchPractices(query, 50);
      setResults(matches);
      setIsOpen(matches.length > 0);
      setHighlightedIndex(0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [isOpen, results, highlightedIndex]);

  // Handle practice selection
  const handleSelect = (practice) => {
    onSelect(practice);
    setQuery('');
    setIsOpen(false);
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        <span className="flex items-center gap-2">
          <Building2 size={14} />
          Find Your Practice
        </span>
      </label>
      <p className="text-xs text-slate-500 mb-2">
        Search by ODS code or postcode from {practiceCount.toLocaleString()} NHS practices
      </p>

      {/* Search input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          placeholder="e.g., A81001 or TS18 1HU"
          className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-lg text-sm
                     focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                     placeholder:text-slate-400"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {results.map((practice, index) => (
            <button
              key={practice.odsCode}
              onClick={() => handleSelect(practice)}
              className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-emerald-50 transition-colors ${
                index === highlightedIndex ? 'bg-emerald-50' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-emerald-700">
                    {practice.odsCode}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={12} />
                    {practice.postcode}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <Users size={12} />
                {practice.population.toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-center text-sm text-slate-500">
          No practices found matching "{query}"
        </div>
      )}

      {/* Help text */}
      <p className="mt-1 text-xs text-slate-400">
        Select a practice to auto-fill ODS code and population
      </p>
    </div>
  );
};

export default PracticeLookup;
