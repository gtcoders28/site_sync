/**
 * Parse dynamic time range filters into ISO date strings for SQL queries
 * Supported presets: 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_quarter', 'this_year'
 * Or custom: startDate, endDate
 * 
 * @param {object} query - { timeframe, startDate, endDate }
 * @returns {{ fromDate: string, toDate: string }}
 */
const parseDateRange = (query = {}) => {
  const now = new Date();
  let fromDate;
  let toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const { timeframe, startDate, endDate } = query;

  if (startDate && endDate) {
    fromDate = new Date(startDate);
    toDate = new Date(endDate);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      return {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      };
    }
  }

  switch (timeframe) {
    case 'today': {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    }
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      fromDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      toDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      fromDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      break;
    }
    case 'last_week': {
      const day = now.getDay();
      const diff = now.getDate() - day - 6 + (day === 0 ? -6 : 1);
      fromDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      toDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999);
      break;
    }
    case 'this_month': {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
    }
    case 'last_month': {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'this_quarter': {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      fromDate = new Date(now.getFullYear(), quarterMonth, 1, 0, 0, 0, 0);
      break;
    }
    case 'this_year': {
      fromDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    }
    default: {
      // Default to last 30 days
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 30);
      break;
    }
  }

  return {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
  };
};

module.exports = {
  parseDateRange,
};
