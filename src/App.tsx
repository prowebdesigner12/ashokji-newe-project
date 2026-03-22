import React, { useState, useEffect, Component, ErrorInfo, ReactNode, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Scissors, 
  Target, 
  Flame, 
  Settings, 
  AlertCircle, 
  FileText, 
  Plus, 
  RefreshCw, 
  QrCode, 
  Trash2,
  Save,
  Search,
  CheckCircle2,
  XCircle,
  Package,
  ArrowLeft,
  Camera,
  ShoppingCart,
  User,
  Calendar,
  Layers,
  ChevronRight,
  LayoutDashboard,
  History,
  Filter,
  ArrowRight,
  MoreVertical,
  Download,
  Share2
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  updateDoc, 
  doc, 
  getDocs,
  serverTimestamp,
  Timestamp,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { DashboardStats } from './components/DashboardStats';
import { BandSawEntry, ProcessStatus, Batch, Order, ProductionReport, UserProfile, UserRole } from './types';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary Component
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "{}");
        if (parsedError.error) {
          errorMessage = `Database Error: ${parsedError.error} (${parsedError.operationType} on ${parsedError.path})`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-red-100 max-w-md w-full text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tighter">System Error</h1>
            <p className="text-slate-600 mb-8 font-medium leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Restart System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'orders', label: 'Orders', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'band-saw', label: 'Band Saw', icon: <Scissors className="w-4 h-4" /> },
  { id: 'centering', label: 'Centering', icon: <Target className="w-4 h-4" /> },
  { id: 'charging', label: 'Charging', icon: <Flame className="w-4 h-4" /> },
  { id: 'hrm', label: 'HRM', icon: <Settings className="w-4 h-4" /> },
  { id: 'hrm-hot-out', label: 'HRM-HOT-OUT', icon: <AlertCircle className="w-4 h-4" /> },
  { id: 'costing-report', label: 'Costing Report', icon: <FileText className="w-4 h-4" /> },
  { id: 'users', label: 'User Management', icon: <User className="w-4 h-4" />, adminOnly: true },
  { id: 'profile', label: 'My Profile', icon: <Settings className="w-4 h-4" /> },
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [bandSawEntries, setBandSawEntries] = useState<BandSawEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch or create user profile
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
        if (userDoc.empty) {
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'New User',
            photoURL: currentUser.photoURL || undefined,
            role: currentUser.email === 'prashantbagriya7877@gmail.com' ? 'admin' : 'viewer',
            createdAt: new Date().toISOString()
          };
          await addDoc(collection(db, 'users'), newProfile);
          setCurrentUserProfile(newProfile);
        } else {
          setCurrentUserProfile({ id: userDoc.docs[0].id, ...userDoc.docs[0].data() } as any);
        }
      } else {
        setCurrentUserProfile(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    // Fetch Users (Admin only)
    let unsubscribeUsers = () => {};
    if (currentUserProfile?.role === 'admin') {
      const qUsers = query(collection(db, 'users'));
      unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
        const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setUsers(userData);
      });
    }

    // Validate Connection to Firestore
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    // Fetch Orders
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(orderData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    // Fetch Batches
    const qBatches = query(collection(db, 'batches'));
    const unsubscribeBatches = onSnapshot(qBatches, (snapshot) => {
      const batchData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Batch));
      setBatches(batchData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'batches');
    });

    // Fetch Band Saw Entries
    const qEntries = query(collection(db, 'bandSawEntries'));
    const unsubscribeEntries = onSnapshot(qEntries, (snapshot) => {
      const entryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BandSawEntry));
      setBandSawEntries(entryData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bandSawEntries');
    });

    return () => {
      unsubscribeOrders();
      unsubscribeBatches();
      unsubscribeEntries();
      unsubscribeUsers();
    };
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Inspection State
  const [inspectingBundle, setInspectingBundle] = useState<BandSawEntry | null>(null);
  const [inspectionData, setInspectionData] = useState<any[]>([]);

  // Order Form State
  const [orderForm, setOrderForm] = useState({
    orderNo: '',
    customerName: '',
    materialGrade: '',
    totalQuantity: '',
    deliveryDate: '',
  });

  // Band Saw Form State
  const [bandSawForm, setBandSawForm] = useState({
    masterBatchNo: '',
    subBundleNo: '',
    cutLength: '',
    pcsCut: '',
    weight: '',
    endCutWeight: '0',
    orderId: '',
  });

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'orders'), {
        ...orderForm,
        totalQuantity: Number(orderForm.totalQuantity),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setOrderForm({
        orderNo: '',
        customerName: '',
        materialGrade: '',
        totalQuantity: '',
        deliveryDate: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
  };

  const handleSaveBandSaw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'bandSawEntries'), {
        ...bandSawForm,
        cutLength: Number(bandSawForm.cutLength),
        pcsCut: Number(bandSawForm.pcsCut),
        weight: Number(bandSawForm.weight),
        endCutWeight: Number(bandSawForm.endCutWeight),
        date: new Date().toISOString(),
        status: 'cut' as ProcessStatus,
      });
      setBandSawForm({
        masterBatchNo: '',
        subBundleNo: '',
        cutLength: '',
        pcsCut: '',
        weight: '',
        endCutWeight: '0',
        orderId: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bandSawEntries');
    }
  };

  const [reportData, setReportData] = useState<Omit<ProductionReport, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    shift: '',
    productionKg: 0,
    waterTankers: 0,
    lpgKg: 0,
    electricityUnits: 0,
    mandrill59: 0,
    mandrill51: 0,
    guide76: 0,
    mandrill63: 0,
    guide90: 0,
    guide66: 0,
    mandrill42: 0,
    guide50: 0
  });

  const handleReportSubmit = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'productionReports'), {
        ...reportData,
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      });
      alert('Report submitted successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'productionReports');
    }
  };

  const handleWhatsAppShare = () => {
    const text = `*Daily Production Report - ${reportData.date}*\n` +
      `Shift: ${reportData.shift}\n` +
      `Production: ${reportData.productionKg} Kg\n` +
      `Water: ${reportData.waterTankers} Tankers\n` +
      `LPG: ${reportData.lpgKg} Kg\n` +
      `Electricity: ${reportData.electricityUnits} Units\n` +
      `Mandrill Ø59: ${reportData.mandrill59} pcs\n` +
      `Mandrill Ø51: ${reportData.mandrill51} pcs\n` +
      `Guide Ø76: ${reportData.guide76} pcs\n` +
      `Mandrill Ø63: ${reportData.mandrill63} pcs\n` +
      `Guide Ø90: ${reportData.guide90} pcs\n` +
      `Guide Ø66: ${reportData.guide66} pcs\n` +
      `Mandrill Ø42: ${reportData.mandrill42} pcs\n` +
      `Guide Ø50: ${reportData.guide50} pcs`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const updateStatus = async (id: string, newStatus: ProcessStatus) => {
    try {
      await updateDoc(doc(db, 'bandSawEntries', id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bandSawEntries/${id}`);
    }
  };

  const handleInspect = (bundle: BandSawEntry) => {
    setInspectingBundle(bundle);
    const rows = Array.from({ length: bundle.pcsCut }, (_, i) => ({
      pcsNo: i + 1,
      od: '',
      thickness: '',
      length: '',
      surface: '',
      remarks: ''
    }));
    setInspectionData(rows);
  };

  const handleSaveInspection = async () => {
    if (!inspectingBundle) return;
    try {
      await addDoc(collection(db, 'inspections'), {
        bundleId: inspectingBundle.id,
        pieces: inspectionData,
        date: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'bandSawEntries', inspectingBundle.id), { status: 'finished' });
      setInspectingBundle(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'inspections');
    }
  };

  const handleInspectionChange = (index: number, field: string, value: string) => {
    const newData = [...inspectionData];
    newData[index][field] = value;
    setInspectionData(newData);
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', userId)));
      if (!userDoc.empty) {
        await updateDoc(doc(db, 'users', userDoc.docs[0].id), { role: newRole });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const stats = useMemo(() => {
    return {
      rawMaterial: orders.reduce((acc, o) => acc + o.totalQuantity, 0),
      wip: bandSawEntries.filter(e => e.status === 'cut').reduce((acc, e) => acc + e.weight, 0),
      centered: bandSawEntries.filter(e => e.status === 'centered').reduce((acc, e) => acc + e.weight, 0),
      charging: bandSawEntries.filter(e => e.status === 'charging').reduce((acc, e) => acc + e.weight, 0),
      hrm: bandSawEntries.filter(e => e.status === 'hrm').reduce((acc, e) => acc + e.weight, 0),
      finished: bandSawEntries.filter(e => e.status === 'finished').reduce((acc, e) => acc + e.weight, 0),
    };
  }, [orders, bandSawEntries]);

  const chartData = useMemo(() => {
    const statusCounts = {
      'Cut': bandSawEntries.filter(e => e.status === 'cut').length,
      'Centered': bandSawEntries.filter(e => e.status === 'centered').length,
      'Charging': bandSawEntries.filter(e => e.status === 'charging').length,
      'HRM': bandSawEntries.filter(e => e.status === 'hrm').length,
      'Finished': bandSawEntries.filter(e => e.status === 'finished').length,
    };
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [bandSawEntries]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-900 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-[3rem] shadow-2xl border border-black/5 max-w-md w-full text-center"
        >
          <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-200">
            <Package className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tighter">HRM System</h1>
          <p className="text-slate-500 mb-10 font-medium uppercase tracking-widest text-xs">Material Tracking & Control</p>
          
          <button 
            onClick={handleLogin}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
          >
            <User className="w-6 h-6" />
            Sign in with Google
          </button>
          
          <p className="mt-8 text-slate-400 text-xs font-medium uppercase tracking-wider">
            Authorized Personnel Only
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans text-slate-900">
        {/* Header */}
        <header className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-2xl shadow-indigo-500/30 transform -rotate-3">JJ</div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">JAY JAGDAMBA</h1>
              <p className="text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] mt-1">Industrial Management System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-200/60">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Status</p>
                <p className="text-sm font-bold text-slate-700">Operational • {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-200/60">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-black text-slate-900 truncate max-w-[120px]">{user.displayName}</p>
                <button 
                  onClick={handleLogout}
                  className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto">
          <DashboardStats stats={stats} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar Navigation */}
            <aside className="lg:col-span-3 space-y-2">
              <div className="bg-white p-3 rounded-3xl shadow-sm border border-slate-200/60">
                <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Main Menu</p>
                {TABS.filter(tab => !tab.adminOnly || currentUserProfile?.role === 'admin').map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setInspectingBundle(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 translate-x-1'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}>{tab.icon}</span>
                    {tab.label}
                    {activeTab === tab.id && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                  </button>
                ))}
              </div>
              
              <div className="bg-indigo-900 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-3">System Info</p>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-indigo-200/60 uppercase tracking-widest">Operator ID:</p>
                  <p className="text-xs font-black font-mono">{user.uid.slice(0, 12)}...</p>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="lg:col-span-9">
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden min-h-[700px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab + (inspectingBundle ? '-inspecting' : '')}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="p-10"
                  >
                    {inspectingBundle ? (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                          <div className="flex items-center gap-5">
                            <button 
                              onClick={() => setInspectingBundle(null)}
                              className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all active:scale-90"
                            >
                              <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </button>
                            <div>
                              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Inspection Entry</h3>
                              <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mt-1">Sub Bundle: {inspectingBundle.subBundleNo}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="px-4 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-100">
                              {inspectingBundle.pcsCut} Pieces Total
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pcs No</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">OD (mm)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thickness</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Length</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Surface</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {inspectionData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4 text-sm font-black text-slate-900">{row.pcsNo}</td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="number" 
                                      value={row.od}
                                      onChange={(e) => handleInspectionChange(idx, 'od', e.target.value)}
                                      className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="number" 
                                      value={row.thickness}
                                      onChange={(e) => handleInspectionChange(idx, 'thickness', e.target.value)}
                                      className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="number" 
                                      value={row.length}
                                      onChange={(e) => handleInspectionChange(idx, 'length', e.target.value)}
                                      className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <select 
                                      value={row.surface}
                                      onChange={(e) => handleInspectionChange(idx, 'surface', e.target.value)}
                                      className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                                    >
                                      <option value="">Select</option>
                                      <option value="OK">OK</option>
                                      <option value="Minor Scratches">Minor Scratches</option>
                                      <option value="Heavy Scratches">Heavy Scratches</option>
                                      <option value="Dent">Dent</option>
                                    </select>
                                  </td>
                                  <td className="px-6 py-4">
                                    <input 
                                      type="text" 
                                      value={row.remarks}
                                      onChange={(e) => handleInspectionChange(idx, 'remarks', e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-slate-100">
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks:</label>
                              <textarea className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[120px] font-medium" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Photo:</label>
                              <div className="w-full px-6 py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center min-h-[120px] cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group">
                                <Camera className="w-8 h-8 text-slate-300 group-hover:text-indigo-500 mb-3 transition-colors" />
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Choose file or drag here</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col justify-end">
                            <button 
                              onClick={handleSaveInspection}
                              className="flex items-center justify-center gap-3 px-12 py-5 bg-emerald-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-emerald-500/30 hover:bg-emerald-700 active:scale-95 transition-all w-full"
                            >
                              <Save className="w-5 h-5" />
                              Save All Inspection Data
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {activeTab === 'dashboard' && (
                          <div className="space-y-10">
                            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                              <div className="p-3 bg-indigo-50 rounded-2xl">
                                <LayoutDashboard className="w-8 h-8 text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">System Dashboard</h3>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Overview of industrial operations</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <h4 className="text-lg font-black uppercase tracking-tighter mb-6">Production Status (Pcs)</h4>
                                <div className="h-[300px] w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                      <Tooltip 
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#f8fafc' }}
                                      />
                                      <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <h4 className="text-lg font-black uppercase tracking-tighter mb-6">Process Distribution</h4>
                                <div className="h-[300px] w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                      >
                                        {chartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={['#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'][index % 5]} />
                                        ))}
                                      </Pie>
                                      <Tooltip />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-900 p-10 rounded-[3rem] text-white relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                              <h4 className="text-xl font-black uppercase tracking-tighter mb-6 relative z-10">Recent Activity</h4>
                              <div className="space-y-4 relative z-10">
                                {bandSawEntries.slice(0, 5).map((entry, idx) => (
                                  <div key={idx} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                                    <div className="flex items-center gap-4">
                                      <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                                      <p className="text-sm font-bold text-white/80">Sub Bundle {entry.subBundleNo} moved to {entry.status.toUpperCase()}</p>
                                    </div>
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{new Date(entry.date).toLocaleDateString()}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'users' && currentUserProfile?.role === 'admin' && (
                          <div className="space-y-10">
                            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                              <div className="p-3 bg-purple-50 rounded-2xl">
                                <User className="w-8 h-8 text-purple-600" />
                              </div>
                              <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">User Management</h3>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Control system access and roles</p>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-[2rem] border border-slate-100 shadow-sm">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {users.map((u) => (
                                    <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden">
                                            {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 m-2.5 text-slate-400" />}
                                          </div>
                                          <p className="text-sm font-black text-slate-900">{u.displayName}</p>
                                        </div>
                                      </td>
                                      <td className="px-8 py-6 text-sm font-bold text-slate-500">{u.email}</td>
                                      <td className="px-8 py-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                          u.role === 'admin' ? 'bg-red-50 text-red-600' : 
                                          u.role === 'operator' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {u.role}
                                        </span>
                                      </td>
                                      <td className="px-8 py-6 text-right">
                                        <select 
                                          value={u.role}
                                          onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                          <option value="viewer">Viewer</option>
                                          <option value="operator">Operator</option>
                                          <option value="admin">Admin</option>
                                        </select>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {activeTab === 'profile' && (
                          <div className="space-y-10">
                            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                              <div className="p-3 bg-indigo-50 rounded-2xl">
                                <User className="w-8 h-8 text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">My Profile</h3>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Personal account settings</p>
                              </div>
                            </div>

                            <div className="max-w-2xl bg-slate-50 p-10 rounded-[3rem] border border-slate-200/60">
                              <div className="flex flex-col items-center text-center mb-10">
                                <div className="w-32 h-32 bg-white rounded-[2.5rem] p-2 shadow-xl mb-6">
                                  <div className="w-full h-full rounded-[2rem] bg-indigo-600 flex items-center justify-center overflow-hidden">
                                    {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-white" />}
                                  </div>
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 tracking-tight">{user.displayName}</h4>
                                <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mt-1">{currentUserProfile?.role}</p>
                              </div>

                              <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/60">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                                  <p className="text-sm font-bold text-slate-900">{user.email}</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/60">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User ID</p>
                                  <p className="text-sm font-mono font-bold text-slate-900">{user.uid}</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/60">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Account Created</p>
                                  <p className="text-sm font-bold text-slate-900">{currentUserProfile?.createdAt ? new Date(currentUserProfile.createdAt).toLocaleDateString() : 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'orders' && (
                        <div className="space-y-12">
                          <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                            <div className="p-3 bg-indigo-50 rounded-2xl">
                              <ShoppingCart className="w-8 h-8 text-indigo-600" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Order Punching</h3>
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Create and manage customer orders</p>
                            </div>
                          </div>

                          <form onSubmit={handleSaveOrder} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Number:</label>
                              <div className="relative">
                                <ShoppingCart className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <input 
                                  required
                                  type="text"
                                  value={orderForm.orderNo}
                                  onChange={(e) => setOrderForm({...orderForm, orderNo: e.target.value})}
                                  placeholder="ORD-2024-001"
                                  className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Name:</label>
                              <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <input 
                                  required
                                  type="text"
                                  value={orderForm.customerName}
                                  onChange={(e) => setOrderForm({...orderForm, customerName: e.target.value})}
                                  placeholder="Enter Customer Name"
                                  className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Grade:</label>
                              <div className="relative">
                                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <input 
                                  required
                                  type="text"
                                  value={orderForm.materialGrade}
                                  onChange={(e) => setOrderForm({...orderForm, materialGrade: e.target.value})}
                                  placeholder="e.g. 304L, 316"
                                  className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Quantity (Kg):</label>
                              <input 
                                required
                                type="number"
                                value={orderForm.totalQuantity}
                                onChange={(e) => setOrderForm({...orderForm, totalQuantity: e.target.value})}
                                placeholder="0.00"
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Date:</label>
                              <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <input 
                                  required
                                  type="date"
                                  value={orderForm.deliveryDate}
                                  onChange={(e) => setOrderForm({...orderForm, deliveryDate: e.target.value})}
                                  className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                                />
                              </div>
                            </div>

                            <div className="flex items-end">
                              <button type="submit" className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all">
                                <Plus className="w-5 h-5" />
                                Punch Order
                              </button>
                            </div>
                          </form>

                          <div className="mt-16">
                            <div className="flex items-center justify-between mb-8">
                              <h4 className="text-lg font-black text-slate-900 tracking-tight">Recent Orders</h4>
                              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-100">
                                <Filter className="w-3 h-3" />
                                Filter Orders
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {orders.map((order) => (
                                <div key={order.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group">
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                      <ShoppingCart className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                      order.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'
                                    }`}>
                                      {order.status}
                                    </span>
                                  </div>
                                  <h5 className="text-xl font-black text-slate-900 tracking-tight mb-1">{order.orderNo}</h5>
                                  <p className="text-sm font-bold text-slate-400 mb-4">{order.customerName}</p>
                                  
                                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                    <div>
                                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Grade</p>
                                      <p className="text-sm font-bold text-slate-700">{order.materialGrade}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Quantity</p>
                                      <p className="text-sm font-bold text-slate-700">{order.totalQuantity} Kg</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {orders.length === 0 && (
                                <div className="col-span-2 py-20 text-center bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
                                  <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No orders punched yet</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'band-saw' && (
                        <div className="space-y-12">
                          <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                            <div className="p-3 bg-blue-50 rounded-2xl">
                              <Scissors className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Band Saw Cutting</h3>
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Material sizing and cutting process</p>
                            </div>
                          </div>

                          <form onSubmit={handleSaveBandSaw} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link to Order:</label>
                              <select 
                                required
                                value={bandSawForm.orderId}
                                onChange={(e) => setBandSawForm({...bandSawForm, orderId: e.target.value})}
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold appearance-none cursor-pointer"
                              >
                                <option value="">-- Select Order --</option>
                                {orders.map(o => (
                                  <option key={o.id} value={o.id}>{o.orderNo} ({o.customerName})</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Batch:</label>
                              <select 
                                required
                                value={bandSawForm.masterBatchNo}
                                onChange={(e) => setBandSawForm({...bandSawForm, masterBatchNo: e.target.value})}
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold appearance-none cursor-pointer"
                              >
                                <option value="">-- Select Batch --</option>
                                <option value="BB25A3833 (304L)">BB25A3833 (304L)</option>
                                <option value="BB25A3834 (304L)">BB25A3834 (304L)</option>
                                <option value="BB25A3416 (304L)">BB25A3416 (304L)</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub Bundle No:</label>
                              <input 
                                required
                                type="text"
                                value={bandSawForm.subBundleNo}
                                onChange={(e) => setBandSawForm({...bandSawForm, subBundleNo: e.target.value})}
                                placeholder="Enter Sub Bundle No"
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cut Length (mm):</label>
                              <input 
                                required
                                type="number"
                                value={bandSawForm.cutLength}
                                onChange={(e) => setBandSawForm({...bandSawForm, cutLength: e.target.value})}
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pcs Cut:</label>
                              <input 
                                required
                                type="number"
                                value={bandSawForm.pcsCut}
                                onChange={(e) => setBandSawForm({...bandSawForm, pcsCut: e.target.value})}
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight (Kg):</label>
                              <input 
                                required
                                type="number"
                                value={bandSawForm.weight}
                                onChange={(e) => setBandSawForm({...bandSawForm, weight: e.target.value})}
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                              />
                            </div>

                            <div className="lg:col-span-3 flex flex-wrap gap-4 pt-6">
                              <button type="submit" className="flex items-center gap-2 px-10 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all">
                                <Save className="w-5 h-5" />
                                Save Cut Details
                              </button>
                              <button type="button" className="flex items-center gap-2 px-10 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-black transition-all active:scale-95">
                                <RefreshCw className="w-5 h-5" />
                                Refresh
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setBandSawForm({ masterBatchNo: '', subBundleNo: '', cutLength: '', pcsCut: '', weight: '', endCutWeight: '0', orderId: '' })}
                                className="flex items-center gap-2 px-10 py-4 bg-orange-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-orange-600 transition-all active:scale-95"
                              >
                                <Trash2 className="w-5 h-5" />
                                Clear
                              </button>
                            </div>
                          </form>

                          <div className="mt-16">
                            <div className="flex items-center justify-between mb-8">
                              <h4 className="text-lg font-black text-slate-900 tracking-tight">Cutting Log</h4>
                              <div className="px-4 py-2 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-100">
                                {bandSawEntries.filter(e => e.status === 'cut').length} Entries
                              </div>
                            </div>
                            <div className="overflow-hidden rounded-[2rem] border border-slate-100 shadow-sm">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order / Batch</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub Bundle</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pcs</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {bandSawEntries.filter(e => e.status === 'cut').map((entry) => (
                                    <tr key={entry.id} className="hover:bg-indigo-50/30 transition-colors group">
                                      <td className="px-8 py-5">
                                        <p className="text-sm font-black text-slate-900">{entry.masterBatchNo}</p>
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                                          {orders.find(o => o.id === (entry as any).orderId)?.orderNo || 'No Order'}
                                        </p>
                                      </td>
                                      <td className="px-8 py-5 text-sm font-bold text-slate-600">{entry.subBundleNo}</td>
                                      <td className="px-8 py-5 text-sm font-bold text-slate-600">{entry.pcsCut}</td>
                                      <td className="px-8 py-5 text-sm font-black text-slate-900 font-mono">{entry.weight} Kg</td>
                                      <td className="px-8 py-5 text-sm text-slate-400 font-bold">{new Date(entry.date).toLocaleDateString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'centering' && (
                        <div className="space-y-10">
                          <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                            <div className="p-3 bg-purple-50 rounded-2xl">
                              <Target className="w-8 h-8 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Centering Process</h3>
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Hole creation and centering</p>
                            </div>
                          </div>
                          
                          <button className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-500/30 active:scale-95 transition-all">
                            <RefreshCw className="w-4 h-4" />
                            Fetch Centering Queue
                          </button>

                          <div className="overflow-hidden rounded-[2rem] border border-slate-100 shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub Bundle No</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pcs</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight (Kg)</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {bandSawEntries.filter(e => e.status === 'cut').map((entry) => (
                                  <tr key={entry.id} className="hover:bg-purple-50/30 transition-colors">
                                    <td className="px-8 py-5 text-sm font-black text-slate-900">{entry.subBundleNo}</td>
                                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{entry.pcsCut}</td>
                                    <td className="px-8 py-5 text-sm font-black text-slate-900 font-mono">{entry.weight}</td>
                                    <td className="px-8 py-5">
                                      <button 
                                        onClick={() => updateStatus(entry.id, 'centered')}
                                        className="px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                                      >
                                        Mark Complete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {activeTab === 'charging' && (
                        <div className="space-y-10">
                          <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                            <div className="p-3 bg-orange-50 rounded-2xl">
                              <Flame className="w-8 h-8 text-orange-600" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Charging Process</h3>
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Furnace charging and heating</p>
                            </div>
                          </div>
                          
                          <button className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-500/30 active:scale-95 transition-all">
                            <RefreshCw className="w-4 h-4" />
                            Fetch Charging Queue
                          </button>

                          <div className="overflow-hidden rounded-[2rem] border border-slate-100 shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub Bundle No</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pcs</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight (Kg)</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hot_Out_Pcs</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {bandSawEntries.filter(e => e.status === 'centered').map((entry) => (
                                  <tr key={entry.id} className="hover:bg-orange-50/30 transition-colors">
                                    <td className="px-8 py-5 text-sm font-black text-slate-900">{entry.subBundleNo}</td>
                                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{entry.pcsCut}</td>
                                    <td className="px-8 py-5 text-sm font-black text-slate-900 font-mono">{entry.weight}</td>
                                    <td className="px-8 py-5">
                                      <button 
                                        onClick={() => updateStatus(entry.id, 'charging')}
                                        className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                                      >
                                        Charge
                                      </button>
                                    </td>
                                    <td className="px-8 py-5">
                                      <button 
                                        onClick={() => updateStatus(entry.id, 'hrm-hot-out')}
                                        className="px-4 py-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
                                      >
                                        Hot Out
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {activeTab === 'hrm' && (
                        <div className="space-y-10">
                          <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                            <div className="p-3 bg-indigo-50 rounded-2xl">
                              <Settings className="w-8 h-8 text-indigo-600" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-black text-slate-900 tracking-tight">HRM Rolling</h3>
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Hot rolling material process</p>
                            </div>
                          </div>
                          
                          <button className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-500/30 active:scale-95 transition-all">
                            <RefreshCw className="w-4 h-4" />
                            Fetch HRM Queue
                          </button>

                          <div className="overflow-hidden rounded-[2rem] border border-slate-100 shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub Bundle No</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pcs</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {bandSawEntries.filter(e => e.status === 'charging').map((entry) => (
                                  <tr key={entry.id} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-8 py-5 text-sm font-black text-slate-900">{entry.subBundleNo}</td>
                                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{entry.pcsCut}</td>
                                    <td className="px-8 py-5 text-sm font-black text-slate-900 font-mono">{entry.weight}</td>
                                    <td className="px-8 py-5">
                                      <button 
                                        onClick={() => handleInspect(entry)}
                                        className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-cyan-700 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"
                                      >
                                        <Search className="w-3 h-3" />
                                        Inspect
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {activeTab === 'hrm-hot-out' && (
                        <div className="space-y-10">
                          <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                            <div className="p-3 bg-red-50 rounded-2xl">
                              <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-black text-slate-900 tracking-tight">HRM Hot Out</h3>
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Hot out material inspection</p>
                            </div>
                          </div>
                          
                          <button className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-500/30 active:scale-95 transition-all">
                            <RefreshCw className="w-4 h-4" />
                            Fetch Hot Out Queue
                          </button>

                          <div className="overflow-hidden rounded-[2rem] border border-slate-100 shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub Bundle No</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pcs</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight</th>
                                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {bandSawEntries.filter(e => e.status === 'hrm-hot-out').map((entry) => (
                                  <tr key={entry.id} className="hover:bg-red-50/30 transition-colors">
                                    <td className="px-8 py-5 text-sm font-black text-slate-900">{entry.subBundleNo}</td>
                                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{entry.pcsCut}</td>
                                    <td className="px-8 py-5 text-sm font-black text-slate-900 font-mono">{entry.weight}</td>
                                    <td className="px-8 py-5">
                                      <button 
                                        onClick={() => handleInspect(entry)}
                                        className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-cyan-700 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"
                                      >
                                        <Search className="w-3 h-3" />
                                        Inspect
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {activeTab === 'costing-report' && (
                        <div className="space-y-12">
                          <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-8">
                            <div className="p-3 bg-blue-50 rounded-2xl">
                              <FileText className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Production Report</h3>
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Daily costing and production summary</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Date:</label>
                              <input 
                                type="date" 
                                value={reportData.date}
                                onChange={(e) => setReportData({ ...reportData, date: e.target.value })}
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift:</label>
                              <select 
                                value={reportData.shift}
                                onChange={(e) => setReportData({ ...reportData, shift: e.target.value })}
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                              >
                                <option value="">Select Shift</option>
                                <option value="Day">Day Shift</option>
                                <option value="Night">Night Shift</option>
                              </select>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                            <p className="text-indigo-200 font-black text-[10px] uppercase tracking-[0.3em] mb-2">Total Production Weight</p>
                            <div className="flex items-center gap-4">
                              <input 
                                type="number"
                                value={reportData.productionKg}
                                onChange={(e) => setReportData({ ...reportData, productionKg: Number(e.target.value) })}
                                className="bg-transparent text-white font-black text-5xl tracking-tighter outline-none w-48 border-b-2 border-white/20 focus:border-white/50 transition-all"
                              />
                              <span className="text-xl font-medium text-white opacity-50">Kg</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                              { label: 'Water (Tankers)', key: 'waterTankers' },
                              { label: 'LPG (Kg)', key: 'lpgKg' },
                              { label: 'Electricity (Units)', key: 'electricityUnits' },
                              { label: 'Mandrill Ø59 (pcs)', key: 'mandrill59' },
                              { label: 'Mandrill Ø51 (pcs)', key: 'mandrill51' },
                              { label: 'Guide Ø76 (pcs)', key: 'guide76' },
                              { label: 'Mandrill Ø63 (pcs)', key: 'mandrill63' },
                              { label: 'Guide Ø90 (pcs)', key: 'guide90' },
                              { label: 'Guide Ø66 (pcs)', key: 'guide66' },
                              { label: 'Mandrill Ø42 (pcs)', key: 'mandrill42' },
                              { label: 'Guide Ø50 (pcs)', key: 'guide50' }
                            ].map((field) => (
                              <div key={field.key} className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.label}:</label>
                                <input 
                                  type="number" 
                                  value={(reportData as any)[field.key]}
                                  onChange={(e) => setReportData({ ...reportData, [field.key]: Number(e.target.value) })}
                                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold transition-all" 
                                />
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-wrap gap-6 pt-8">
                            <button 
                              onClick={handleReportSubmit}
                              className="flex items-center justify-center gap-3 px-12 py-5 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all"
                            >
                              Submit Report
                            </button>
                            <button 
                              onClick={handleWhatsAppShare}
                              className="flex items-center justify-center gap-3 px-12 py-5 bg-emerald-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-emerald-500/30 hover:bg-emerald-700 active:scale-95 transition-all"
                            >
                              Share via WhatsApp
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
    </ErrorBoundary>
  );
}
