export const ESTIMATE_RE=/^(?:(?:\d+)w\s*)?(?:(?:\d+)d\s*)?(?:(?:\d+)h\s*)?(?:(?:\d+)m\s*)?$/;export const isValidEstimate=(value:string)=>value.trim()===''||ESTIMATE_RE.test(value.trim());
