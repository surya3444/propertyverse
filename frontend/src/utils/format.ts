import { LeadStatus, Urgency } from '../types';

export function formatCurrency(value?: number): string {
  if (value == null) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}

// Guards against missing/"null" names slipping through from older leads.
export function displayName(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return 'Unknown client';
  }
  return trimmed;
}

export function statusTone(status: LeadStatus): 'primary' | 'warning' | 'muted' {
  if (status === 'New') return 'primary';
  if (status === 'Contacted') return 'warning';
  return 'muted';
}

export function urgencyTone(urgency?: Urgency): 'danger' | 'warning' | 'muted' {
  if (urgency === 'High') return 'danger';
  if (urgency === 'Medium') return 'warning';
  return 'muted';
}
