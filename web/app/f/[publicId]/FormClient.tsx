'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchForm,
  submitForm,
  uploadFiles,
  isFieldVisible,
  PublicForm,
  PublicField,
  FormValue,
  UploadedMedia,
} from '../../../lib/api';

type Status = 'loading' | 'ready' | 'notfound' | 'submitting' | 'success';

export default function FormClient({ publicId }: { publicId: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [form, setForm] = useState<PublicForm | null>(null);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>('');
  // Field keys with an upload currently in flight (blocks submit).
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    fetchForm(publicId)
      .then((f) => {
        if (!active) return;
        setForm(f);
        setStatus('ready');
      })
      .catch((e) => {
        if (!active) return;
        setLoadError(e.message);
        setStatus('notfound');
      });
    return () => {
      active = false;
    };
  }, [publicId]);

  const accentStyle = form?.accentColor
    ? ({ ['--accent' as string]: form.accentColor } as React.CSSProperties)
    : undefined;

  // Only the fields whose conditional rules pass under the current answers.
  const visibleFields = useMemo(
    () => (form ? form.fields.filter((f) => isFieldVisible(f, values)) : []),
    [form, values]
  );

  function setValue(key: string, value: FormValue) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onPickFiles(field: PublicField, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading((u) => ({ ...u, [field.key]: true }));
    try {
      const picked = Array.from(fileList);
      const media = await uploadFiles(publicId, picked, field.accept || 'image');
      const existing = (values[field.key] as UploadedMedia[]) || [];
      // Multiple = append; single = replace.
      setValue(field.key, field.multiple ? [...existing, ...media] : media);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading((u) => ({ ...u, [field.key]: false }));
    }
  }

  function removeFile(key: string, url: string) {
    const existing = (values[key] as UploadedMedia[]) || [];
    setValue(
      key,
      existing.filter((m) => m.url !== url)
    );
  }

  function isFilled(f: PublicField): boolean {
    const v = values[f.key];
    if (f.type === 'file') return Array.isArray(v) && v.length > 0;
    return !!(typeof v === 'string' && v.trim());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (Object.values(uploading).some(Boolean)) {
      setError('Please wait for uploads to finish.');
      return;
    }
    // Client-side required check (visible fields only) for a friendly message.
    const missing = visibleFields.filter((f) => f.required && !isFilled(f)).map((f) => f.label);
    if (missing.length) {
      setError(`Please fill in: ${missing.join(', ')}.`);
      return;
    }
    setError(null);
    setStatus('submitting');
    try {
      // Only send answers for currently-visible fields (backend also enforces).
      const payload: Record<string, FormValue> = {};
      for (const f of visibleFields) {
        if (values[f.key] !== undefined) payload[f.key] = values[f.key];
      }
      const msg = await submitForm(publicId, payload);
      setSuccessMsg(msg);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('ready');
    }
  }

  if (status === 'loading') return <SkeletonForm />;

  if (status === 'notfound') {
    return (
      <main className="page">
        <div className="hero" />
        <div className="card">
          <div className="brand">PropertyVerse</div>
          <h1 className="title">Form unavailable</h1>
          <p className="desc">{loadError || 'This form is no longer available.'}</p>
        </div>
      </main>
    );
  }

  if (status === 'success') {
    return (
      <main className="page">
        <div className="hero" style={accentStyle} />
        <div className="card" style={accentStyle}>
          <div className="success">
            <div className="check">✓</div>
            <h1 className="title">All done</h1>
            <p className="desc">{successMsg}</p>
          </div>
          <div className="footer">Powered by PropertyVerse</div>
        </div>
      </main>
    );
  }

  const submitting = status === 'submitting';
  const anyUploading = Object.values(uploading).some(Boolean);
  const cta = form?.type === 'property' ? 'Submit property' : 'Send my requirement';

  return (
    <main className="page">
      <div className="hero" style={accentStyle} />
      <div className="card" style={accentStyle}>
        {form?.agentName ? <div className="brand">{form.agentName}</div> : <div className="brand">PropertyVerse</div>}
        <h1 className="title">{form?.title}</h1>
        {form?.description ? <p className="desc">{form.description}</p> : null}

        {error ? <div className="error">{error}</div> : null}

        <form onSubmit={onSubmit} noValidate>
          {visibleFields.map((f) => (
            <div className="field" key={f.key}>
              <label className="label" htmlFor={f.key}>
                {f.label}
                {f.required ? <span className="req">*</span> : null}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  id={f.key}
                  className="textarea"
                  placeholder={f.placeholder}
                  value={(values[f.key] as string) || ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select
                  id={f.key}
                  className="select"
                  value={(values[f.key] as string) || ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                >
                  <option value="">Select…</option>
                  {(f.options || []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === 'file' ? (
                <FileField
                  field={f}
                  files={(values[f.key] as UploadedMedia[]) || []}
                  uploading={!!uploading[f.key]}
                  onPick={(list) => onPickFiles(f, list)}
                  onRemove={(url) => removeFile(f.key, url)}
                />
              ) : (
                <input
                  id={f.key}
                  className="input"
                  type={f.type}
                  inputMode={f.type === 'number' ? 'numeric' : f.type === 'tel' ? 'tel' : undefined}
                  placeholder={f.placeholder}
                  value={(values[f.key] as string) || ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                />
              )}
            </div>
          ))}

          <button className="button" type="submit" disabled={submitting || anyUploading}>
            {submitting ? 'Submitting…' : anyUploading ? 'Uploading…' : cta}
          </button>
        </form>

        <div className="footer">Powered by PropertyVerse</div>
      </div>
    </main>
  );
}

// A file upload control: a dropzone-style picker plus thumbnails/chips for each
// uploaded file, with remove buttons.
function FileField({
  field,
  files,
  uploading,
  onPick,
  onRemove,
}: {
  field: PublicField;
  files: UploadedMedia[];
  uploading: boolean;
  onPick: (list: FileList | null) => void;
  onRemove: (url: string) => void;
}) {
  const isImage = (field.accept || 'image') === 'image';
  const acceptAttr =
    field.accept === 'document'
      ? '.pdf,.doc,.docx,.xls,.xlsx,.txt'
      : field.accept === 'any'
        ? undefined
        : 'image/*';
  const hint = isImage ? 'PNG, JPG or WEBP' : 'PDF, Word, Excel or text';

  return (
    <div className="filefield">
      <label className={`dropzone${uploading ? ' dropzone--busy' : ''}`}>
        <input
          type="file"
          className="filehidden"
          accept={acceptAttr}
          multiple={field.multiple}
          disabled={uploading}
          onChange={(e) => {
            onPick(e.target.files);
            e.currentTarget.value = '';
          }}
        />
        <span className="dropicon">{uploading ? '⏳' : '⬆️'}</span>
        <span className="droptext">
          {uploading ? 'Uploading…' : `Tap to ${files.length ? 'add more' : 'upload'}`}
        </span>
        <span className="drophint">{hint}</span>
      </label>

      {files.length ? (
        <div className={`filelist${isImage ? ' filelist--grid' : ''}`}>
          {files.map((m) =>
            isImage ? (
              <div className="thumb" key={m.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.name || 'upload'} />
                <button type="button" className="thumbx" onClick={() => onRemove(m.url)} aria-label="Remove">
                  ×
                </button>
              </div>
            ) : (
              <div className="filechip" key={m.url}>
                <span className="fileicon">📄</span>
                <span className="filename">{m.name || m.url.split('/').pop()}</span>
                <button type="button" className="filex" onClick={() => onRemove(m.url)} aria-label="Remove">
                  ×
                </button>
              </div>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

// Skeleton shown while the form definition loads.
function SkeletonForm() {
  return (
    <main className="page">
      <div className="hero" />
      <div className="card">
        <div className="skeleton sk-line" style={{ width: '30%' }} />
        <div className="skeleton sk-line" style={{ width: '70%', height: 22 }} />
        <div className="skeleton sk-line" style={{ width: '90%', marginBottom: 24 }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="skeleton sk-line" style={{ width: '35%' }} />
            <div className="skeleton sk-field" />
          </div>
        ))}
        <div className="skeleton sk-field" style={{ height: 50, marginTop: 8 }} />
      </div>
    </main>
  );
}
