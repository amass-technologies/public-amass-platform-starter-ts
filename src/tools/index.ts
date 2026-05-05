import { formatSearchBiomedcoreRecordsResult, searchBiomedcoreRecords } from "./biomedcore/search"
import { getCurrentDatetime } from "./general/get-current-datetime"
import { formatSearchTrialcoreRecordsResult, searchTrialcoreRecords } from "./trialcore/search"

export const tools = {
  get_current_datetime: getCurrentDatetime,
  search_biomedcore_records: searchBiomedcoreRecords,
  search_trialcore_records: searchTrialcoreRecords,
}

export type ToolResultFormatter = (result: unknown) => string

export const toolFormatters: Record<string, ToolResultFormatter> = {
  search_biomedcore_records: formatSearchBiomedcoreRecordsResult,
  search_trialcore_records: formatSearchTrialcoreRecordsResult,
}
