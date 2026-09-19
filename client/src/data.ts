export type Customer = {
  id: string; // e.g. CUST-1082 (human-readable, never UUID)
  name: string;
  source: 'SELF' | 'DEALER' | 'DISTRIBUTOR';
  mobile: string;
  assignedDealer: string;
  city: string;
  regDate: string;
  status: 'Active' | 'Pending';
  totalValue: number;
  points: number;
};

export type Dealer = {
  id: string; // e.g. DLR-992A
  shopName: string;
  ownerName: string;
  type: 'Wholesale' | 'Retail' | 'Distributor';
  location: string;
  contact: string;
  orders: number;
  joinedDate: string;
  status: 'Active' | 'Pending' | 'Inactive';
};

export const MOCK_CUSTOMERS: Customer[] = [];

export const MOCK_DEALERS: Dealer[] = [];

