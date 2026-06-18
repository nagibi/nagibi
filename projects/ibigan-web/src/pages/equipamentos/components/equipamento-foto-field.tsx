import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Star, ZoomIn, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EquipamentoThumbnail } from '@/pages/equipamentos/components/equipamento-thumbnail';
import { EquipamentoFotoCropDialog } from '@/pages/equipamentos/components/equipamento-foto-crop-dialog';
import { EquipamentoFotoViewerDialog } from '@/pages/equipamentos/components/equipamento-foto-viewer-dialog';
import type { EquipamentoFoto } from '@/types/equipamento';

export type EquipamentoFotoPrincipal =
  | { type: 'existing'; id: number }
  | { type: 'new'; index: number };

type EquipamentoFotosFieldProps = {
  label?: string;
  patrimonio: string;
  tipoNome?: string | null;
  existingFotos?: EquipamentoFoto[];
  removedFotoIds?: number[];
  newFotos: File[];
  onNewFotosChange: (files: File[]) => void;
  onRemoveExisting?: (fotoId: number) => void;
  onRemoveNew?: (index: number) => void;
  principal?: EquipamentoFotoPrincipal | null;
  onPrincipalChange?: (principal: EquipamentoFotoPrincipal | null) => void;
  className?: string;
};

export function EquipamentoFotosField({
  label = 'Fotos do equipamento',
  patrimonio,
  tipoNome,
  existingFotos = [],
  removedFotoIds = [],
  newFotos,
  onNewFotosChange,
  onRemoveExisting,
  onRemoveNew,
  principal = null,
  onPrincipalChange,
  className,
}: EquipamentoFotosFieldProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const visibleExisting = existingFotos.filter((foto) => !removedFotoIds.includes(foto.id));
  const hasPhotos = visibleExisting.length > 0 || newFotos.length > 0;
  const canSetPrincipal = Boolean(onPrincipalChange) && hasPhotos;

  const viewerImages = useMemo(
    () => [
      ...visibleExisting.map((foto) => ({ id: foto.id, url: foto.url ?? '' })),
      ...previewUrls.map((url, index) => ({ id: undefined, url: url ?? `new-${index}` })),
    ].filter((item) => item.url),
    [previewUrls, visibleExisting],
  );

  useEffect(() => {
    const urls = newFotos.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newFotos]);

  const resetCropState = () => {
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
    }
    setCropImageSrc(null);
    setPendingFile(null);
    setCropQueue([]);
  };

  const handleCropDialogOpenChange = (open: boolean) => {
    setCropOpen(open);
    if (!open) {
      resetCropState();
    }
  };

  const beginCrop = (file: File) => {
    setCropImageSrc(URL.createObjectURL(file));
    setPendingFile(file);
    setCropOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    resetCropState();
    const [first, ...rest] = files;
    setCropQueue(rest);
    beginCrop(first);
  };

  const handleCropConfirm = (file: File) => {
    const nextFotos = [...newFotos, file];
    onNewFotosChange(nextFotos);

    if (!principal && onPrincipalChange && visibleExisting.length === 0) {
      onPrincipalChange({ type: 'new', index: 0 });
    }

    if (cropQueue.length > 0) {
      const [next, ...rest] = cropQueue;
      setCropQueue(rest);
      if (cropImageSrc) {
        URL.revokeObjectURL(cropImageSrc);
      }
      setCropImageSrc(null);
      setPendingFile(null);
      beginCrop(next);
      return;
    }

    setCropOpen(false);
    resetCropState();
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const isExistingPrincipal = (fotoId: number) =>
    principal?.type === 'existing' && principal.id === fotoId;

  const isNewPrincipal = (index: number) =>
    principal?.type === 'new' && principal.index === index;

  const handleSetExistingPrincipal = (fotoId: number) => {
    onPrincipalChange?.({ type: 'existing', id: fotoId });
  };

  const handleSetNewPrincipal = (index: number) => {
    onPrincipalChange?.({ type: 'new', index });
  };

  const handleRemoveExisting = (fotoId: number) => {
    onRemoveExisting?.(fotoId);

    if (principal?.type === 'existing' && principal.id === fotoId) {
      const nextExisting = visibleExisting.find((foto) => foto.id !== fotoId);
      if (nextExisting && nextExisting.id > 0) {
        onPrincipalChange?.({ type: 'existing', id: nextExisting.id });
      } else if (newFotos.length > 0) {
        onPrincipalChange?.({ type: 'new', index: 0 });
      } else {
        onPrincipalChange?.(null);
      }
    }
  };

  const handleRemoveNew = (index: number) => {
    onRemoveNew?.(index);

    if (principal?.type === 'new') {
      if (principal.index === index) {
        if (visibleExisting.length > 0) {
          const nextExisting = visibleExisting[0];
          if (nextExisting.id > 0) {
            onPrincipalChange?.({ type: 'existing', id: nextExisting.id });
          }
        } else if (newFotos.length > 1) {
          onPrincipalChange?.({ type: 'new', index: 0 });
        } else {
          onPrincipalChange?.(null);
        }
      } else if (principal.index > index) {
        onPrincipalChange?.({ type: 'new', index: principal.index - 1 });
      }
    }
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Label>{label}</Label>
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
        {hasPhotos ? (
          <div className="flex flex-wrap gap-2">
            {visibleExisting.map((foto, index) => (
              <div key={`existing-${foto.id}`} className="group relative size-16 shrink-0">
                <button
                  type="button"
                  onClick={() => openViewer(index)}
                  aria-label="Ver foto em tamanho maior"
                  className={cn(
                    'size-16 overflow-hidden rounded-lg border bg-background',
                    isExistingPrincipal(foto.id) ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                  )}
                >
                  <img
                    src={foto.url}
                    alt={tipoNome ?? patrimonio}
                    className="size-16 object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                    <ZoomIn className="size-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
                {isExistingPrincipal(foto.id) ? (
                  <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-primary/90 px-1 py-0.5 text-center text-[9px] font-medium text-primary-foreground">
                    Principal
                  </span>
                ) : null}
                {canSetPrincipal && !isExistingPrincipal(foto.id) ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 left-0 size-6 rounded-full shadow-sm"
                    onClick={() => handleSetExistingPrincipal(foto.id)}
                    aria-label="Definir como foto principal"
                  >
                    <Star className="size-3" />
                  </Button>
                ) : null}
                {onRemoveExisting ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute -right-1 -top-1 size-6 rounded-full shadow-sm"
                    onClick={() => handleRemoveExisting(foto.id)}
                    aria-label="Remover foto"
                  >
                    <X className="size-3" />
                  </Button>
                ) : null}
              </div>
            ))}
            {newFotos.map((file, index) => {
              const previewUrl = previewUrls[index];
              if (!previewUrl) {
                return null;
              }

              const viewerItemIndex = visibleExisting.length + index;

              return (
                <div key={`new-${file.name}-${index}`} className="group relative size-16 shrink-0">
                  <button
                    type="button"
                    onClick={() => openViewer(viewerItemIndex)}
                    aria-label="Ver foto em tamanho maior"
                    className={cn(
                      'size-16 overflow-hidden rounded-lg border bg-background',
                      isNewPrincipal(index) ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                    )}
                  >
                    <img
                      src={previewUrl}
                      alt={tipoNome ?? patrimonio}
                      className="size-16 object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                      <ZoomIn className="size-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </button>
                  {isNewPrincipal(index) ? (
                    <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-primary/90 px-1 py-0.5 text-center text-[9px] font-medium text-primary-foreground">
                      Principal
                    </span>
                  ) : null}
                  {canSetPrincipal && !isNewPrincipal(index) ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-0 left-0 size-6 rounded-full shadow-sm"
                      onClick={() => handleSetNewPrincipal(index)}
                      aria-label="Definir como foto principal"
                    >
                      <Star className="size-3" />
                    </Button>
                  ) : null}
                  {onRemoveNew ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute -right-1 -top-1 size-6 rounded-full shadow-sm"
                      onClick={() => handleRemoveNew(index)}
                      aria-label="Remover foto"
                    >
                      <X className="size-3" />
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <EquipamentoThumbnail
              equipamento={{ patrimonio, tipo: { nome: tipoNome } }}
              size="md"
              className="size-16"
            />
            <p className="text-xs text-muted-foreground">
              Adicione uma ou mais fotos da galeria ou da câmera. Toque na estrela para definir a principal.
            </p>
          </div>
        )}

        <div className={cn('flex flex-wrap gap-2', hasPhotos ? 'mt-3' : 'mt-0')}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            Galeria
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="size-4" />
            Tirar foto
          </Button>
        </div>
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <EquipamentoFotoCropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        sourceFile={pendingFile}
        onOpenChange={handleCropDialogOpenChange}
        onConfirm={handleCropConfirm}
      />

      <EquipamentoFotoViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        images={viewerImages}
        initialIndex={viewerIndex}
        title={tipoNome ?? patrimonio}
        subtitle={patrimonio}
      />
    </div>
  );
}

/** @deprecated Use EquipamentoFotosField */
export const EquipamentoFotoField = EquipamentoFotosField;

function appendFotosToFormData(formData: FormData, fotos?: File[]) {
  fotos?.forEach((file, index) => {
    formData.append(`fotos[${index}]`, file);
  });

  if (fotos?.[0]) {
    formData.append('foto', fotos[0]);
  }
}

function appendFotosRemoverToFormData(formData: FormData, fotosRemover?: number[]) {
  fotosRemover?.forEach((id, index) => {
    formData.append(`fotos_remover[${index}]`, String(id));
  });
}

function appendPrincipalToFormData(
  formData: FormData,
  principal?: EquipamentoFotoPrincipal | null,
) {
  if (!principal) {
    return;
  }

  if (principal.type === 'existing') {
    formData.append('foto_principal_id', String(principal.id));
    return;
  }

  formData.append('foto_principal_novo_indice', String(principal.index));
}

export function resolvePrincipalPayload(principal?: EquipamentoFotoPrincipal | null) {
  if (!principal) {
    return {};
  }

  if (principal.type === 'existing') {
    return { foto_principal_id: principal.id };
  }

  return { foto_principal_novo_indice: principal.index };
}

function buildEquipamentoFormData(
  fields: Record<string, string | number | boolean>,
  fotos?: File[],
  fotosRemover?: number[],
  principal?: EquipamentoFotoPrincipal | null,
): FormData {
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      formData.append(key, value ? '1' : '0');
      return;
    }

    formData.append(key, String(value));
  });

  appendFotosToFormData(formData, fotos);
  appendFotosRemoverToFormData(formData, fotosRemover);
  appendPrincipalToFormData(formData, principal);

  return formData;
}

export function buildEquipamentoStoreFormData(payload: {
  patrimonio: string;
  tipo_id: number;
  fornecedor_id: number;
  obra_id: number;
  valor_mensal: number;
  data_entrada: string;
  is_critico: boolean;
  fotos?: File[];
  principal?: EquipamentoFotoPrincipal | null;
}): FormData {
  const { fotos, principal, ...fields } = payload;
  return buildEquipamentoFormData(fields, fotos, undefined, principal);
}

export function buildEquipamentoUpdateFormData(payload: {
  patrimonio: string;
  tipo_id: number;
  fornecedor_id: number;
  obra_id: number;
  valor_mensal: number;
  is_critico: boolean;
  fotos?: File[];
  fotos_remover?: number[];
  principal?: EquipamentoFotoPrincipal | null;
}): FormData {
  const { fotos, fotos_remover, principal, ...fields } = payload;
  return buildEquipamentoFormData(fields, fotos, fotos_remover, principal);
}

export function getEquipamentoExistingFotos(
  equipamento: { fotos?: EquipamentoFoto[]; foto_url?: string | null },
): EquipamentoFoto[] {
  if (equipamento.fotos?.length) {
    return [...equipamento.fotos].sort((left, right) => {
      const leftOrder = left.ordem ?? 0;
      const rightOrder = right.ordem ?? 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.id - right.id;
    });
  }

  if (equipamento.foto_url) {
    return [{ id: 0, url: equipamento.foto_url, ordem: 0, is_principal: true }];
  }

  return [];
}

export function getDefaultEquipamentoPrincipal(
  existingFotos: EquipamentoFoto[],
): EquipamentoFotoPrincipal | null {
  const principal =
    existingFotos.find((foto) => foto.is_principal)
    ?? existingFotos.find((foto) => foto.id > 0)
    ?? existingFotos[0];

  if (!principal || principal.id <= 0) {
    return null;
  }

  return { type: 'existing', id: principal.id };
}

export function hasPrincipalChanged(
  current: EquipamentoFotoPrincipal | null,
  initial: EquipamentoFotoPrincipal | null,
): boolean {
  if (!current && !initial) {
    return false;
  }

  if (!current || !initial) {
    return true;
  }

  return current.type !== initial.type
    || (current.type === 'existing' && initial.type === 'existing' && current.id !== initial.id)
    || (current.type === 'new' && initial.type === 'new' && current.index !== initial.index);
}
