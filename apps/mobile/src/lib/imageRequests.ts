import client from '@/api/client';

function inferMimeType(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export function createImageFormData(uri: string, fieldName = 'image') {
  const filename = uri.split('/').pop() || 'image.jpg';
  const formData = new FormData();
  formData.append(fieldName, {
    uri,
    name: filename,
    type: inferMimeType(filename),
  } as never);
  return formData;
}

export async function analyzeLocalImage(
  uri: string,
  endpoint: '/api/ai/analyze-garment-photo' | '/api/ai/analyze-body-scan'
) {
  const formData = createImageFormData(uri);
  const response = await client.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45000,
  });
  return response.data?.data;
}

export async function uploadImageUri(uri: string) {
  const formData = createImageFormData(uri);
  const response = await client.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45000,
  });
  return response.data?.data;
}

export async function uploadBodyScanUri(uri: string) {
  const formData = createImageFormData(uri);
  const response = await client.post('/api/users/body-scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return response.data?.data;
}
