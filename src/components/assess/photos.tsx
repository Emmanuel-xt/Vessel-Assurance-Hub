"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight, ImageOff, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { photos } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { errorMessage } from "@/lib/errors";
import { MAX_PHOTOS_PER_QUESTION } from "@/lib/services/evidence";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { AddPhotosResult } from "./use-answer-autosave";

const chip =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 sm:justify-start sm:rounded-full";

/** Display URL for a stored photo (an object URL in the mock, a signed URL in production). */
function usePhotoUrl(id: ID) {
  return useRepoQuery(["photos", id, "url"], () => photos.getUrl(id), { staleTime: Infinity, gcTime: Infinity });
}

function reportAdd(result: AddPhotosResult) {
  for (const message of new Set(result.errors)) toast.error(message);
  if (result.skipped > 0) {
    toast.warning(
      `${result.skipped} photo${result.skipped === 1 ? " was" : "s were"} left out: a question can have at most ${MAX_PHOTOS_PER_QUESTION} photos.`,
    );
  }
}

/**
 * "Camera" opens the phone camera directly (capture attribute); "Gallery" picks existing photos (several at once).
 * Hidden once the question has the maximum number of photos.
 */
export function PhotoPickerButtons({
  slotsLeft,
  onAdd,
}: {
  slotsLeft: number;
  onAdd: (files: File[]) => Promise<AddPhotosResult>;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  if (slotsLeft <= 0) return null;

  const onFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // allow picking the same file again
    if (files.length > 0) void onAdd(files).then(reportAdd);
  };

  return (
    <>
      <button type="button" className={chip} onClick={() => cameraInput.current?.click()}>
        <Camera className="size-4" aria-hidden /> Camera
      </button>
      <button type="button" className={chip} onClick={() => galleryInput.current?.click()}>
        <ImagePlus className="size-4" aria-hidden /> Gallery
      </button>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFiles}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFiles}
      />
    </>
  );
}

function PhotoImage({ id, className, alt }: { id: ID; className?: string; alt: string }) {
  const url = usePhotoUrl(id);
  if (url.isPending) return <span className={cn("block animate-pulse bg-muted", className)} />;
  if (!url.data)
    return (
      <span className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)} title="Photo missing">
        <ImageOff className="size-5" aria-label="Photo missing" />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element -- blob/signed URLs are shown as-is, not through next/image
  return <img src={url.data} alt={alt} className={className} />;
}

/**
 * Thumbnails under a question; tap one to see it full screen.
 * `onRemove` (drafts only) shows a Delete button in the full-screen view.
 */
export function PhotoThumbnails({
  photoIds,
  uploading = 0,
  onRemove,
  size = "md",
}: {
  photoIds: ID[];
  uploading?: number;
  onRemove?: (photoId: ID) => Promise<void>;
  size?: "sm" | "md";
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  if (photoIds.length === 0 && uploading === 0) return null;
  const tile = size === "sm" ? "size-14 print:size-28" : "size-20";

  return (
    <div className="space-y-1">
      <ul className="flex flex-wrap gap-2" aria-label="Photos">
        {photoIds.map((id, index) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => setViewing(index)}
              className={cn(
                "block overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
                tile,
              )}
              aria-label={`Open photo ${index + 1} of ${photoIds.length}`}
            >
              <PhotoImage id={id} alt="" className="size-full object-cover" />
            </button>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <li key={`uploading-${i}`}>
            <span
              className={cn("flex items-center justify-center rounded-lg border border-dashed bg-muted/50", tile)}
              role="status"
              aria-label="Adding photo"
            >
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            </span>
          </li>
        ))}
      </ul>
      {onRemove && (
        <p className="text-xs text-muted-foreground">
          {photoIds.length} of {MAX_PHOTOS_PER_QUESTION} photos{uploading > 0 && " · adding…"}
        </p>
      )}
      <PhotoViewer
        photoIds={photoIds}
        index={viewing}
        onIndexChange={setViewing}
        onRemove={onRemove}
      />
    </div>
  );
}

/** Full-screen view with previous / next and (drafts only) delete with confirmation. */
function PhotoViewer({
  photoIds,
  index,
  onIndexChange,
  onRemove,
}: {
  photoIds: ID[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onRemove?: (photoId: ID) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const open = index !== null && photoIds.length > 0;
  const current = open ? Math.min(index, photoIds.length - 1) : 0;
  const id = photoIds[current];
  const go = (step: number) => onIndexChange((current + step + photoIds.length) % photoIds.length);

  async function remove() {
    try {
      await onRemove!(id);
      queryClient.removeQueries({ queryKey: ["photos", id] });
      toast.success("Photo deleted");
      const remaining = photoIds.length - 1;
      onIndexChange(remaining === 0 ? null : Math.min(current, remaining - 1));
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black p-0 text-white ring-0 sm:max-w-none"
        onKeyDown={(event) => {
          if (photoIds.length < 2) return;
          if (event.key === "ArrowRight") go(1);
          if (event.key === "ArrowLeft") go(-1);
        }}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
          <DialogTitle className="text-sm font-medium text-white">
            Photo {current + 1} of {photoIds.length}
          </DialogTitle>
          <DialogClose
            render={<Button variant="ghost" size="icon" className="size-11 text-white hover:bg-white/10 hover:text-white" />}
          >
            <X className="size-6" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {id && <PhotoImage id={id} alt={`Photo ${current + 1} of ${photoIds.length}`} className="max-h-full max-w-full object-contain" />}
          {photoIds.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute top-1/2 left-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 hover:bg-black/70"
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-7" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute top-1/2 right-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 hover:bg-black/70"
                aria-label="Next photo"
              >
                <ChevronRight className="size-7" aria-hidden />
              </button>
            </>
          )}
        </div>

        {onRemove && (
          <div className="flex justify-center px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <Button variant="destructive" className="h-12 w-full max-w-xs text-base" onClick={() => setConfirmOpen(true)}>
              <Trash2 /> Delete photo
            </Button>
          </div>
        )}

        {onRemove && (
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete this photo?"
            description="It will be removed from this answer. This can't be undone."
            confirmLabel="Delete"
            destructive
            onConfirm={remove}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
