import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ArrowUp, ArrowDown, Phone, Trophy, TrendingUp, ExternalLink, Info } from 'lucide-react';
import Card from './ui/Card';
import { NHS_GREEN, NHS_RED } from '../constants/colors';
import { parseNationalTelephonyData, getAverageWaitTimeBin, getAverageDurationBin } from '../utils/parseNationalTelephony';
import {
  calculateNationalRanking,
  calculateICBRanking,
  calculatePCNRanking,
  getPerformanceInterpretation,
  calculatePCNAverages,
  getPCNNationalRanking,
  getPCNICBRanking,
  calculateCallsSaved,
  getNationalMissedPct,
  calculateCallsSavedRanking
} from '../utils/telephonyAnalysis';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// Import the Excel file
import telephonyFile from '../assets/Cloud Based Telephony Publication Summary October 2025_v2.xlsx?url';

const NationalTelephony = () => {
  const [data, setData] = useState(null);
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCallsSavedTooltip, setShowCallsSavedTooltip] = useState(false);
  const [showInterpretationTooltip, setShowInterpretationTooltip] = useState(false);
  const [showCoveragePopup, setShowCoveragePopup] = useState(false);
  const [usageStats, setUsageStats] = useState({ totalChecks: 176, recentPractices: [] });

  // Load global usage stats from Firestore on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        const statsRef = doc(db, 'telephonyStats', 'global');
        const statsDoc = await getDoc(statsRef);

        if (statsDoc.exists()) {
          setUsageStats(statsDoc.data());
        } else {
          const initialStats = { totalChecks: 176, recentPractices: [] };
          await setDoc(statsRef, initialStats);
          setUsageStats(initialStats);
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };
    loadStats();
  }, []);

  // Track practice selection and update global stats
  useEffect(() => {
    if (selectedPractice) {
      const updateStats = async () => {
        try {
          const statsRef = doc(db, 'telephonyStats', 'global');
          const statsDoc = await getDoc(statsRef);

          if (statsDoc.exists()) {
            const currentStats = statsDoc.data();
            const newRecentPractices = [
              {
                name: selectedPractice.gpName,
                odsCode: selectedPractice.odsCode,
                timestamp: new Date().toISOString()
              },
              ...currentStats.recentPractices.filter(p => p.odsCode !== selectedPractice.odsCode)
            ].slice(0, 5);

            await updateDoc(statsRef, {
              totalChecks: increment(1),
              recentPractices: newRecentPractices
            });

            setUsageStats({
              totalChecks: currentStats.totalChecks + 1,
              recentPractices: newRecentPractices
            });
          }
        } catch (error) {
          console.error('Error updating stats:', error);
        }
      };
      updateStats();
    }
  }, [selectedPractice]);

  // Load and parse Excel file on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Add cache-busting parameter to force fresh load
        const cacheBuster = `?v=${Date.now()}`;
        const response = await fetch(telephonyFile + cacheBuster);
        const arrayBuffer = await response.arrayBuffer();
        const parsedData = parseNationalTelephonyData(arrayBuffer);

        // DEBUG: Log the parsed national data
        console.log('=== PARSED NATIONAL DATA ===');
        console.log('National object:', parsedData.national);
        console.log('Answered %:', parsedData.national?.answeredPct, '→', (parsedData.national?.answeredPct * 100).toFixed(1) + '%');
        console.log('Abandoned %:', parsedData.national?.endedDuringIVRPct, '→', (parsedData.national?.endedDuringIVRPct * 100).toFixed(1) + '%');
        console.log('Missed %:', parsedData.national?.missedPct, '→', (parsedData.national?.missedPct * 100).toFixed(1) + '%');
        console.log('Practices count:', parsedData.practices?.length);

        setData(parsedData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading telephony data:', error);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filter practices based on search
  const filteredPractices = useMemo(() => {
    if (!data || !searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return data.practices.filter(p =>
      p.gpName.toLowerCase().includes(term) ||
      p.odsCode.toLowerCase().includes(term)
    ).slice(0, 10); // Limit to 10 results
  }, [data, searchTerm]);

  // Calculate comparison arrow
  const getComparisonArrow = (practiceValue, nationalValue, lowerIsBetter = false) => {
    if (practiceValue === nationalValue) return null;
    const isBetter = lowerIsBetter ? practiceValue < nationalValue : practiceValue > nationalValue;

    if (lowerIsBetter) {
      // For metrics where lower is better (missed calls, abandoned calls)
      return isBetter ? (
        <ArrowDown size={20} className="text-green-600" /> // Lower than national = good
      ) : (
        <ArrowUp size={20} className="text-red-600" /> // Higher than national = bad
      );
    } else {
      // For metrics where higher is better (answered calls)
      return isBetter ? (
        <ArrowUp size={20} className="text-green-600" /> // Higher than national = good
      ) : (
        <ArrowDown size={20} className="text-red-600" /> // Lower than national = bad
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Phone size={48} className="mx-auto mb-4 text-blue-500 animate-pulse" />
          <p className="text-slate-600">Loading national telephony data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-red-600">
        <p>Error loading telephony data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Header */}
      <Card>
        <div className="text-center">
          <p className="text-sm text-slate-500 uppercase tracking-wide">NHS England Data Extract</p>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">{data.dataMonth}</h2>
          <a
            href="https://digital.nhs.uk/data-and-information/publications/statistical/cloud-based-telephony-data-in-general-practice"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2 transition-colors"
          >
            📊 View Data Source <ExternalLink size={12} />
          </a>
        </div>
      </Card>

      {/* Usage Statistics */}
      <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0">
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-1">Times Used</p>
            <p className="text-3xl font-bold text-indigo-900">{usageStats.totalChecks.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">practices viewed</p>
          </div>
          <div className="flex-1 border-t md:border-t-0 md:border-l border-indigo-200 pt-4 md:pt-0 md:pl-6">
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-2">Recent Practices</p>
            {usageStats.recentPractices.length > 0 ? (
              <div className="space-y-1">
                {usageStats.recentPractices.map((practice, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const foundPractice = data?.practices.find(p => p.odsCode === practice.odsCode);
                      if (foundPractice) {
                        setSelectedPractice(foundPractice);
                        setSearchTerm('');
                      }
                    }}
                    className="flex items-center justify-between text-sm w-full hover:bg-indigo-100 rounded px-2 py-1 transition-colors text-left"
                  >
                    <span className="text-slate-700 font-medium truncate">{practice.name}</span>
                    <span className="text-slate-400 text-xs ml-2">{practice.odsCode}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No practices checked yet</p>
            )}
          </div>
        </div>
      </Card>

      {/* Coverage Popup Modal */}
      {showCoveragePopup && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4"
          onClick={() => setShowCoveragePopup(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info size={24} className="text-blue-600" />
                <h3 className="text-xl font-bold text-slate-800">Can't find your practice?</h3>
              </div>
              <button
                onClick={() => setShowCoveragePopup(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                This national extract covers <strong>74.7% of GP practices</strong> in England that use cloud-based telephony systems.
              </p>
              <p>
                If you can't find your practice, it may be because:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Your practice hasn't migrated to cloud-based telephony yet</li>
                <li>Your practice opted out of data sharing</li>
                <li>Your practice's data wasn't available for this month</li>
              </ul>
              <p>
                To check your surgery's participation status, visit the <strong>CBT Participation and Summary Extract</strong>:
              </p>
              <a
                href="https://digital.nhs.uk/data-and-information/publications/statistical/cloud-based-telephony-data-in-general-practice/october-2025"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                View NHS England Publication <ExternalLink size={14} />
              </a>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCoveragePopup(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Practice Search */}
      <Card>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Search size={20} className="text-slate-400" />
            <label className="font-semibold text-slate-700">Find Your Practice</label>
            <button
              onClick={() => setShowCoveragePopup(true)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors ml-auto"
            >
              <Info size={12} /> Can't find your practice?
            </button>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by practice name or ODS code..."
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Search Results Dropdown - Only show when searching, hide after selection */}
          {searchTerm && !selectedPractice && filteredPractices.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {filteredPractices.map((practice) => (
                <button
                  key={practice.odsCode}
                  onClick={() => {
                    setSelectedPractice(practice);
                    setSearchTerm('');
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-slate-800">{practice.gpName}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {practice.odsCode} • {practice.pcnName} • {practice.icbName}
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchTerm && !selectedPractice && filteredPractices.length === 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
              <p className="text-sm text-slate-500">No practices found matching "{searchTerm}"</p>
            </div>
          )}
        </div>

        {selectedPractice && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex justify-between items-start">
            <div>
              <p className="text-sm text-blue-900">
                <strong>Selected:</strong> {selectedPractice.gpName} ({selectedPractice.odsCode})
              </p>
              <p className="text-xs text-blue-700 mt-1">
                PCN: {selectedPractice.pcnName} • ICB: {selectedPractice.icbName}
              </p>
            </div>
            <button
              onClick={() => setSelectedPractice(null)}
              className="px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
            >
              Change Practice
            </button>
          </div>
        )}
      </Card>

      {/* National Averages & Summary Tiles - Only show when practice selected */}
      {selectedPractice && (() => {
        // Calculate average inbound calls across all practices
        const avgInboundCalls = Math.round(
          data.practices.reduce((sum, p) => sum + p.inboundCalls, 0) / data.practices.length
        );

        return (
          <>
            {/* National Averages */}
            <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-300">
              <h3 className="text-lg font-bold text-slate-800 mb-4">National Averages</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-600 uppercase">Total Inbound Calls</p>
                  <p className="text-xl font-bold text-slate-800">{avgInboundCalls.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase">Abandoned (IVR)</p>
                  <p className="text-xl font-bold text-slate-800">{(data.national.endedDuringIVRPct * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase">Missed</p>
                  <p className="text-xl font-bold text-slate-800">{(data.national.missedPct * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase">Callback Requested</p>
                  <p className="text-xl font-bold text-slate-800">{(data.national.callbackRequestedPct * 100).toFixed(1)}%</p>
                </div>
              </div>
            </Card>

            {/* Summary Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Calls */}
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase">Total Inbound Calls</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{selectedPractice.inboundCalls.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">National Avg: {avgInboundCalls.toLocaleString()}</p>
              </div>
              {selectedPractice.inboundCalls > avgInboundCalls ? (
                <ArrowUp size={20} className="text-slate-600" />
              ) : selectedPractice.inboundCalls < avgInboundCalls ? (
                <ArrowDown size={20} className="text-slate-600" />
              ) : null}
            </div>
          </Card>

          {/* Abandoned Calls (Ended during IVR) - No arrow */}
          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Abandoned Calls (IVR)</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{(selectedPractice.endedDuringIVRPct * 100).toFixed(1)}%</p>
              <p className="text-sm text-slate-600 mt-1">{selectedPractice.endedDuringIVR.toLocaleString()} calls</p>
              <p className="text-xs text-slate-500 mt-1">National: {(data.national.endedDuringIVRPct * 100).toFixed(1)}%</p>
            </div>
          </Card>

          {/* Missed Calls */}
          <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase">Missed Calls</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{(selectedPractice.missedPct * 100).toFixed(1)}%</p>
                <p className="text-sm text-slate-600 mt-1">{selectedPractice.missed.toLocaleString()} calls</p>
                <p className="text-xs text-slate-500 mt-1">National: {(data.national.missedPct * 100).toFixed(1)}%</p>
              </div>
              {getComparisonArrow(selectedPractice.missedPct, data.national.missedPct, true)}
            </div>
          </Card>

          {/* Callback Requested - No arrow */}
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Callback Requested</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{(selectedPractice.callbackRequestedPct * 100).toFixed(1)}%</p>
              <p className="text-sm text-slate-600 mt-1">{selectedPractice.callbackRequested.toLocaleString()} callbacks</p>
              <p className="text-xs text-slate-500 mt-1">National: {(data.national.callbackRequestedPct * 100).toFixed(1)}%</p>
            </div>
          </Card>

          {/* Callbacks Made */}
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase">Callbacks Made</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{selectedPractice.callbackMade.toLocaleString()}</p>
                <p className="text-sm text-slate-600 mt-1">{(selectedPractice.callbackMadePct * 100).toFixed(1)}% of requested</p>
              </div>
            </div>
          </Card>

          {/* Average Wait Time */}
          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Avg Wait Time (Answered)</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {getAverageWaitTimeBin(selectedPractice.waitTimeData)}
              </p>
            </div>
          </Card>

          {/* Average Duration */}
          <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Avg Call Duration</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {getAverageDurationBin(selectedPractice.waitTimeData)}
              </p>
            </div>
          </Card>

          {/* Missed Call Wait Time */}
          <Card className="bg-gradient-to-br from-rose-50 to-white border-rose-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Avg Missed Call Wait</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {getAverageWaitTimeBin(selectedPractice.missedWaitData)}
              </p>
            </div>
          </Card>
        </div>
          </>
        );
      })()}

      {/* Performance Rankings & Analysis */}
      {selectedPractice && (() => {
        const nationalRanking = calculateNationalRanking(selectedPractice, data.practices);
        const icbRanking = calculateICBRanking(selectedPractice, data.practices);
        const pcnRanking = calculatePCNRanking(selectedPractice, data.practices);
        const interpretation = getPerformanceInterpretation(nationalRanking.percentile);

        // Calculate Calls Saved metrics
        const nationalMissedPct = getNationalMissedPct(data.practices);
        const practiceCallsSaved = calculateCallsSaved(selectedPractice, nationalMissedPct);
        const callsSavedRanking = calculateCallsSavedRanking(selectedPractice, data.practices);

        return (
          <>
            {/* Performance Interpretation */}
            <Card className={`bg-gradient-to-br from-${interpretation.color}-50 to-white border-${interpretation.color}-200 ${parseFloat(nationalRanking.percentile) <= 1.0 ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}`}>
              <div className="text-center">
                {parseFloat(nationalRanking.percentile) <= 1.0 && (
                  <div className="mb-2 animate-pulse">
                    <span className="text-4xl">🎉</span>
                    <span className="text-4xl">🏆</span>
                    <span className="text-4xl">🎊</span>
                  </div>
                )}
                <div className="text-5xl mb-3">{interpretation.emoji}</div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-slate-800">
                    {parseFloat(nationalRanking.percentile) <= 1.0 ? '🥇 Top 1% Nationally!' : interpretation.label}
                  </h3>
                  <div className="relative inline-block">
                    <button
                      onMouseEnter={() => setShowInterpretationTooltip(true)}
                      onMouseLeave={() => setShowInterpretationTooltip(false)}
                      className="text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      <Info size={18} />
                    </button>
                    {showInterpretationTooltip && createPortal(
                      <div
                        className="fixed w-72 bg-slate-800 text-white text-xs rounded-lg p-4 shadow-2xl z-[9999] pointer-events-none"
                        style={{
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-blue-300 mb-2">Performance Criteria (by percentile):</p>
                          <p><strong>🌟 Excellent:</strong> Top 5%</p>
                          <p><strong>⭐ Great:</strong> Top 6-10%</p>
                          <p><strong>👍 Good:</strong> Top 11-25%</p>
                          <p><strong>✓ Above Average:</strong> 26-50%</p>
                          <p><strong>⚠ Below Average:</strong> 51-75%</p>
                          <p><strong>⚠️ Poor:</strong> 76-90%</p>
                          <p><strong>❌ Very Poor:</strong> 91-95%</p>
                          <p><strong>🔴 Amongst the Worst:</strong> Bottom 5%</p>
                          <p className="pt-2 border-t border-slate-600 mt-2">Based on your national ranking for missed call %</p>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
                <p className="text-slate-600 font-medium">
                  {parseFloat(nationalRanking.percentile) <= 1.0
                    ? '🎯 Congratulations! Your practice is in the top 1% nationally for call handling. Exceptional performance!'
                    : interpretation.description}
                </p>
                {parseFloat(nationalRanking.percentile) <= 1.0 && (
                  <p className="text-sm text-emerald-600 font-semibold mt-2 animate-pulse">
                    ✨ Elite tier - Top 1% in the nation ✨
                  </p>
                )}
                <p className="text-sm text-slate-500 mt-2">Based on missed call % performance</p>
              </div>
            </Card>

            {/* Rankings Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* National Ranking */}
              <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                <div className="flex items-start gap-3">
                  <Trophy size={32} className="text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-600 font-semibold uppercase mb-1">National Ranking</p>
                    <p className="text-2xl font-bold text-slate-800">
                      #{nationalRanking.rank} <span className="text-sm text-slate-500">/ {nationalRanking.total.toLocaleString()}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">Top {nationalRanking.percentile}%</p>
                  </div>
                </div>
              </Card>

              {/* ICB Ranking */}
              <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                <div className="flex items-start gap-3">
                  <TrendingUp size={32} className="text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-600 font-semibold uppercase mb-1">ICB Ranking</p>
                    <p className="text-2xl font-bold text-slate-800">
                      #{icbRanking.rank} <span className="text-sm text-slate-500">/ {icbRanking.total}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{icbRanking.icbName}</p>
                  </div>
                </div>
              </Card>

              {/* PCN Ranking */}
              <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
                <div className="flex items-start gap-3">
                  <Trophy size={32} className="text-indigo-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-600 font-semibold uppercase mb-1">PCN Ranking</p>
                    <p className="text-2xl font-bold text-slate-800">
                      #{pcnRanking.rank} <span className="text-sm text-slate-500">/ {pcnRanking.total}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{pcnRanking.pcnName}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* PCN League Table */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">
                {pcnRanking.pcnName} - Practice Performance
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b-2 border-slate-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Rank</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Practice</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Missed %</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Answered %</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcnRanking.practices.map((practice, idx) => {
                      const isSelected = practice.odsCode === selectedPractice.odsCode;
                      return (
                        <tr
                          key={practice.odsCode}
                          className={`border-b border-slate-100 ${isSelected ? 'bg-blue-100 font-semibold' : 'hover:bg-slate-50'}`}
                        >
                          <td className="p-3">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-medium">{practice.gpName}</div>
                            <div className="text-xs text-slate-500">{practice.odsCode}</div>
                          </td>
                          <td className="p-3 text-right">
                            <span className={practice.missedPct < data.national.missedPct ? 'text-green-600 font-medium' : ''}>
                              {(practice.missedPct * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-right">{(practice.answeredPct * 100).toFixed(1)}%</td>
                          <td className="p-3 text-right">{practice.inboundCalls.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* PCN Performance Leaderboards */}
            {(() => {
              const pcnAverages = calculatePCNAverages(data.practices);
              const pcnNationalRanking = getPCNNationalRanking(selectedPractice.pcnCode, pcnAverages);
              const pcnICBRanking = getPCNICBRanking(selectedPractice.pcnCode, selectedPractice.icbCode, pcnAverages);

              return (
                <>
                  {/* PCN Performance Summary */}
                  <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Your PCN Performance</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 uppercase mb-1">National PCN Ranking</p>
                        <p className="text-2xl font-bold text-slate-800">
                          #{pcnNationalRanking.rank} <span className="text-sm text-slate-500">/ {pcnNationalRanking.total.toLocaleString()}</span>
                        </p>
                        <p className="text-sm text-slate-600 mt-1">Top {pcnNationalRanking.percentile}% of PCNs</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase mb-1">ICB PCN Ranking</p>
                        <p className="text-2xl font-bold text-slate-800">
                          #{pcnICBRanking.rank} <span className="text-sm text-slate-500">/ {pcnICBRanking.total}</span>
                        </p>
                        <p className="text-sm text-slate-600 mt-1">Within {selectedPractice.icbName}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Top 10 PCNs Nationally */}
                  <Card>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Top 10 PCNs Nationally (Missed Calls %)</h3>
                    <p className="text-xs text-slate-500 mb-3">Excluding single-practice PCNs</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 border-b-2 border-slate-200">
                          <tr>
                            <th className="text-left p-3 font-semibold text-slate-700">Rank</th>
                            <th className="text-left p-3 font-semibold text-slate-700">PCN</th>
                            <th className="text-left p-3 font-semibold text-slate-700">ICB</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Avg Missed %</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Practices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pcnAverages.filter(pcn => pcn.practiceCount > 1).slice(0, 10).map((pcn, idx) => {
                            const isUserPCN = pcn.pcnCode === selectedPractice.pcnCode;
                            return (
                              <tr
                                key={pcn.pcnCode}
                                className={`border-b border-slate-100 ${isUserPCN ? 'bg-cyan-100 font-semibold' : 'hover:bg-slate-50'}`}
                              >
                                <td className="p-3">{idx + 1}</td>
                                <td className="p-3">
                                  <div className="font-medium">{pcn.pcnName}</div>
                                  <div className="text-xs text-slate-500">{pcn.pcnCode}</div>
                                </td>
                                <td className="p-3 text-slate-600">{pcn.icbName}</td>
                                <td className="p-3 text-right text-green-600 font-medium">
                                  {(pcn.avgMissedPct * 100).toFixed(1)}%
                                </td>
                                <td className="p-3 text-right">{pcn.practiceCount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Top PCNs in Same ICB */}
                  <Card>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">
                      PCN Performance in {selectedPractice.icbName}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 border-b-2 border-slate-200">
                          <tr>
                            <th className="text-left p-3 font-semibold text-slate-700">Rank</th>
                            <th className="text-left p-3 font-semibold text-slate-700">PCN</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Avg Missed %</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Practices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pcnICBRanking.pcns.map((pcn, idx) => {
                            const isUserPCN = pcn.pcnCode === selectedPractice.pcnCode;
                            return (
                              <tr
                                key={pcn.pcnCode}
                                className={`border-b border-slate-100 ${isUserPCN ? 'bg-purple-100 font-semibold' : 'hover:bg-slate-50'}`}
                              >
                                <td className="p-3">{idx + 1}</td>
                                <td className="p-3">
                                  <div className="font-medium">{pcn.pcnName}</div>
                                  <div className="text-xs text-slate-500">{pcn.pcnCode}</div>
                                </td>
                                <td className="p-3 text-right">
                                  <span className={pcn.avgMissedPct < data.national.missedPct ? 'text-green-600 font-medium' : ''}>
                                    {(pcn.avgMissedPct * 100).toFixed(1)}%
                                  </span>
                                </td>
                                <td className="p-3 text-right">{pcn.practiceCount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Section Divider: Volume-Weighted Impact Metrics */}
                  <Card className="bg-gradient-to-r from-teal-100 via-indigo-100 to-violet-100 border-2 border-teal-400">
                    <div className="text-center py-2">
                      <h2 className="text-xl font-bold text-slate-800">📊 Volume-Weighted Impact Metrics</h2>
                      <p className="text-sm text-slate-600 mt-1">Accounting for practice size and patient volume</p>
                    </div>
                  </Card>

                  {/* Calls Saved vs National Average - Volume-Weighted Impact */}
                  <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-400 border-2">
                    <div className="text-center">
                      <p className="text-xs text-teal-700 font-semibold uppercase tracking-wide mb-2">💼 Volume-Weighted Impact Metric</p>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <h3 className="text-2xl font-bold text-slate-800">Calls Saved vs National Average</h3>
                        <div className="relative inline-block">
                          <button
                            onMouseEnter={() => setShowCallsSavedTooltip(true)}
                            onMouseLeave={() => setShowCallsSavedTooltip(false)}
                            className="text-teal-600 hover:text-teal-800 transition-colors"
                          >
                            <Info size={20} />
                          </button>
                          {showCallsSavedTooltip && createPortal(
                            <div
                              className="fixed w-80 bg-slate-800 text-white text-xs rounded-lg p-4 shadow-2xl z-[9999] pointer-events-none"
                              style={{
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)'
                              }}
                            >
                              <div className="space-y-2">
                                <p className="font-semibold text-teal-300">How This Metric Works:</p>
                                <p><strong>Formula:</strong> (National Missed % - Your Missed %) × Your Total Calls</p>
                                <p><strong>Positive value:</strong> You saved more calls than the national average would predict for your call volume.</p>
                                <p><strong>Negative value:</strong> You missed more calls than the national average would predict.</p>
                                <p className="pt-2 border-t border-slate-600"><strong>Why volume-weighted?</strong> This metric accounts for practice size. A large practice with good performance has more patient impact than a small practice with the same percentage.</p>
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className={`text-5xl font-bold ${practiceCallsSaved >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                          {practiceCallsSaved >= 0 ? '+' : ''}{Math.round(practiceCallsSaved).toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-600 mt-2">
                          {practiceCallsSaved >= 0 ? 'calls saved compared to national average' : 'additional calls missed vs national average'}
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-teal-200">
                        <p className="text-sm text-slate-600">
                          <strong>National Rank:</strong> #{callsSavedRanking.rank.toLocaleString()} of {callsSavedRanking.total.toLocaleString()} practices
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Higher is better • Accounts for practice call volume
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Top 20 Practices - Calls Saved */}
                  <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
                    <h3 className="text-lg font-bold text-indigo-900 mb-4">🏆 Top 20 Practices by Impact (Calls Saved)</h3>
                    <p className="text-xs text-indigo-600 mb-3">Volume-weighted metric - practices with highest positive impact</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-indigo-100 border-b-2 border-indigo-300">
                          <tr>
                            <th className="text-left p-3 font-semibold text-indigo-900">Rank</th>
                            <th className="text-left p-3 font-semibold text-indigo-900">Practice</th>
                            <th className="text-left p-3 font-semibold text-indigo-900">PCN</th>
                            <th className="text-right p-3 font-semibold text-indigo-900">Calls Saved</th>
                            <th className="text-right p-3 font-semibold text-indigo-900">Total Calls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {callsSavedRanking.practices.slice(0, 20).map((practice, idx) => {
                            const isSelected = practice.odsCode === selectedPractice.odsCode;
                            return (
                              <tr
                                key={practice.odsCode}
                                className={`border-b border-indigo-100 ${isSelected ? 'bg-indigo-200 font-semibold' : 'hover:bg-indigo-50'}`}
                              >
                                <td className="p-3">{idx + 1}</td>
                                <td className="p-3">
                                  <div className="font-medium">{practice.gpName}</div>
                                  <div className="text-xs text-slate-500">{practice.odsCode}</div>
                                </td>
                                <td className="p-3 text-slate-600 text-xs">{practice.pcnName}</td>
                                <td className="p-3 text-right font-bold">
                                  <span className={practice.callsSaved >= 0 ? 'text-teal-600' : 'text-red-600'}>
                                    {practice.callsSaved >= 0 ? '+' : ''}{Math.round(practice.callsSaved).toLocaleString()}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-slate-600">{practice.inboundCalls.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Top 20 PCNs - Calls Saved */}
                  <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-200">
                    <h3 className="text-lg font-bold text-violet-900 mb-4">🏆 Top 20 PCNs by Impact (Calls Saved)</h3>
                    <p className="text-xs text-violet-600 mb-3">Volume-weighted metric - PCNs with highest positive impact (excluding single-practice PCNs)</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-violet-100 border-b-2 border-violet-300">
                          <tr>
                            <th className="text-left p-3 font-semibold text-violet-900">Rank</th>
                            <th className="text-left p-3 font-semibold text-violet-900">PCN</th>
                            <th className="text-left p-3 font-semibold text-violet-900">ICB</th>
                            <th className="text-right p-3 font-semibold text-violet-900">Calls Saved</th>
                            <th className="text-right p-3 font-semibold text-violet-900">Practices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pcnAverages
                            .filter(pcn => pcn.practiceCount > 1)
                            .sort((a, b) => b.callsSaved - a.callsSaved)
                            .slice(0, 20)
                            .map((pcn, idx) => {
                              const isUserPCN = pcn.pcnCode === selectedPractice.pcnCode;
                              return (
                                <tr
                                  key={pcn.pcnCode}
                                  className={`border-b border-violet-100 ${isUserPCN ? 'bg-violet-200 font-semibold' : 'hover:bg-violet-50'}`}
                                >
                                  <td className="p-3">{idx + 1}</td>
                                  <td className="p-3">
                                    <div className="font-medium">{pcn.pcnName}</div>
                                    <div className="text-xs text-slate-500">{pcn.pcnCode}</div>
                                  </td>
                                  <td className="p-3 text-slate-600">{pcn.icbName}</td>
                                  <td className="p-3 text-right font-bold">
                                    <span className={pcn.callsSaved >= 0 ? 'text-teal-600' : 'text-red-600'}>
                                      {pcn.callsSaved >= 0 ? '+' : ''}{Math.round(pcn.callsSaved).toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right text-slate-600">{pcn.practiceCount}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              );
            })()}
          </>
        );
      })()}

      {/* No Selection State */}
      {!selectedPractice && (
        <div className="text-center py-12 text-slate-400 relative -z-10">
          <Phone size={48} className="mx-auto mb-4 opacity-50" />
          <p>Search for and select your practice to view telephony metrics</p>
        </div>
      )}
    </div>
  );
};

export default NationalTelephony;
