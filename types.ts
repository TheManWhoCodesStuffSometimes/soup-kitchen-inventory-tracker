export interface InventoryItem {
  id: string;
  category: string; // This will become "foodType" in future but keeping for compatibility
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

// NEW: Soup Kitchen Category type
export type SoupKitchenCategory = 'Perishable' | 'Catering/Banquet' | 'Shelf Stable';

export interface VoiceAnalysisResult {
  itemName: string;
  category: Category | 'Other';
  estimatedWeightLbs: number;
  quantity?: number;  // Optional since voice might not always detect it
  donorName?: string; // Optional since voice might not always detect it
}

export interface ImageAnalysisResult {
    description: string;
    category: Category | 'Other';
    weightLbs: number;
}

// NEW: Updated Dashboard Item interface to match Airtable response
export interface DashboardItem {
  id: string;
  createdTime: string;
  "Item ID": string;
  "Form ID": string;
  "Total Items in Submission": number;
  "Total Weight in Submission": number;
  "Description": string;
  "Food Type": string; // NEW: Renamed from "Category"
  "Soup Kitchen Category": SoupKitchenCategory; // NEW: Added
  "Donor Name": string;
  "Weight (lbs)": number;
  "Quantity": number;
  "Estimated Value": number;
  "Price Per Unit": number;
  "Confidence Level": string;
  "Pricing Source": string;
  "Search Results Summary": string;
  "Pricing Notes": string;
  "Processing Date": string;
  "Created At": string;
  "Last Modified": string;
}
