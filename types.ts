
export interface InventoryItem {
  id: string;
  category: string;
  donorName: string;
  customDonorText: string;
  description: string;
  weightLbs: number;
  quantity: number;
  expirationDate: string;
}

export interface Summary {
  totalItems: number;
  totalWeightLbs: number;
}

export type Donor = 'Ridley\'s' | 'Perkins' | 'Safeway' | 'UW Catering' | 'Training Table' | 'Bagelmakers' | 'Little Caesar\'s' | 'Insomnia Cookies' | 'Sinclair Gas' | 'Bread Depot' | 'Ivinson Memorial Hospital (IMH)' | 'Early Childhood Education Ctr' | 'custom';

export type Category = 'Canned Goods' | 'Fresh Produce' | 'Dairy' | 'Meat' | 'Bakery' | 'Frozen' | 'Pantry Staples' | 'Beverages' | 'Snacks' | 'Other';

export interface VoiceAnalysisResult {
  itemName: string;
  category: Category | 'Other';
  estimatedWeightLbs: number;
}

export interface ImageAnalysisResult {
    description: string;
    category: Category | 'Other';
    weightLbs: number;
}
