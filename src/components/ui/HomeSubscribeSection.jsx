import React, { useCallback, useRef, useState } from 'react';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { searchPractices as searchNationalPractices } from '../../data/dataLoader';
import {
  getPracticeByODS,
  searchPractices as searchPopulationPractices,
} from '../../utils/pracPopUtils';
import PracticeLookup from './PracticeLookup';
import SubscribeButton from './SubscribeButton';

const HomeSubscribeSection = () => {
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [resolvingPractice, setResolvingPractice] = useState(false);
  const lookupRequestRef = useRef(0);

  const searchHomePractices = useCallback(async (query, limit = 50) => {
    const [nationalMatches, populationMatches] = await Promise.all([
      searchNationalPractices(query, 'appointments').catch(() => []),
      Promise.resolve(searchPopulationPractices(query, limit)),
    ]);

    const merged = new Map();

    nationalMatches.forEach((match) => {
      const populationRecord = getPracticeByODS(match.odsCode);
      merged.set(match.odsCode, {
        odsCode: match.odsCode,
        practiceName: match.practiceName,
        pcnName: match.pcn || '',
        icbName: match.icb || '',
        postcode: populationRecord?.postcode || '',
        population: populationRecord?.population,
      });
    });

    populationMatches.forEach((match) => {
      const existing = merged.get(match.odsCode);
      merged.set(match.odsCode, {
        odsCode: match.odsCode,
        practiceName: existing?.practiceName || null,
        pcnName: existing?.pcnName || '',
        icbName: existing?.icbName || '',
        postcode: existing?.postcode || match.postcode || '',
        population: existing?.population ?? match.population,
      });
    });

    return Array.from(merged.values()).slice(0, limit);
  }, []);

  const handleSelectPractice = async (practice) => {
    const requestId = lookupRequestRef.current + 1;
    lookupRequestRef.current = requestId;

    const nextPractice = {
      odsCode: practice.odsCode,
      postcode: practice.postcode,
      population: practice.population,
      practiceName: practice.practiceName || null,
      pcnName: practice.pcnName || '',
      icbName: practice.icbName || '',
    };

    setSelectedPractice(nextPractice);

    if (practice.practiceName) {
      setResolvingPractice(false);
      return;
    }

    setResolvingPractice(true);

    try {
      const matches = await searchNationalPractices(practice.odsCode, 'appointments');
      const resolved = matches.find((item) => item.odsCode === practice.odsCode);

      setSelectedPractice((current) => {
        if (!current || current.odsCode !== practice.odsCode) {
          return current;
        }

        return {
          ...current,
          practiceName: resolved?.practiceName || current.practiceName,
          pcnName: resolved?.pcn || '',
          icbName: resolved?.icb || '',
        };
      });
    } catch (error) {
      console.error('Failed to resolve home-page practice details:', error);
    } finally {
      if (lookupRequestRef.current === requestId) {
        setResolvingPractice(false);
      }
    }
  };

  const selectedLabel = selectedPractice?.practiceName || selectedPractice?.odsCode;

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-lg">
      <div className="px-6 py-6 sm:px-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Bell size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-slate-900">Subscribe to practice updates</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Pick your practice here and we will email you when fresh NHS data lands, before you even open the
              national dashboards.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <PracticeLookup
              onSelect={handleSelectPractice}
              searchFn={searchHomePractices}
              searchDescription="Search by practice name, ODS code or postcode."
              placeholder="e.g., Riverside Medical Centre, A81001 or TS18 1HU"
              helperText="Select a practice to open the subscription form."
            />
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
            {selectedPractice ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{selectedLabel}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {selectedPractice.odsCode}
                      {selectedPractice.postcode ? ` - ${selectedPractice.postcode}` : ''}
                      {selectedPractice.population
                        ? ` - ${selectedPractice.population.toLocaleString()} patients`
                        : ''}
                    </p>
                    {(selectedPractice.pcnName || selectedPractice.icbName) && (
                      <p className="mt-1 text-xs text-slate-500">
                        {[selectedPractice.pcnName, selectedPractice.icbName].filter(Boolean).join(' - ')}
                      </p>
                    )}
                    {resolvingPractice && (
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                        <Loader2 size={12} className="animate-spin" />
                        Loading practice details...
                      </p>
                    )}
                  </div>
                </div>

                <SubscribeButton
                  scope="practice"
                  odsCode={selectedPractice.odsCode}
                  practiceName={selectedPractice.practiceName}
                  signupSource="home-page-practice"
                  label={`Subscribe to ${selectedLabel}`}
                  className="w-full justify-center"
                />

                <p className="text-xs leading-relaxed text-slate-500">
                  The email form also lets you add CAIP news, all-data release alerts, and AI analysis links for
                  this practice.
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-[180px] flex-col justify-center rounded-xl border border-dashed border-blue-200 bg-white/80 px-4 text-center">
                <p className="text-sm font-semibold text-slate-800">Choose your practice to start</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Search by practice name, ODS code or postcode, then open the subscription form straight from the home page.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeSubscribeSection;
