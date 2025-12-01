import React, { useState, useMemo, useEffect } from 'react';
import { Search, ArrowUp, ArrowDown, Phone, Trophy, TrendingUp } from 'lucide-react';
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
  getPCNICBRanking
} from '../utils/telephonyAnalysis';

// Import the Excel file
import telephonyFile from '../assets/Cloud Based Telephony Publication Summary October 2025_v2.xlsx?url';

const NationalTelephony = () => {
  const [data, setData] = useState(null);
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

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
        </div>
      </Card>

      {/* Practice Search */}
      <Card>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Search size={20} className="text-slate-400" />
            <label className="font-semibold text-slate-700">Find Your Practice</label>
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
            <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
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
            <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
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

      {/* National Averages - Always Visible */}
      <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-300">
        <h3 className="text-lg font-bold text-slate-800 mb-4">National Averages</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-600 uppercase">Answered</p>
            <p className="text-xl font-bold text-slate-800">{(data.national.answeredPct * 100).toFixed(1)}%</p>
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
      {selectedPractice && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Answered Calls */}
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase">Answered Calls</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{(selectedPractice.answeredPct * 100).toFixed(1)}%</p>
                <p className="text-sm text-slate-600 mt-1">{selectedPractice.answered.toLocaleString()} calls</p>
                <p className="text-xs text-slate-500 mt-1">National: {(data.national.answeredPct * 100).toFixed(1)}%</p>
              </div>
              {getComparisonArrow(selectedPractice.answeredPct, data.national.answeredPct)}
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
      )}

      {/* Performance Rankings & Analysis */}
      {selectedPractice && (() => {
        const nationalRanking = calculateNationalRanking(selectedPractice, data.practices);
        const icbRanking = calculateICBRanking(selectedPractice, data.practices);
        const pcnRanking = calculatePCNRanking(selectedPractice, data.practices);
        const interpretation = getPerformanceInterpretation(nationalRanking.percentile);

        return (
          <>
            {/* Performance Interpretation */}
            <Card className={`bg-gradient-to-br from-${interpretation.color}-50 to-white border-${interpretation.color}-200`}>
              <div className="text-center">
                <div className="text-5xl mb-3">{interpretation.emoji}</div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">{interpretation.label}</h3>
                <p className="text-slate-600 font-medium">{interpretation.description}</p>
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
                </>
              );
            })()}
          </>
        );
      })()}

      {/* No Selection State */}
      {!selectedPractice && (
        <div className="text-center py-12 text-slate-400">
          <Phone size={48} className="mx-auto mb-4 opacity-50" />
          <p>Search for and select your practice to view telephony metrics</p>
        </div>
      )}
    </div>
  );
};

export default NationalTelephony;
