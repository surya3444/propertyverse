'use client';

import { useEffect, useState } from 'react';
import { fetchForm, submitForm, PublicForm } from '../../../lib/api';

type Status = 'loading' | 'ready' | 'notfound' | 'submitting' | 'success';

export default function FormClient({ publicId }: { publicId: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [form, setForm] = useState<PublicForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>('');

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

  function setValue(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    // Client-side required check for a friendly message before the round-trip.
    const missing = form.fields
      .filter((f) => f.required && !((values[f.key] || '').trim()))
      .map((f) => f.label);
    if (missing.length) {
      setError(`Please fill in: ${missing.join(', ')}.`);
      return;
    }
    setError(null);
    setStatus('submitting');
    try {
      const msg = await submitForm(publicId, values);
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
          {form?.fields.map((f) => (
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
                  value={values[f.key] || ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select
                  id={f.key}
                  className="select"
                  value={values[f.key] || ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                >
                  <option value="">Select…</option>
                  {(f.options || []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={f.key}
                  className="input"
                  type={f.type}
                  inputMode={f.type === 'number' ? 'numeric' : f.type === 'tel' ? 'tel' : undefined}
                  placeholder={f.placeholder}
                  value={values[f.key] || ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                />
              )}
            </div>
          ))}

          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : cta}
          </button>
        </form>

        <div className="footer">Powered by PropertyVerse</div>
      </div>
    </main>
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
