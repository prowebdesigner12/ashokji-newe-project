export type ProcessStatus = 'cut' | 'centered' | 'charging' | 'hrm' | 'hrm-hot-out' | 'finished';

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  materialGrade: string;
  totalQuantity: number;
  deliveryDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: string;
}

export interface Batch {
  id: string;
  batchNo: string;
  materialType: string;
  receivedDate: string;
}

export interface BandSawEntry {
  id: string;
  orderId: string; // Link to the order
  masterBatchNo: string;
  subBundleNo: string;
  cutLength: number;
  pcsCut: number;
  weight: number;
  endCutWeight: number;
  date: string;
  status: ProcessStatus;
}

export interface InspectionPiece {
  pcsNo: number;
  od: number;
  thickness: number;
  length: number;
  surface: string;
  remarks: string;
}

export interface InspectionRecord {
  id: string;
  bundleId: string;
  pieces: InspectionPiece[];
  hotOutPcs: number;
  finishPcs: number;
  reworkPcs: number;
  rejectedPcs: number;
  remarks: string;
  photoUrl?: string;
  date: string;
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
}

export interface ProductionReport {
  id: string;
  date: string;
  shift: string;
  productionKg: number;
  waterTankers: number;
  lpgKg: number;
  electricityUnits: number;
  mandrill59: number;
  mandrill51: number;
  guide76: number;
  mandrill63: number;
  guide90: number;
  guide66: number;
  mandrill42: number;
  guide50: number;
}
