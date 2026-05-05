import { getCurrentDatetime } from "./get-current-datetime"
import { formatSearchBiomedcoreRecordsResult, searchBiomedcoreRecords } from "./search-biomedcore-records"

export const tools = {
  get_current_datetime: getCurrentDatetime,
  search_biomedcore_records: searchBiomedcoreRecords,
}

export type ToolResultFormatter = (result: unknown) => string

export const toolFormatters: Record<string, ToolResultFormatter> = {
  search_biomedcore_records: formatSearchBiomedcoreRecordsResult,
}
