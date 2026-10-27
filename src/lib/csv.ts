export function downloadCsv(filename: string, rows: readonly (readonly (string | number)[])[]): void {
  const content = rows.map((row) =>
    row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','),
  ).join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
