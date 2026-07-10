// The kinds of property an agent can list. Order roughly groups residential →
// land → commercial. Keep in sync with the backend Property model + Gemini
// schema enums (backend/src/models/Property.js, services/geminiService.js).
export type PropertyType =
  | 'Apartment'
  | 'Independent House'
  | 'Villa'
  | 'Penthouse'
  | 'Studio'
  | 'Plot'
  | 'Land'
  | 'Farmhouse'
  | 'Commercial'
  | 'Office'
  | 'Shop'
  | 'Warehouse';
export type RequirementType = PropertyType | 'Any';

// Single source of truth for the pickers (property form) and lead requirement
// type (which additionally allows "Any").
export const PROPERTY_TYPES: PropertyType[] = [
  'Apartment',
  'Independent House',
  'Villa',
  'Penthouse',
  'Studio',
  'Plot',
  'Land',
  'Farmhouse',
  'Commercial',
  'Office',
  'Shop',
  'Warehouse',
];
export const REQUIREMENT_TYPES: RequirementType[] = ['Any', ...PROPERTY_TYPES];
export type Urgency = 'High' | 'Medium' | 'Low';
export type LeadStatus = 'New' | 'Contacted' | 'Closed';
export type ListingType = 'Sale' | 'Rent';
export type TransactionType = 'Buy' | 'Rent';
export type Furnishing = 'Unfurnished' | 'Semi-furnished' | 'Furnished';
export type PropertyStatus = 'Available' | 'Under Offer' | 'Sold' | 'Rented';
export type ContactRole = 'Owner' | 'Buyer' | 'Tenant' | 'Seller';
export type ActivityKind = 'Visit' | 'Follow-up' | 'Call' | 'Note';
export type ActivityStatus = 'Scheduled' | 'Done' | 'Cancelled' | 'Missed';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

// A stored GeoJSON point (coordinates are [lng, lat]) plus where it came from.
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
  label?: string;
  placeId?: string;
}

// A place suggestion returned by the autocomplete endpoint.
export interface PlaceCandidate {
  placeId: string;
  label: string;
  primary: string;
  secondary: string;
}

// A concrete, disambiguated location the user picked (sent to the API on save).
export interface SelectedLocation {
  label: string;
  placeId?: string;
  lat: number;
  lng: number;
}

export interface LeadRequirements {
  transactionType?: TransactionType;
  budgetMax?: number;
  propertyType?: RequirementType;
  /** Desired bedroom count (BHK), scored against a property's features.bedrooms. */
  bedrooms?: number;
  location?: string;
  geo?: GeoPoint;
  urgency?: Urgency;
  rawAudioTranscript?: string;
}

// ---- Matching ----

// How strong a match is, in words. Mirrors the backend's quality bands.
export type MatchQuality = 'excellent' | 'strong' | 'fair' | 'weak' | 'unknown';

// One human-readable justification for a match score. `warning` reasons are the
// caveats an agent needs to know before they pitch (e.g. "6% over budget").
export interface MatchReason {
  code: string;
  label: string;
  tone: 'positive' | 'neutral' | 'warning';
}

// Attached by the matching endpoints to whichever side they return.
export interface MatchInfo {
  matchScore?: number;
  matchQuality?: MatchQuality;
  matchReasons?: MatchReason[];
  distanceKm?: number;
}

// A person in the CRM. The same contact can own properties and/or be a buyer/tenant.
// ---- Agent-defined custom fields ----

export type EntityType = 'property' | 'lead' | 'contact';
export type CustomFieldType = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'boolean';

// One agent-defined custom field in an entity's schema.
export interface CustomFieldDef {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
  // Whether the voice AI should try to extract this field.
  aiExtract?: boolean;
  aiHint?: string;
}

// Values stored on a record, keyed by custom field key.
export type CustomFieldValues = Record<string, string | number | boolean>;

export interface Contact {
  _id: string;
  agentId: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  roles: ContactRole[];
  customFields?: CustomFieldValues;
  createdAt: string;
  updatedAt: string;
}

// A populated ref (contact/property) as returned on activities.
export interface Ref {
  _id: string;
  name?: string;
  phone?: string;
  title?: string;
  location?: string;
}

export interface Activity {
  _id: string;
  agentId: string;
  contactId: Ref | string;
  propertyId?: Ref | string;
  kind: ActivityKind;
  scheduledAt?: string;
  completedAt?: string;
  status: ActivityStatus;
  notes?: string;
  outcome?: string;
  createdAt: string;
  updatedAt: string;
}

// Draft fields extracted from a spoken property description (nothing persisted).
export interface PropertyVoiceDraft {
  title?: string;
  listingType?: ListingType;
  price?: number;
  deposit?: number;
  propertyType?: PropertyType;
  location?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqFt?: number;
  rawTranscript?: string;
  customFields?: CustomFieldValues;
}

export interface Lead {
  _id: string;
  agentId: string;
  // A string id normally; the lead-detail endpoint populates it to a Ref.
  contactId?: string | Ref;
  clientName: string;
  phoneNumber: string;
  requirements: LeadRequirements;
  status: LeadStatus;
  // How the lead was captured; voice leads are AI-extracted, form leads arrive
  // from a public capture form.
  source?: 'voice' | 'manual' | 'form';
  // The public form that produced this lead (when source === 'form').
  formId?: string;
  // False for AI-extracted leads until the agent confirms the requirements.
  reviewed?: boolean;
  // Set when the lead is Closed against a specific property.
  closedPropertyId?: string;
  customFields?: CustomFieldValues;
  createdAt: string;
  updatedAt: string;
}

// A Cloudinary-hosted photo or document attached to a property.
export interface PropertyMedia {
  url: string;
  publicId?: string;
  resourceType?: string; // 'image' | 'raw'
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  name?: string;
  mimeType?: string;
}

export interface PropertyFeatures {
  bedrooms?: number;
  bathrooms?: number;
  balconies?: number;
  areaSqFt?: number;
  carpetAreaSqFt?: number;
}

export interface Property {
  _id: string;
  agentId: string;
  title: string;
  price: number;
  propertyType: PropertyType;
  listingType?: ListingType;
  monthlyRent?: number;
  deposit?: number;
  maintenance?: number;
  ownerId?: string | Contact;
  location: string;
  geo?: GeoPoint;
  features?: PropertyFeatures;
  furnishing?: Furnishing;
  floor?: number;
  totalFloors?: number;
  facing?: string;
  availableFrom?: string;
  description?: string;
  amenities?: string[];
  images?: PropertyMedia[];
  documents?: PropertyMedia[];
  status?: PropertyStatus;
  isAvailable: boolean;
  // How the listing was captured; form listings arrive from a public capture form.
  source?: 'manual' | 'form';
  // The public form that produced this listing (when source === 'form').
  formId?: string;
  customFields?: CustomFieldValues;
  createdAt: string;
  updatedAt: string;
}

// A property returned by the matching engine, with its score and rationale.
export type PropertyMatch = Property & MatchInfo;

// A lead returned by the reverse matching engine.
export type LeadMatch = Lead & MatchInfo;

// ---- Forms (public lead/property capture) ----

export type FormType = 'lead' | 'property';
export type FormFieldType = 'text' | 'tel' | 'email' | 'number' | 'select' | 'textarea' | 'file';
export type FormFileAccept = 'image' | 'document' | 'any';
export type VisibleOperator = 'equals' | 'notEquals' | 'in' | 'notIn';

// Conditional-visibility rule: show the field only when the answer to `field`
// satisfies `operator` against `values`. Absent = always shown.
export interface VisibleWhen {
  field: string;
  operator: VisibleOperator;
  values: string[];
}

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  enabled?: boolean;
  order?: number;
  options?: string[];
  placeholder?: string;
  custom?: boolean;
  // For `file` fields.
  accept?: FormFileAccept;
  multiple?: boolean;
  // Optional conditional visibility.
  visibleWhen?: VisibleWhen;
}

export interface Form {
  _id: string;
  agentId: string;
  type: FormType;
  title: string;
  description?: string;
  publicId: string;
  accentColor?: string;
  fields: FormField[];
  isActive: boolean;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormResponse {
  _id: string;
  formId: string;
  formType: FormType;
  data: Record<string, string>;
  contactId?: string;
  leadId?: string;
  propertyId?: string;
  read: boolean;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  agentId: string;
  type: string;
  title: string;
  body?: string;
  formId?: string;
  responseId?: string;
  entityType?: 'Lead' | 'Property';
  entityId?: string;
  read: boolean;
  createdAt: string;
}
