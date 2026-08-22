function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function getShanghaiRanking(name) {
  const slug = slugify(name);
  const url = `https://www.shanghairanking.com/universities/${slug}`;
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'ChinaUniTracker/1.0' },
      next: { revalidate: 86400 },
    });
    if (!response.ok) return { url, entries: [] };

    const text = stripHtml(await response.text());
    const entries = [];
    const patterns = [
      { key: 'ARWU', regex: new RegExp(`${escapeRegExp(name)} ranks #([0-9]+(?:-[0-9]+)?) in the (20[0-9]{2}) Academic Ranking of World Universities`, 'i') },
      { key: 'BCUR', regex: new RegExp(`${escapeRegExp(name)} ranks #([0-9]+(?:-[0-9]+)?) in the (20[0-9]{2}) Best Chinese Universities Ranking`, 'i') },
      { key: 'Finance & economics', regex: new RegExp(`${escapeRegExp(name)} ranks #([0-9]+(?:-[0-9]+)?) in the (20[0-9]{2}) Ranking of Chinese Financial and Economic Universities`, 'i') },
      { key: 'Non-government finance & economics', regex: new RegExp(`${escapeRegExp(name)} ranks #([0-9]+(?:-[0-9]+)?) in the (20[0-9]{2}) Ranking of Chinese Non-government Financial and Economic Universities`, 'i') },
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) entries.push({ type: pattern.key, rank: match[1], year: match[2] });
    }

    return { url, entries };
  } catch {
    return { url, entries: [] };
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
