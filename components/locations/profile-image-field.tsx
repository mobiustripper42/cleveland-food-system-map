'use client';

import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  finishProfileUpload,
  removeProfileImage,
  startProfileUpload,
} from '@/app/(site)/locations/file-actions';
import { PROFILE_MAX_PX, THUMB_MAX_PX } from '@/lib/files';
import type { EditableLocation } from '@/lib/types';

type Scaled = { blob: Blob; width: number; height: number };

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

/** Draws `source` to fit within `maxPx` and encodes it as `type`. */
async function encode(
  source: CanvasImageSource & { width: number; height: number },
  maxPx: number,
  type: string,
): Promise<Scaled | null> {
  const ratio = Math.min(1, maxPx / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * ratio));
  const height = Math.max(1, Math.round(source.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await toBlob(canvas, type);
  // Browsers without the encoder (older Safari for WebP) fall back to PNG.
  return blob && blob.type === type ? { blob, width, height } : null;
}

/**
 * Scales a picked photo in the browser: full (≤1600px) + thumb (≤480px),
 * WebP where supported, else JPEG. EXIF rotation is applied first.
 */
async function scaleImage(
  file: File,
): Promise<{ full: Scaled; thumb: Scaled }> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    for (const type of ['image/webp', 'image/jpeg']) {
      const full = await encode(bitmap, PROFILE_MAX_PX, type);
      if (!full) continue;
      const thumb = await encode(bitmap, THUMB_MAX_PX, type);
      if (thumb) return { full, thumb };
    }
    throw new Error('encode');
  } finally {
    bitmap.close();
  }
}

async function put(
  target: { url: string; headers: Record<string, string> },
  blob: Blob,
) {
  const res = await fetch(target.url, {
    method: 'PUT',
    headers: target.headers,
    body: blob,
  });
  if (!res.ok) throw new Error(`upload ${res.status}`);
}

/**
 * Profile image for one location. Uploads on pick, independent of the
 * details form's Save. Editors and this location's owners.
 */
export function ProfileImageField({
  locationId,
  locationName,
  image,
}: {
  locationId: string;
  locationName: string;
  image: EditableLocation['image'];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState('');
  const [message, setMessage] = useState('');

  function upload(file: File) {
    setMessage('');
    startTransition(async () => {
      try {
        setStep('Scaling…');
        let scaled;
        try {
          scaled = await scaleImage(file);
        } catch {
          setMessage("Can't read that image. Try a JPEG, PNG, or WebP.");
          return;
        }
        const { full, thumb } = scaled;

        setStep('Uploading…');
        const start = await startProfileUpload(locationId, {
          contentType: full.blob.type,
          bytes: full.blob.size,
          thumbBytes: thumb.blob.size,
        });
        if (start.status === 'error') {
          setMessage(start.message);
          return;
        }
        await Promise.all([
          put(start.full, full.blob),
          put(start.thumb, thumb.blob),
        ]);

        setStep('Saving…');
        const done = await finishProfileUpload(locationId, {
          key: start.full.key,
          thumbKey: start.thumb.key,
          width: full.width,
          height: full.height,
        });
        setMessage(done.status === 'idle' ? '' : done.message);
      } catch {
        setMessage('Upload failed. Check your connection and try again.');
      } finally {
        setStep('');
        if (inputRef.current) inputRef.current.value = '';
      }
    });
  }

  function remove() {
    if (!confirm(`Remove the photo for ${locationName}?`)) return;
    setMessage('');
    startTransition(async () => {
      setStep('Removing…');
      const res = await removeProfileImage(locationId);
      setStep('');
      setMessage(res.status === 'idle' ? '' : res.message);
    });
  }

  return (
    <section aria-labelledby="photo-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="photo-heading" className="text-lg font-semibold">
          Photo
        </h2>
        <p className="text-sm text-muted-foreground">
          Shown on the map and the location&apos;s page. Saved as soon as you
          pick it; large photos are scaled down first.
        </p>
      </div>

      {image?.image_url && (
        <img
          src={image.image_url}
          alt={`Current photo of ${locationName}`}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          className="aspect-[4/3] w-full max-w-sm rounded-md border border-neutral-200 object-cover"
        />
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-image">
          {image ? 'Replace photo' : 'Add a photo'}
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            id="profile-image"
            type="file"
            accept="image/*"
            disabled={pending}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) upload(file);
            }}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
          />
          {image && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={remove}
              className="sm:w-auto"
            >
              Remove photo
            </Button>
          )}
        </div>
        <p role="status" className="text-sm">
          {step || message}
        </p>
      </div>
    </section>
  );
}
