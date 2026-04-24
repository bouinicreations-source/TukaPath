// Visa decision engine — driven entirely by structured fields

export const VISA_TYPE_RANK = {
  "Visa Free": 1,
  "Visa on Arrival": 2,
  "eVisa": 3,
  "Visa Required": 4,
  "Not Allowed": 5,
};

export const VISA_COLORS = {
  "Visa Free": "bg-green-100 text-green-800",
  "Visa on Arrival": "bg-blue-100 text-blue-800",
  "eVisa": "bg-purple-100 text-purple-800",
  "Visa Required": "bg-red-100 text-red-800",
  "Not Allowed": "bg-gray-200 text-gray-700",
};

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

export function generateGuidanceText(visaType, applicationRoute, entryStatus, exceptionApplied, exceptionType) {
  let msg = "";

  if (visaType === "Not Allowed" || entryStatus === "Restricted") {
    msg = "Entry is currently restricted based on available information. Please verify with official authorities before travel.";
  } else if (visaType === "Visa Free") {
    msg = "No visa required. Entry is allowed for eligible passport holders.";
  } else if (visaType === "Visa on Arrival" || applicationRoute === "visa_on_arrival") {
    msg = "Visa on arrival available based on your eligibility.";
  } else if (visaType === "eVisa" || applicationRoute === "online_evisa") {
    msg = "eVisa required through official online application before travel.";
  } else if (visaType === "Visa Required") {
    if (applicationRoute === "official_or_sponsor_pretravel") {
      msg = "Advance visa required through official or sponsor-based pre-travel application route.";
    } else if (applicationRoute === "embassy_only") {
      msg = "Advance visa required. Application must be submitted through the embassy.";
    } else if (applicationRoute === "official_pretravel") {
      msg = "Advance visa required through the official pre-travel application route.";
    } else if (applicationRoute === "sponsor_pretravel") {
      msg = "Advance visa required through a sponsor-based pre-travel application route.";
    } else {
      msg = "Advance visa required before travel.";
    }
  }

  if (exceptionApplied && exceptionType) {
    const exMap = {
      "Residence Country": "based on your residence country",
      "Has Valid US Visa": "based on your valid US visa",
      "Has Valid UK Visa": "based on your valid UK visa",
      "Has Valid Schengen Visa": "based on your valid Schengen visa",
    };
    const reason = exMap[exceptionType] || "based on your profile";
    msg += ` This rule applies ${reason}.`;
  }

  return msg;
}

const norm = s => (s || "").toLowerCase().trim();

export function resolveVisa(passportCountry, destinationCountry, userProfile, allBaseRules, allExceptions) {
  if (!passportCountry) {
    return { status: "not_checked", label: "Visa requirements not checked", guidance: null };
  }

  const baseRule = allBaseRules.find(
    r => norm(r.passport_country) === norm(passportCountry) && norm(r.destination_country) === norm(destinationCountry)
  );

  if (!baseRule) {
    return { status: "no_data", label: "No data available. Please verify with official sources.", guidance: null };
  }

  const matchingExceptions = allExceptions.filter(
    e => norm(e.passport_country) === norm(passportCountry) && norm(e.destination_country) === norm(destinationCountry)
  );

  const userMatchedExceptions = matchingExceptions.filter(e => {
    if (e.exception_type === "Residence Country") return norm(e.condition_value) === norm(userProfile?.residence || "");
    if (e.exception_type === "Has Valid US Visa") return !!userProfile?.has_us_visa;
    if (e.exception_type === "Has Valid UK Visa") return !!userProfile?.has_uk_visa;
    if (e.exception_type === "Has Valid Schengen Visa") return !!userProfile?.has_schengen_visa;
    return false;
  });

  const sorted = [...userMatchedExceptions].sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
  const isRestricted = baseRule.entry_status === "Restricted";
  const validExceptions = sorted.filter(e => !isRestricted || e.override_restricted === "Yes");

  let appliedException = null;
  if (validExceptions.length > 0) {
    appliedException = validExceptions.reduce((best, curr) => {
      const bRank = VISA_TYPE_RANK[best.visa_type_override] ?? 99;
      const cRank = VISA_TYPE_RANK[curr.visa_type_override] ?? 99;
      if (cRank < bRank) return curr;
      if (cRank === bRank) return (curr.priority ?? 10) < (best.priority ?? 10) ? curr : best;
      return best;
    });
  }

  const finalVisaType = appliedException?.visa_type_override || baseRule.visa_type;
  const finalEntryStatus = appliedException?.entry_status_override || baseRule.entry_status;
  const finalRoute = appliedException?.application_route_override || baseRule.application_route;
  const finalProcessingDays = appliedException?.processing_days_override ?? baseRule.processing_days;
  const finalDurationDays = appliedException?.visa_duration_days_override ?? baseRule.visa_duration_days;
  const finalCostUsd = appliedException?.visa_cost_usd_override ?? baseRule.visa_cost_usd;

  const guidance = generateGuidanceText(finalVisaType, finalRoute, finalEntryStatus, !!appliedException, appliedException?.exception_type);

  return {
    status: "found",
    visa_type: finalVisaType,
    entry_status: finalEntryStatus,
    application_route: finalRoute,
    processing_days: finalProcessingDays,
    visa_duration_days: finalDurationDays,
    visa_cost_usd: finalCostUsd,
    guidance,
    exception_applied: !!appliedException,
    exception_type: appliedException?.exception_type || null,
    special_notes: appliedException?.special_notes || baseRule.special_notes || null,
    is_restricted: finalVisaType === "Not Allowed" || finalEntryStatus === "Restricted",
  };
}