// Keep original asset paths usable both locally and under /repository/ on Pages.
export function assetUrl(url,base=import.meta.env?.BASE_URL??'/'){
  return url.startsWith('/assets/')?`${base.replace(/\/$/,'')}${url}`:url;
}
