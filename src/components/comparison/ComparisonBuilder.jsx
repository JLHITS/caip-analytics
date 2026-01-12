import React, { useState, useCallback } from 'react';
import { X, Plus, Trash2, Loader2, AlertCircle, CheckCircle, Users, Link, Copy } from 'lucide-react';
import { loadFirebaseShare, createComparisonSet } from '../../utils/shareUtils';

/**
 * Modal component for building a comparison set from share links
 */
const ComparisonBuilder = ({ isOpen, onClose, onComparisonCreated, currentShareId = null }) => {
  const [practices, setPractices] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [comparisonName, setComparisonName] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  // Extract share ID from URL or raw ID input
  const extractShareId = (input) => {
    const trimmed = input.trim();
    // Try to extract from URL pattern /shared/{id}
    const match = trimmed.match(/\/shared\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
    // Otherwise treat as raw share ID
    if (/^[a-zA-Z0-9]+$/.test(trimmed) && trimmed.length >= 6 && trimmed.length <= 12) {
      return trimmed;
    }
    return null;
  };

  // Add a practice by share ID/URL
  const handleAddPractice = useCallback(async () => {
    const shareId = extractShareId(inputValue);
    if (!shareId) {
      setError('Invalid share link or ID. Please enter a valid CAIP Analytics share URL or ID.');
      return;
    }

    // Check if already added
    if (practices.some(p => p.shareId === shareId)) {
      setError('This practice has already been added.');
      return;
    }

    // Check max limit
    if (practices.length >= 15) {
      setError('Maximum 15 practices allowed in a comparison.');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      const shareData = await loadFirebaseShare(shareId);

      if (shareData.type !== 'demand-capacity') {
        setError('Only Demand & Capacity dashboards can be compared. This is a Triage Slots share.');
        return;
      }

      setPractices(prev => [...prev, {
        shareId,
        surgeryName: shareData.config?.surgeryName || 'Unknown Practice',
        odsCode: shareData.config?.odsCode || '',
        population: shareData.config?.population,
        monthCount: shareData.processedData?.length || 0,
        expiresAt: shareData.expiresAt,
      }]);

      setInputValue('');
    } catch (err) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  }, [inputValue, practices]);

  // Remove a practice from the list
  const handleRemovePractice = (shareId) => {
    setPractices(prev => prev.filter(p => p.shareId !== shareId));
  };

  // Create the comparison
  const handleCreateComparison = async () => {
    if (practices.length < 2) {
      setError('At least 2 practices are required to create a comparison.');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const shareIds = practices.map(p => p.shareId);
      const { comparisonId, comparisonUrl, expiresAt } = await createComparisonSet(
        shareIds,
        comparisonName || `${practices.length} Practice Comparison`
      );

      setResult({ comparisonUrl, expiresAt });

      if (onComparisonCreated) {
        onComparisonCreated(comparisonId, comparisonUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Copy comparison URL to clipboard
  const handleCopyUrl = async () => {
    if (result?.comparisonUrl) {
      try {
        await navigator.clipboard.writeText(result.comparisonUrl);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // Reset and close
  const handleClose = () => {
    setPractices([]);
    setInputValue('');
    setComparisonName('');
    setError(null);
    setResult(null);
    onClose();
  };

  // Auto-add current practice share if provided
  React.useEffect(() => {
    if (isOpen && currentShareId && practices.length === 0) {
      setInputValue(currentShareId);
    }
  }, [isOpen, currentShareId, practices.length]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <Users className="text-emerald-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Compare Practices</h2>
              <p className="text-sm text-slate-500">Add practices by their share links to compare</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {result ? (
            // Success state - show comparison URL
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-emerald-600" size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Comparison Created!</h3>
              <p className="text-slate-500 mb-6">
                Your comparison link is ready. Expires {result.expiresAt.toLocaleDateString()}.
              </p>

              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={result.comparisonUrl}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copy
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => window.open(result.comparisonUrl, '_blank')}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Open Comparison
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Comparison name input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Comparison Name <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={comparisonName}
                  onChange={(e) => setComparisonName(e.target.value)}
                  placeholder="e.g. PCN Q4 2024 Comparison"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Add practice input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Add Practice by Share Link
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPractice()}
                      placeholder="Paste share URL or ID (e.g. https://caip.app/shared/abc123)"
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      disabled={validating}
                    />
                  </div>
                  <button
                    onClick={handleAddPractice}
                    disabled={validating || !inputValue.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {validating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    Add
                  </button>
                </div>
                {error && (
                  <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
              </div>

              {/* Practice list */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Practices to Compare ({practices.length}/15)
                  </label>
                  {practices.length >= 2 && (
                    <span className="text-xs text-emerald-600 font-medium">
                      Ready to create comparison
                    </span>
                  )}
                </div>

                {practices.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <Users className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-slate-500">No practices added yet</p>
                    <p className="text-xs text-slate-400 mt-1">Add at least 2 practices to create a comparison</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {practices.map((practice, index) => (
                      <div
                        key={practice.shareId}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: `hsl(${(index * 360) / 15}, 60%, 50%)` }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{practice.surgeryName}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {practice.odsCode && (
                              <span className="font-mono">{practice.odsCode}</span>
                            )}
                            <span>{practice.population?.toLocaleString()} patients</span>
                            <span>{practice.monthCount} months</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePractice(practice.shareId)}
                          className="p-1.5 hover:bg-red-100 rounded-full text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="p-6 border-t border-slate-200 flex justify-between items-center bg-slate-50">
            <p className="text-xs text-slate-500">
              Comparison links expire after 30 days
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateComparison}
                disabled={practices.length < 2 || creating}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Users size={16} />
                    Create Comparison
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonBuilder;
