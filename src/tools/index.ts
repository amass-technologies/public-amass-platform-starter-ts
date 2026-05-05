import { formatGetBiomedcoreRecordByIdResult, getBiomedcoreRecordById } from "./biomedcore/get"
import { formatLookupBiomedcoreAmassIdResult, lookupBiomedcoreAmassId } from "./biomedcore/lookup"
import { formatSearchBiomedcoreRecordsResult, searchBiomedcoreRecords } from "./biomedcore/search"
import { getCurrentDatetime } from "./general/get-current-datetime"
import { formatGetTrialcoreRecordByIdResult, getTrialcoreRecordById } from "./trialcore/get"
import { formatLookupTrialcoreAmassIdResult, lookupTrialcoreAmassId } from "./trialcore/lookup"
import { formatSearchTrialcoreRecordsResult, searchTrialcoreRecords } from "./trialcore/search"

export const tools = {
  get_current_datetime: getCurrentDatetime,
  search_biomedcore_records: searchBiomedcoreRecords,
  lookup_biomedcore_amass_id: lookupBiomedcoreAmassId,
  get_biomedcore_record_by_id: getBiomedcoreRecordById,
  search_trialcore_records: searchTrialcoreRecords,
  lookup_trialcore_amass_id: lookupTrialcoreAmassId,
  get_trialcore_record_by_id: getTrialcoreRecordById,
}

// biome-ignore lint/suspicious/noExplicitAny: registry stores formatters with heterogeneous result types
export type ToolResultFormatter = (result: any) => string

export const toolFormatters: Record<string, ToolResultFormatter> = {
  search_biomedcore_records: formatSearchBiomedcoreRecordsResult,
  lookup_biomedcore_amass_id: formatLookupBiomedcoreAmassIdResult,
  get_biomedcore_record_by_id: formatGetBiomedcoreRecordByIdResult,
  search_trialcore_records: formatSearchTrialcoreRecordsResult,
  lookup_trialcore_amass_id: formatLookupTrialcoreAmassIdResult,
  get_trialcore_record_by_id: formatGetTrialcoreRecordByIdResult,
}
