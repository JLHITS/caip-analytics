import { loadAppointmentsData } from '../data/dataLoader';

const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

let cachedDirectory = null;
let directoryPromise = null;

const normalise = (value) => String(value || '').trim().toLowerCase();

const monthRank = (month) => {
  const [monthName, year] = String(month || '').trim().split(/\s+/);
  const parsedYear = Number(year);
  const parsedMonth = MONTH_INDEX[normalise(monthName)];

  if (!Number.isFinite(parsedYear) || parsedMonth === undefined) {
    return -1;
  }

  return parsedYear * 12 + parsedMonth;
};

const getLatestMonth = (data) => {
  const months = Object.keys(data || {}).filter((key) => key !== 'metadata');

  return months.reduce((latest, month) => (
    monthRank(month) > monthRank(latest) ? month : latest
  ), months[0]);
};

export async function loadPracticeDirectory() {
  if (cachedDirectory) {
    return cachedDirectory;
  }

  if (directoryPromise) {
    return directoryPromise;
  }

  directoryPromise = (async () => {
    const data = await loadAppointmentsData();
    if (!data) {
      cachedDirectory = [];
      return cachedDirectory;
    }

    const latestMonth = getLatestMonth(data);
    const latestData = data[latestMonth] || {};
    const practices = Array.isArray(latestData.practices)
      ? latestData.practices
      : Array.isArray(latestData)
        ? latestData
        : [];

    const byOdsCode = new Map();

    practices.forEach((practice) => {
      const odsCode = String(practice.odsCode || practice.practiceCode || '').trim();
      const practiceName = String(practice.practiceName || practice.gpName || practice.name || '').trim();

      if (!odsCode || !practiceName) {
        return;
      }

      byOdsCode.set(odsCode, {
        odsCode,
        practiceName,
        icb: practice.icb || practice.icbName || practice.subICBName || '',
        pcn: practice.pcn || practice.pcnName || '',
        latestMonth,
      });
    });

    cachedDirectory = Array.from(byOdsCode.values()).sort((a, b) => (
      a.practiceName.localeCompare(b.practiceName) || a.odsCode.localeCompare(b.odsCode)
    ));

    return cachedDirectory;
  })().finally(() => {
    directoryPromise = null;
  });

  return directoryPromise;
}

export async function searchPracticeDirectory(query, limit = 20) {
  const searchTerm = normalise(query);
  if (searchTerm.length < 2) {
    return [];
  }

  const terms = searchTerm.split(/\s+/).filter(Boolean);
  const directory = await loadPracticeDirectory();

  const matches = directory
    .map((practice) => {
      const name = normalise(practice.practiceName);
      const odsCode = normalise(practice.odsCode);
      const searchable = `${name} ${odsCode}`;

      if (!terms.every((term) => searchable.includes(term))) {
        return null;
      }

      let score = 4;
      if (odsCode === searchTerm) score = 0;
      else if (odsCode.startsWith(searchTerm)) score = 1;
      else if (name.startsWith(searchTerm)) score = 2;
      else if (odsCode.includes(searchTerm)) score = 3;

      return { ...practice, score };
    })
    .filter(Boolean)
    .sort((a, b) => (
      a.score - b.score ||
      a.practiceName.localeCompare(b.practiceName) ||
      a.odsCode.localeCompare(b.odsCode)
    ));

  return matches.slice(0, limit).map((practice) => ({
    odsCode: practice.odsCode,
    practiceName: practice.practiceName,
    icb: practice.icb,
    pcn: practice.pcn,
    latestMonth: practice.latestMonth,
  }));
}

export function clearPracticeDirectoryCache() {
  cachedDirectory = null;
  directoryPromise = null;
}
