import { Category, Donor } from './types';

export const CATEGORIES: (Category | 'Other')[] = [
  'Canned Goods',
  'Fresh Produce',
  'Dairy',
  'Meat',
  'Bakery',
  'Frozen',
  'Pantry Staples',
  'Beverages',
  'Snacks',
  'Other'
];

export const DONORS: Donor[] = [
  'Ridley\'s',
  'Perkins',
  'Safeway',
  'UW Catering',
  'Training Table',
  'Bagelmakers',
  'Little Caesar\'s',
  'Insomnia Cookies',
  'Sinclair Gas',
  'Bread Depot',
  'Ivinson Memorial Hospital (IMH)',
  'Early Childhood Education Ctr',
  'custom'
];

export const N8N_WEBHOOKS = {
  VOICE_ANALYZE: 'https://thayneautomations.app.n8n.cloud/webhook/soup-kitchen-voice-analyze',
  IMAGE_ANALYZE: 'https://thayneautomations.app.n8n.cloud/webhook/soup-kitchen-image-analyze', 
  INFO_RECEIVED: 'https://thayneautomations.app.n8n.cloud/webhook/Soup-Kitchen-Info-Recieved',
  RETRIEVE_DASHBOARD_DATA: 'https://thayneautomations.app.n8n.cloud/webhook/soup-kitchen-retrieve-dashboard-data'
};
