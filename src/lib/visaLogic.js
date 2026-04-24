// Visa decision algorithm
// All functions are pure — no side effects, no API calls.

export const VISA_TYPES = ["Visa Free", "Visa on Arrival", "eVisa", "Visa Required", "Not Allowed"];
export const ENTRY_STATUSES = ["Open", "Conditional", "Restricted"];
export const APPLICATION_ROUTES = [
  "official_pretravel",
  "sponsor_pretravel",
  "official_or_sponsor_pretravel",
  "embassy_only",
  "online_evisa",
  "visa_on_arrival",
  "no_ordinary_route",
];
export const EXCEPTION_TYPES = [
  "Residence Country",
  "Has Valid US Visa",
  "Has Valid UK Visa",
  "Has Valid Schengen Visa",
];

export const VISA_COLORS = {
  "Visa Free": "bg-green-100 text-green-800",
  "Visa on Arrival": "bg-blue-100 text-blue-800",
  "eVisa": "bg-purple-100 text-purple-800",
  "Visa Required": "bg-red-100 text-red-800",
  "Not Allowed": "bg-gray-100 text-gray-800",
};

const VISA_RANK = ["Visa Free", "Visa on Arrival", "eVisa", "Visa Required", "Not Allowed"];

function norm(str) {
  return (str || "").trim().toLowerCase();
}

/**
 * Main visa computation function.
 * @param {Array} baseRules - all VisaBaseRule records
 * @param {Array} exceptions - all VisaException records
 * @param {Object} profile - { passport_country, destination_country, residence_country, has_us_visa, has_uk_visa, has_schengen_visa }
 * @returns {Object} result
 */
export function computeVisa(baseRules, exceptions, profile) {
  const { passport_country, destination_country, residence_country, has_us_visa, has_uk_visa, has_schengen_visa } = profile;

  // Step 1
  if (!passport_country || !passport_country.trim()) {
    return { status: "not_checked", message: "Visa requirements not checked" };
  }

  // Step 2: find base rule
  const baseRule = (baseRules || []).find(r =>
    norm(r.passport_country) === norm(passport_country) &&
    norm(r.destination_country) === norm(destination_country)
  );

  // Step 3: no base rule
  if (!baseRule) {
    return { status: "no_data", message: "No data available. Please verify with official sources." };
  }

  // Step 4: load all matching exceptions
  const matchingExceptions = (exceptions || []).filter(e =>
    norm(e.passport_country) === norm(passport_country) &&
    norm(e.destination_country) === norm(destination_country)
  );

  // Step 5: check which exceptions match user profile
  const userMatched = matchingExceptions.filter(e => {
    if (e.exception_type === "Residence Country") return norm(e.condition_value) === norm(residence_country);
    if (e.exception_type === "Has Valid US Visa") return has_us_visa === true && e.condition_value === "Yes";
    if (e.exception_type === "Has Valid UK Visa") return has_uk_visa === true && e.condition_value === "Yes";
    if (e.exception_type === "Has Valid Schengen Visa") return has_schengen_visa === true && e.condition_value === "Yes";
    return false;
  });

  // Step 6: sort by priority ascending
  userMatched.sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99));

  // Step 7/8: filter by restricted override
  const validExceptions = userMatched.filter(e =>
    baseRule.entry_status !== "Restricted" || e.override_restricted === "Yes"
  );

  // Step 9: choose best visa type
  let appliedException = null;
  if (validExceptions.length > 0) {
    appliedException = validExceptions.reduce((best, e) => {
      const bestRank = VISA_RANK.indexOf(best.visa_type_override || "Not Allowed");
      const eRank = VISA_RANK.indexOf(e.visa_type_override || "Not Allowed");
      if (eRank < bestRank) return e;
      if (eRank === bestRank) return (Number(e.priority) || 99) < (Number(best.priority) || 99) ? e : best;
      return best;
    });
  }

  // Step 10: build final result
  const final = appliedException ? {
    visa_type: appliedException.visa_type_override || baseRule.visa_type,
    processing_days: appliedException.processing_days_override != null ? appliedException.processing_days_override : baseRule.processing_days,
    visa_duration_days: appliedException.visa_duration_days_override != null ? appliedException.visa_duration_days_override : baseRule.visa_duration_days,
    visa_cost_usd: appliedException.visa_cost_usd_override != null ? appliedException.visa_cost_usd_override : baseRule.visa_cost_usd,
    entry_status: appliedException.entry_status_override || baseRule.entry_status,
    application_route: appliedException.application_route_override || baseRule.application_route,
    special_notes: appliedException.special_notes || baseRule.special_notes,
  } : {
    visa_type: baseRule.visa_type,
    processing_days: baseRule.processing_days,
    visa_duration_days: baseRule.visa_duration_days,
    visa_cost_usd: baseRule.visa_cost_usd,
    entry_status: baseRule.entry_status,
    application_route: baseRule.application_route,
    special_notes: baseRule.special_notes,
  };

  const exceptionReason = appliedException ? getExceptionReason(appliedException) : null;

  return {
    status: "found",
    ...final,
    guidance: generateGuidance(final),
    exception_applied: !!appliedException,
    exception_reason: exceptionReason,
  };
}

export function generateGuidance({ visa_type, application_route, entry_status }) {
  if (visa_type === "Not Allowed" || entry_status === "Restricted") {
    return "Entry is currently restricted based on available information. Please verify with official authorities before travel.";
  }
  if (visa_type === "Visa Free") return "No visa required for entry.";
  if (visa_type === "Visa on Arrival") return "Visa on arrival available based on your eligibility.";
  if (visa_type === "eVisa") return "eVisa required through official online application before travel.";
  if (visa_type === "Visa Required") {
    const routeMessages = {
      official_pretravel: "Advance visa required through official pre-travel application.",
      sponsor_pretravel: "Advance visa required through sponsor-based pre-travel application.",
      official_or_sponsor_pretravel: "Advance visa required through official or sponsor-based pre-travel application route.",
      embassy_only: "Visa required through embassy application only.",
      no_ordinary_route: "No ordinary application route available. Please contact the embassy directly.",
    };
    return routeMessages[application_route] || "Advance visa required before travel.";
  }
  return "Please verify visa requirements before travel.";
}

function getExceptionReason(exc) {
  if (exc.exception_type === "Residence Country") return `based on your residence in ${exc.condition_value}`;
  if (exc.exception_type === "Has Valid US Visa") return "based on your valid US visa";
  if (exc.exception_type === "Has Valid UK Visa") return "based on your valid UK visa";
  if (exc.exception_type === "Has Valid Schengen Visa") return "based on your valid Schengen visa";
  return "based on your profile";
}

export function isRestricted(visaResult) {
  return visaResult?.visa_type === "Not Allowed" || visaResult?.entry_status === "Restricted";
}