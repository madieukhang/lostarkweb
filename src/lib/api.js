export async function searchItems(q, signal) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Không thể tìm kiếm lúc này.');
  }
  const body = await response.json();
  return body.results || [];
}
