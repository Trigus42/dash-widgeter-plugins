import type { FaceBox, ImmichAsset, SelectOption } from './types';
import type { HttpRequest, HttpResponse } from '@/types';

interface MemoryResponse {
  data?: { year?: number };
  assets?: ImmichAsset[];
}

export async function fetchFaceBoxHelper(
  req: <T>(r: HttpRequest) => Promise<HttpResponse<T>>,
  url: string,
  headers: Record<string, string>,
): Promise<FaceBox | null> {
  const res = await req<
    Array<{
      boundingBoxX1: number;
      boundingBoxX2: number;
      boundingBoxY1: number;
      boundingBoxY2: number;
      imageWidth: number;
      imageHeight: number;
    }>
  >({
    url,
    method: 'GET',
    headers,
    proxy: 'always',
  });
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;
  const f = res.data[0];
  if (!f || !f.imageWidth || !f.imageHeight) return null;
  return {
    cx: (f.boundingBoxX1 + f.boundingBoxX2) / 2 / f.imageWidth,
    cy: (f.boundingBoxY1 + f.boundingBoxY2) / 2 / f.imageHeight,
  };
}

export async function fetchMemoriesHelper(
  req: <T>(r: HttpRequest) => Promise<HttpResponse<T>>,
  url: string,
  headers: Record<string, string>,
): Promise<ImmichAsset[]> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await req<MemoryResponse[]>({
    url: `${url}?for=${today}`,
    method: 'GET',
    headers,
    proxy: 'always',
  });
  if (!res.ok) throw new Error(`Immich memories failed (${res.status})`);
  const now = new Date().getFullYear();
  return (res.data ?? []).flatMap((memory) => {
    const years = memory.data?.year ? now - memory.data.year : 0;
    const title = years > 0 ? `${years} year${years > 1 ? 's' : ''} ago` : 'Memory';
    return (memory.assets ?? []).map((a) => ({ ...a, memoryTitle: title }));
  });
}

export async function fetchAssetAlbumsHelper(
  req: <T>(r: HttpRequest) => Promise<HttpResponse<T>>,
  url: string,
  headers: Record<string, string>,
): Promise<string[]> {
  try {
    const res = await req<Array<{ id: string; albumName: string }>>({
      url,
      method: 'GET',
      headers,
      proxy: 'always',
    });
    if (!res.ok || !Array.isArray(res.data)) return [];
    return res.data.map((a) => a.albumName).filter(Boolean);
  } catch {
    return [];
  }
}

export async function listAlbumsHelper(
  req: <T>(r: HttpRequest) => Promise<HttpResponse<T>>,
  url: string,
  headers: Record<string, string>,
): Promise<SelectOption[]> {
  const res = await req<Array<{ id: string; albumName: string }>>({
    url,
    method: 'GET',
    headers,
    proxy: 'always',
  });
  if (!res.ok) throw new Error(`Immich albums failed (${res.status})`);
  return (res.data ?? []).map((a) => ({ label: a.albumName, value: a.id }));
}

export async function listPeopleHelper(
  req: <T>(r: HttpRequest) => Promise<HttpResponse<T>>,
  url: string,
  headers: Record<string, string>,
): Promise<SelectOption[]> {
  const res = await req<{ people?: Array<{ id: string; name: string }> }>({
    url,
    method: 'GET',
    headers,
    proxy: 'always',
  });
  if (!res.ok) throw new Error(`Immich people failed (${res.status})`);
  return (res.data.people ?? [])
    .filter((p) => p.name)
    .map((p) => ({ label: p.name, value: p.id }));
}

export async function listTagsHelper(
  req: <T>(r: HttpRequest) => Promise<HttpResponse<T>>,
  url: string,
  headers: Record<string, string>,
): Promise<SelectOption[]> {
  const res = await req<Array<{ id: string; value: string }>>({
    url,
    method: 'GET',
    headers,
    proxy: 'always',
  });
  if (!res.ok) throw new Error(`Immich tags failed (${res.status})`);
  return (res.data ?? []).map((t) => ({ label: t.value, value: t.id }));
}
