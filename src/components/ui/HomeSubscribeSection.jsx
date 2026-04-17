import React, { useCallback, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { loadAppointmentsData } from '../../data/dataLoader';
import { searchAppointmentPractices } from '../../utils/parseNationalAppointments';
import { getPracticeByODS } from '../../utils/pracPopUtils';
import { MONTHS_NEWEST_FIRST } from '../../assets/appt/index.js';
import PracticeLookup from './PracticeLookup';
import SubscribeButton from './SubscribeButton';

const HomeSubscribeSection = () => {
  const [selectedPractice, setSelectedPractice] = useState(null);
  const latestAppointmentsRef = useRef(null);
  const latestAppointmentsPromiseRef = useRef(null);

  const getLatestAppointmentsMonth = useCallback(async () => {
    if (latestAppointmentsRef.current) {
      return latestAppointmentsRef.current;
    }

    if (!latestAppointmentsPromiseRef.current) {
      latestAppointmentsPromiseRef.current = loadAppointmentsData()
        .then((data) => {
          if (!data) return null;

          const availableMonth =
            MONTHS_NEWEST_FIRST.find((month) => data?.[month]?.practices?.length) ||
            data?.metadata?.months?.find((month) => data?.[month]?.practices?.length) ||
            Object.keys(data).find((key) => key !== 'metadata' && data?.[key]?.practices?.length) ||
            null;

          latestAppointmentsRef.current = availableMonth ? data[availableMonth] : null;
          return latestAppointmentsRef.current;
        })
        .finally(() => {
          latestAppointmentsPromiseRef.current = null;
        });
    }

    return latestAppointmentsPromiseRef.current;
  }, []);

  const searchHomePractices = useCallback(async (query, limit = 20) => {
    const latestAppointments = await getLatestAppointmentsMonth();
    if (!latestAppointments?.practices?.length) {
      return [];
    }

    return searchAppointmentPractices(latestAppointments, query, limit).map((practice) => {
      const populationPractice = getPracticeByODS(practice.odsCode);

      return {
        odsCode: practice.odsCode,
        practiceName: practice.gpName,
        pcnName: practice.pcnName || '',
        icbName: practice.subICBName || practice.icbName || '',
        postcode: populationPractice?.postcode || '',
        population: populationPractice?.population ?? practice.listSize ?? null,
      };
    });
  }, [getLatestAppointmentsMonth]);

  const handleSelectPractice = useCallback((practice) => {
    setSelectedPractice({
      odsCode: practice.odsCode,
      practiceName: practice.practiceName || practice.gpName || practice.odsCode,
      pcnName: practice.pcnName || '',
      icbName: practice.icbName || '',
      postcode: practice.postcode || '',
      population: practice.population ?? null,
    });
  }, []);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex items-start gap-3 lg:min-w-0 lg:flex-1">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Bell size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">Practice email updates</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Search by practice name, ODS code or postcode and subscribe before opening national data.
              </p>
            </div>
          </div>

          <div className="w-full lg:max-w-xl">
            <PracticeLookup
              onSelect={handleSelectPractice}
              searchFn={searchHomePractices}
              showLabel={false}
              searchDescription={null}
              helperText={null}
              placeholder="Search practice name, ODS code or postcode"
            />
          </div>
        </div>

        {selectedPractice && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{selectedPractice.practiceName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedPractice.odsCode}
                {selectedPractice.postcode ? ` - ${selectedPractice.postcode}` : ''}
                {selectedPractice.population ? ` - ${selectedPractice.population.toLocaleString()} patients` : ''}
              </p>
              {(selectedPractice.pcnName || selectedPractice.icbName) && (
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {[selectedPractice.pcnName, selectedPractice.icbName].filter(Boolean).join(' - ')}
                </p>
              )}
            </div>

            <SubscribeButton
              scope="practice"
              odsCode={selectedPractice.odsCode}
              practiceName={selectedPractice.practiceName}
              signupSource="home-page-practice"
              label="Subscribe"
              className="shrink-0 justify-center sm:w-auto"
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default HomeSubscribeSection;
