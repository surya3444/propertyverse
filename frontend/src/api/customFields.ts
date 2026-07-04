import { api } from './client';
import { CustomFieldDef, EntityType } from '../types';

// Agent-defined custom field schemas per entity type. The schema is reused across
// all records of that type and is fed to the voice AI (backend geminiService).
export const customFieldsApi = {
  get: (entityType: EntityType) =>
    api.get<{ entityType: EntityType; fields: CustomFieldDef[] }>(`/custom-fields/${entityType}`),

  update: (entityType: EntityType, fields: CustomFieldDef[]) =>
    api.put<{ entityType: EntityType; fields: CustomFieldDef[] }>(
      `/custom-fields/${entityType}`,
      { fields }
    ),
};
