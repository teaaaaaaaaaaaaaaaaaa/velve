const crypto = require('crypto');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

function normalizePublicBaseUrl() {
  return String(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
}

function buildPublicUrl(key) {
  return `${normalizePublicBaseUrl()}/${String(key).replace(/^\/+/, '')}`;
}

function normalizeExtension(filename = '', fallback = '.jpg') {
  const ext = path.extname(filename || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  return fallback;
}

function keyFromUrl(url = '') {
  const publicBase = normalizePublicBaseUrl();
  if (publicBase && url.startsWith(publicBase)) {
    return url.slice(publicBase.length + 1);
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, '');
  } catch {
    return String(url).replace(/^\/+/, '');
  }
}

async function uploadBuffer({ key, buffer, contentType }) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: buildPublicUrl(key),
  };
}

async function deleteObject(key) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    })
  );
}

async function fetchRemoteBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch remote image (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

function createUserUploadKey(userId, originalName = '') {
  const ext = normalizeExtension(originalName);
  return `items/${userId}/${crypto.randomUUID()}${ext}`;
}

function createItemCleanKey(itemId, sourceUrl = '') {
  const sourceKey = keyFromUrl(sourceUrl);
  const sourceName = path.basename(
    sourceKey || `${crypto.randomUUID()}.png`,
    path.extname(sourceKey)
  );
  return `items/${itemId}/clean_${sourceName || crypto.randomUUID()}.png`;
}

function createBodyScanKey(userId, extension = '.png') {
  const normalizedExtension = normalizeExtension(`body-scan${extension}`, '.png');
  return `users/${userId}/body-scan_${crypto.randomUUID()}${normalizedExtension}`;
}

function createVtoKey(userId, itemId) {
  return `vto/${userId}/${itemId}_${crypto.randomUUID()}.png`;
}

module.exports = {
  s3,
  buildPublicUrl,
  createBodyScanKey,
  createItemCleanKey,
  createUserUploadKey,
  createVtoKey,
  deleteObject,
  fetchRemoteBuffer,
  keyFromUrl,
  normalizeExtension,
  uploadBuffer,
};
