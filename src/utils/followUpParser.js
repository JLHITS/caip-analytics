/**
 * Follow Up Analysis Parser
 * Parses CSV appointment data and calculates follow-up rates
 */

/**
 * Parse a date string in DD-MMM-YY format (e.g. "12-Jan-26")
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const monthStr = parts[1];
  const yearShort = parseInt(parts[2], 10);

  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };

  const month = months[monthStr];
  if (month === undefined || isNaN(day) || isNaN(yearShort)) return null;

  const year = yearShort >= 50 ? 1900 + yearShort : 2000 + yearShort;
  return new Date(year, month, day);
}

/**
 * Parse CSV text handling quoted fields with commas
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Merge multiple CSV texts into one (takes header from first, data from all)
 * Deduplicates rows by NHS number + appointment date + clinician
 */
export function mergeCSVTexts(csvTexts) {
  if (csvTexts.length === 0) return '';
  if (csvTexts.length === 1) return csvTexts[0];

  const allLines = [];
  let header = null;
  const seen = new Set();

  for (const text of csvTexts) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) continue;

    if (!header) {
      header = lines[0];
      allLines.push(header);
    }

    // Add data rows, deduplicating
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Use the full line as dedup key (handles exact duplicates)
      if (!seen.has(line)) {
        seen.add(line);
        allLines.push(line);
      }
    }
  }

  return allLines.join('\n');
}

/**
 * Check if a clinician name is a Doctor (GP)
 */
function isDoctor(clinicianName) {
  if (!clinicianName) return false;
  return clinicianName.trim().startsWith('Dr ');
}

/**
 * Parse the follow-up CSV data
 * Returns structured appointment data grouped by patient
 */
export function parseFollowUpCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;

  const headers = parseCSVLine(lines[0]);
  const clinicianIdx = headers.indexOf('Clinician');
  const dateIdx = headers.indexOf('Appointment date');
  const nhsIdx = headers.indexOf('NHS number');
  const firstNameIdx = headers.indexOf('First name');
  const surnameIdx = headers.indexOf('Surname');
  const orgIdx = headers.indexOf('Organisation name');

  if (clinicianIdx === -1 || dateIdx === -1 || nhsIdx === -1) {
    return null;
  }

  const appointments = [];
  const patients = {};
  const clinicians = new Set();
  let orgName = '';

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length <= Math.max(clinicianIdx, dateIdx, nhsIdx)) continue;

    const clinician = fields[clinicianIdx]?.trim();
    const dateStr = fields[dateIdx]?.trim();
    const nhsNumber = fields[nhsIdx]?.trim();
    const date = parseDate(dateStr);

    if (!clinician || !date || !nhsNumber) continue;

    if (!orgName && orgIdx !== -1) {
      orgName = fields[orgIdx]?.trim() || '';
    }

    clinicians.add(clinician);

    const appt = { clinician, date, nhsNumber, isDoctor: isDoctor(clinician) };
    appointments.push(appt);

    if (!patients[nhsNumber]) {
      patients[nhsNumber] = {
        nhsNumber,
        name: `${fields[firstNameIdx] || ''} ${fields[surnameIdx] || ''}`.trim(),
        appointments: [],
      };
    }
    patients[nhsNumber].appointments.push(appt);
  }

  // Sort each patient's appointments by date
  Object.values(patients).forEach(p => {
    p.appointments.sort((a, b) => a.date - b.date);
  });

  // Sort all appointments by date
  appointments.sort((a, b) => a.date - b.date);

  const dateRange = {
    start: appointments[0]?.date,
    end: appointments[appointments.length - 1]?.date,
  };

  return {
    appointments,
    patients,
    clinicians: [...clinicians].sort(),
    doctors: [...clinicians].filter(isDoctor).sort(),
    orgName,
    dateRange,
    totalAppointments: appointments.length,
    totalPatients: Object.keys(patients).length,
  };
}

/**
 * Calculate days between two dates
 */
function daysBetween(d1, d2) {
  return Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Filter appointments to a date window
 * @param {Array} appointments - all appointments sorted by date
 * @param {'all'|'3months'|'4weeks'} timeframe
 */
function filterByTimeframe(appointments, timeframe) {
  if (timeframe === 'all' || !appointments.length) return appointments;

  const latest = appointments[appointments.length - 1].date;
  let cutoff;

  if (timeframe === '3months') {
    cutoff = new Date(latest);
    cutoff.setMonth(cutoff.getMonth() - 3);
  } else if (timeframe === '4weeks') {
    cutoff = new Date(latest);
    cutoff.setDate(cutoff.getDate() - 28);
  }

  return appointments.filter(a => a.date >= cutoff);
}

/**
 * Calculate overall follow-up rates for patients seeing ANY doctor
 * A follow-up is when the same patient sees any doctor again within the window
 */
export function calculateOverallFollowUpRates(data, timeframe = 'all') {
  // Timeframe controls which appointments we MEASURE FROM
  const sourceAppts = filterByTimeframe(data.appointments, timeframe);
  const sourceDoctorAppts = sourceAppts.filter(a => a.isDoctor);

  // Build full (unfiltered) patient doctor appointment lookup for follow-up searches
  const fullPatientDrAppts = {};
  data.appointments.filter(a => a.isDoctor).forEach(a => {
    if (!fullPatientDrAppts[a.nhsNumber]) fullPatientDrAppts[a.nhsNumber] = [];
    fullPatientDrAppts[a.nhsNumber].push(a);
  });
  Object.values(fullPatientDrAppts).forEach(arr => arr.sort((a, b) => a.date - b.date));

  // Group source appointments by patient for counting
  const sourcePatientAppts = {};
  sourceDoctorAppts.forEach(a => {
    if (!sourcePatientAppts[a.nhsNumber]) sourcePatientAppts[a.nhsNumber] = [];
    sourcePatientAppts[a.nhsNumber].push(a);
  });

  let totalDrAppts = 0;
  let followUp7 = 0;
  let followUp14 = 0;
  let followUp28 = 0;

  Object.entries(sourcePatientAppts).forEach(([nhsNumber, appts]) => {
    appts.sort((a, b) => a.date - b.date);
    const fullAppts = fullPatientDrAppts[nhsNumber] || [];

    for (let i = 0; i < appts.length; i++) {
      totalDrAppts++;

      // Find next doctor appointment from FULL dataset after this one
      const nextAppt = fullAppts.find(a => a.date > appts[i].date);
      if (!nextAppt) continue;

      const gap = daysBetween(appts[i].date, nextAppt.date);
      if (gap === 0) continue; // Same day = same visit, skip
      if (gap <= 7) followUp7++;
      else if (gap <= 14) followUp14++;
      else if (gap <= 28) followUp28++;
    }
  });

  // Denominator = all source doctor appointments (no follow-up = patient didn't return)
  const denominator = totalDrAppts || 1;

  const noFollowUp = denominator - followUp7 - followUp14 - followUp28;

  return {
    totalDoctorAppointments: totalDrAppts,
    patientsWithDrAppts: Object.keys(sourcePatientAppts).length,
    followUp7,
    followUp14,
    followUp28,
    noFollowUp,
    totalFollowUps: followUp7 + followUp14 + followUp28,
    rate7: (followUp7 / denominator) * 100,
    rate14: ((followUp7 + followUp14) / denominator) * 100,
    rate28: ((followUp7 + followUp14 + followUp28) / denominator) * 100,
    noFollowUpRate: (noFollowUp / denominator) * 100,
    denominator,
  };
}

/**
 * Calculate follow-up rates for patients seeing the SAME GP
 * Returns overall and per-doctor breakdown
 */
export function calculateSameGPFollowUpRates(data, timeframe = 'all') {
  // Timeframe controls which appointments we MEASURE FROM
  const sourceAppts = filterByTimeframe(data.appointments, timeframe);
  const sourceDoctorAppts = sourceAppts.filter(a => a.isDoctor);

  // Build FULL (unfiltered) patient-doctor appointment lookup for follow-up searches
  const fullPatientDoctorAppts = {}; // { nhsNumber: { doctorName: [appts] } }
  data.appointments.filter(a => a.isDoctor).forEach(a => {
    if (!fullPatientDoctorAppts[a.nhsNumber]) fullPatientDoctorAppts[a.nhsNumber] = {};
    if (!fullPatientDoctorAppts[a.nhsNumber][a.clinician]) fullPatientDoctorAppts[a.nhsNumber][a.clinician] = [];
    fullPatientDoctorAppts[a.nhsNumber][a.clinician].push(a);
  });
  Object.values(fullPatientDoctorAppts).forEach(doctorMap => {
    Object.values(doctorMap).forEach(arr => arr.sort((a, b) => a.date - b.date));
  });

  // Group SOURCE appointments by patient then by doctor
  const sourcePatientDoctorAppts = {};
  sourceDoctorAppts.forEach(a => {
    if (!sourcePatientDoctorAppts[a.nhsNumber]) sourcePatientDoctorAppts[a.nhsNumber] = {};
    if (!sourcePatientDoctorAppts[a.nhsNumber][a.clinician]) sourcePatientDoctorAppts[a.nhsNumber][a.clinician] = [];
    sourcePatientDoctorAppts[a.nhsNumber][a.clinician].push(a);
  });

  // Per-doctor stats
  const doctorStats = {};

  // Overall same-GP stats
  let totalPairs = 0;
  let sameGP7 = 0;
  let sameGP14 = 0;
  let sameGP28 = 0;

  Object.entries(sourcePatientDoctorAppts).forEach(([nhsNumber, doctorMap]) => {
    Object.entries(doctorMap).forEach(([doctor, appts]) => {
      appts.sort((a, b) => a.date - b.date);
      // Get FULL appointment history for this patient-doctor pair
      const fullAppts = fullPatientDoctorAppts[nhsNumber]?.[doctor] || [];

      if (!doctorStats[doctor]) {
        doctorStats[doctor] = {
          name: doctor,
          totalVisits: 0,
          uniquePatients: 0,
          patientsWithRevisit: 0,
          followUp7: 0,
          followUp14: 0,
          followUp28: 0,
          pairs: 0,
        };
      }

      let hasRevisit = false;

      for (let i = 0; i < appts.length; i++) {
        // Find next same-doctor appointment from FULL dataset
        const nextAppt = fullAppts.find(a => a.date > appts[i].date);
        if (!nextAppt) continue;

        const gap = daysBetween(appts[i].date, nextAppt.date);
        if (gap === 0) continue;

        hasRevisit = true;
        totalPairs++;
        doctorStats[doctor].pairs++;

        if (gap <= 7) {
          sameGP7++;
          doctorStats[doctor].followUp7++;
        } else if (gap <= 14) {
          sameGP14++;
          doctorStats[doctor].followUp14++;
        } else if (gap <= 28) {
          sameGP28++;
          doctorStats[doctor].followUp28++;
        }
      }

      if (hasRevisit) doctorStats[doctor].patientsWithRevisit++;
    });
  });

  // Count total visits and unique patients per doctor (from source appointments)
  sourceDoctorAppts.forEach(a => {
    if (!doctorStats[a.clinician]) {
      doctorStats[a.clinician] = {
        name: a.clinician,
        totalVisits: 0,
        uniquePatients: 0,
        patientsWithRevisit: 0,
        followUp7: 0,
        followUp14: 0,
        followUp28: 0,
        pairs: 0,
      };
    }
    doctorStats[a.clinician].totalVisits++;
  });

  // Count unique patients per doctor
  const doctorPatients = {};
  sourceDoctorAppts.forEach(a => {
    if (!doctorPatients[a.clinician]) doctorPatients[a.clinician] = new Set();
    doctorPatients[a.clinician].add(a.nhsNumber);
  });
  Object.entries(doctorPatients).forEach(([doctor, patients]) => {
    if (doctorStats[doctor]) doctorStats[doctor].uniquePatients = patients.size;
  });

  // Calculate rates per doctor
  const doctorBreakdown = Object.values(doctorStats)
    .map(d => ({
      ...d,
      // Per-doctor denominator mirrors overall logic: all source visits for that doctor.
      rate7: d.totalVisits > 0 ? (d.followUp7 / d.totalVisits) * 100 : 0,
      rate14: d.totalVisits > 0 ? ((d.followUp7 + d.followUp14) / d.totalVisits) * 100 : 0,
      rate28: d.totalVisits > 0 ? ((d.followUp7 + d.followUp14 + d.followUp28) / d.totalVisits) * 100 : 0,
    }))
    .sort((a, b) => b.totalVisits - a.totalVisits);

  // Denominator = all source doctor appointments (not just those with same-GP revisits)
  const totalSourceAppts = sourceDoctorAppts.length;
  const denominator = totalSourceAppts || 1;

  return {
    totalPairs,
    totalSourceAppts,
    sameGP7,
    sameGP14,
    sameGP28,
    rate7: (sameGP7 / denominator) * 100,
    rate14: ((sameGP7 + sameGP14) / denominator) * 100,
    rate28: ((sameGP7 + sameGP14 + sameGP28) / denominator) * 100,
    doctorBreakdown,
  };
}

/**
 * Calculate follow-up rates by individual clinician (Drs only)
 * For each clinician, looks at all their appointments and whether patients
 * return within 1/2/4 weeks to ANY doctor
 */
export function calculateClinicianFollowUpRates(data, timeframe = 'all') {
  // Timeframe controls which appointments we MEASURE FROM
  const sourceAppts = filterByTimeframe(data.appointments, timeframe);
  const sourceDoctorAppts = sourceAppts.filter(a => a.isDoctor);

  // Build FULL (unfiltered) patient doctor appointment lookup for follow-up searches
  const allPatientAppts = {};
  data.appointments.filter(a => a.isDoctor).forEach(a => {
    if (!allPatientAppts[a.nhsNumber]) allPatientAppts[a.nhsNumber] = [];
    allPatientAppts[a.nhsNumber].push(a);
  });
  Object.values(allPatientAppts).forEach(arr => arr.sort((a, b) => a.date - b.date));

  // Group source doctor appointments by clinician
  const clinicianAppts = {};
  sourceDoctorAppts.forEach(a => {
    if (!clinicianAppts[a.clinician]) clinicianAppts[a.clinician] = [];
    clinicianAppts[a.clinician].push(a);
  });

  const results = Object.entries(clinicianAppts).map(([clinician, appts]) => {
    const uniquePatients = new Set(appts.map(a => a.nhsNumber));
    let followUp7 = 0;
    let followUp14 = 0;
    let followUp28 = 0;
    let noFollowUp = 0;

    appts.forEach(appt => {
      // Find the next DOCTOR appointment for this patient after this one
      const patientAllAppts = allPatientAppts[appt.nhsNumber] || [];
      const nextAppt = patientAllAppts.find(a => a.date > appt.date);

      if (!nextAppt) {
        noFollowUp++;
        return;
      }

      const gap = daysBetween(appt.date, nextAppt.date);
      if (gap <= 7) followUp7++;
      else if (gap <= 14) followUp14++;
      else if (gap <= 28) followUp28++;
      else noFollowUp++;
    });

    const total = appts.length;
    return {
      clinician,
      totalAppointments: total,
      uniquePatients: uniquePatients.size,
      followUp7,
      followUp14,
      followUp28,
      noFollowUp,
      rate7: total > 0 ? (followUp7 / total) * 100 : 0,
      rate14: total > 0 ? ((followUp7 + followUp14) / total) * 100 : 0,
      rate28: total > 0 ? ((followUp7 + followUp14 + followUp28) / total) * 100 : 0,
    };
  });

  return results.sort((a, b) => b.totalAppointments - a.totalAppointments);
}

/**
 * Calculate monthly follow-up trend data (for charts)
 */
export function calculateMonthlyTrends(data) {
  const doctorAppts = data.appointments.filter(a => a.isDoctor);

  // Group by month
  const monthlyAppts = {};
  doctorAppts.forEach(a => {
    const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyAppts[key]) monthlyAppts[key] = [];
    monthlyAppts[key].push(a);
  });

  // Build a full patient DOCTOR appointment lookup
  const allPatientAppts = {};
  data.appointments.filter(a => a.isDoctor).forEach(a => {
    if (!allPatientAppts[a.nhsNumber]) allPatientAppts[a.nhsNumber] = [];
    allPatientAppts[a.nhsNumber].push(a);
  });
  Object.values(allPatientAppts).forEach(arr => arr.sort((a, b) => a.date - b.date));

  const months = Object.keys(monthlyAppts).sort();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return months.map(key => {
    const appts = monthlyAppts[key];
    let f7 = 0, f14 = 0, f28 = 0;

    appts.forEach(appt => {
      const patientAllAppts = allPatientAppts[appt.nhsNumber] || [];
      const nextAppt = patientAllAppts.find(a => a.date > appt.date);
      if (!nextAppt) return;

      const gap = daysBetween(appt.date, nextAppt.date);
      if (gap <= 7) f7++;
      else if (gap <= 14) f14++;
      else if (gap <= 28) f28++;
    });

    const total = appts.length;
    const [year, month] = key.split('-');

    return {
      key,
      label: `${monthNames[parseInt(month) - 1]} ${year.substring(2)}`,
      totalAppts: total,
      followUp7: f7,
      followUp14: f14,
      followUp28: f28,
      rate7: total > 0 ? (f7 / total) * 100 : 0,
      rate14: total > 0 ? ((f7 + f14) / total) * 100 : 0,
      rate28: total > 0 ? ((f7 + f14 + f28) / total) * 100 : 0,
    };
  });
}
