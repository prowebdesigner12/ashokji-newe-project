import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Camera
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
  getDocFromServer
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { DashboardStats } from './components/DashboardStats';
import { BandSawEntry, ProcessStatus, Batch } from './types';

const TABS = [
  { id: 'band-saw', label: 'Band Saw', icon: <Scissors className="w-4 h-4" /> },
  { id: 'centering', label: 'Centering', icon: <Target className="w-4 h-4" /> },
  { id: 'charging', label: 'Charging', icon: <Flame className="w-4 h-4" /> },
  { id: 'hrm', label: 'HRM', icon: <Settings className="w-4 h-4" /> },
  { id: 'hrm-hot-out', label: 'HRM-HOT-OUT', icon: <AlertCircle className="w-4 h-4" /> },
  { id: 'costing-report', label: 'COSTING REPORT', icon: <FileText className="w-4 h-4" /> },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('band-saw');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [bandSawEntries, setBandSawEntries] = useState<BandSawEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Inspection State
  const [inspectingBundle, setInspectingBundle] = useState<BandSawEntry | null>(null);
  const [inspectionData, setInspectionData] = useState<any[]>([]);

  // Band Saw Form State
  const [bandSawForm, setBandSawForm] = useState({
    masterBatchNo: '',
    subBundleNo: '',
    cutLength: '',
    pcsCut: '',
    weight: '',
    endCutWeight: '0',
  });

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
        // Skip logging for other errors, as this is simply a connection test.
      }
    };
    testConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    // Fetch Batches
    const qBatches = query(collection(db, 'batches'));
    const unsubscribeBatches = onSnapshot(qBatches, (snapshot) => {
      const batchData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Batch));
      setBatches(batchData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'batches');
    });

    // Fetch Band Saw Entries
    const qEntries = query(collection(db, 'bandSawEntries'));
    const unsubscribeEntries = onSnapshot(qEntries, (snapshot) => {
      const entryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BandSawEntry));
      setBandSawEntries(entryData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bandSawEntries');
    });

    return () => {
      unsubscribeBatches();
      unsubscribeEntries();
    };
  }, [isAuthReady]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleSaveBandSaw = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'bandSawEntries';
    try {
      await addDoc(collection(db, path), {
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
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateStatus = async (id: string, newStatus: ProcessStatus) => {
    const path = `bandSawEntries/${id}`;
    try {
      await updateDoc(doc(db, 'bandSawEntries', id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
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
      handleFirestoreError(error, OperationType.WRITE, 'inspections/bandSawEntries');
    }
  };

  const handleInspectionChange = (index: number, field: string, value: string) => {
    const newData = [...inspectionData];
    newData[index][field] = value;
    setInspectionData(newData);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">Initializing system...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-black/5 p-8 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl shadow-lg shadow-blue-500/20">JJ</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 uppercase tracking-tight">JAY JAGDAMBA LIMITED</h2>
          <p className="text-gray-500 mb-8 font-medium">Please sign in to access the HRM Material Tracking System</p>
          <button
            onClick={handleLogin}
            className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">JJ</div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight uppercase">JAY JAGDAMBA LIMITED</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-xl font-medium text-gray-700">HRM Material Tracking System</h2>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <DashboardStats />

        {/* Tabs Navigation */}
        <div className="flex flex-wrap gap-1 mb-6 bg-white p-1.5 rounded-2xl shadow-sm border border-black/5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setInspectingBundle(null);
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden min-h-[600px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (inspectingBundle ? '-inspecting' : '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-8"
            >
              {inspectingBundle ? (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setInspectingBundle(null)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Inspection Entry</h3>
                        <p className="text-sm text-gray-500">Sub Bundle: {inspectingBundle.subBundleNo}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-widest w-20">Pcs No</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">OD (mm)</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Thickness (mm)</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Length (mm)</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Surface</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-widest">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {inspectionData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.pcsNo}</td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                value={row.od}
                                onChange={(e) => handleInspectionChange(idx, 'od', e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" 
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                value={row.thickness}
                                onChange={(e) => handleInspectionChange(idx, 'thickness', e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" 
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                value={row.length}
                                onChange={(e) => handleInspectionChange(idx, 'length', e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" 
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                value={row.surface}
                                onChange={(e) => handleInspectionChange(idx, 'surface', e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" 
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                value={row.remarks}
                                onChange={(e) => handleInspectionChange(idx, 'remarks', e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" 
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
                    {['Hot Out PCS', 'Finish PCS', 'Rework PCS', 'Rejected PCS'].map((label) => (
                      <div key={label} className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}:</label>
                        <input type="number" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Remarks:</label>
                      <textarea className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[100px]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Upload Photo:</label>
                      <div className="w-full px-4 py-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center min-h-[100px] cursor-pointer hover:bg-gray-100 transition-all">
                        <Camera className="w-6 h-6 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-500 font-medium">Choose file or drag here</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveInspection}
                    className="flex items-center gap-2 px-10 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save All
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'band-saw' && (
                    <div className="space-y-10">
                      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Scissors className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Band Saw Cutting</h3>
                      </div>

                      <form onSubmit={handleSaveBandSaw} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Master Batch:</label>
                          <select 
                            required
                            value={bandSawForm.masterBatchNo}
                            onChange={(e) => setBandSawForm({...bandSawForm, masterBatchNo: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none cursor-pointer"
                          >
                            <option value="">-- Select Batch --</option>
                            <option value="BB25A3833 (304L)">BB25A3833 (304L)</option>
                            <option value="BB25A3834 (304L)">BB25A3834 (304L)</option>
                            <option value="BB25A3416 (304L)">BB25A3416 (304L)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sub Bundle Assigned:</label>
                          <input 
                            required
                            type="text"
                            value={bandSawForm.subBundleNo}
                            onChange={(e) => setBandSawForm({...bandSawForm, subBundleNo: e.target.value})}
                            placeholder="Enter Sub Bundle No"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cut Length (mm):</label>
                          <input 
                            required
                            type="number"
                            value={bandSawForm.cutLength}
                            onChange={(e) => setBandSawForm({...bandSawForm, cutLength: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pcs Cut:</label>
                          <input 
                            required
                            type="number"
                            value={bandSawForm.pcsCut}
                            onChange={(e) => setBandSawForm({...bandSawForm, pcsCut: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Weight (Kg):</label>
                          <input 
                            required
                            type="number"
                            value={bandSawForm.weight}
                            onChange={(e) => setBandSawForm({...bandSawForm, weight: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">End Cut Weight (Kg):</label>
                          <input 
                            type="number"
                            value={bandSawForm.endCutWeight}
                            onChange={(e) => setBandSawForm({...bandSawForm, endCutWeight: e.target.value})}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                          />
                        </div>

                        <div className="lg:col-span-3 flex flex-wrap gap-4 pt-6">
                          <button type="submit" className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95">
                            <Save className="w-5 h-5" />
                            Save Cut Details
                          </button>
                          <button type="button" className="flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all active:scale-95">
                            <RefreshCw className="w-5 h-5" />
                            Refresh Band Saw
                          </button>
                          <button type="button" className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95">
                            <QrCode className="w-5 h-5" />
                            Generate QR
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setBandSawForm({ masterBatchNo: '', subBundleNo: '', cutLength: '', pcsCut: '', weight: '', endCutWeight: '0' })}
                            className="flex items-center gap-2 px-8 py-3.5 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all active:scale-95"
                          >
                            <Trash2 className="w-5 h-5" />
                            Clear Form
                          </button>
                        </div>
                      </form>

                      <div className="mt-16">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Band Saw Entries:</h4>
                          <div className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100">
                            {bandSawEntries.filter(e => e.status === 'cut').length} Entries Found
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Master Batch No</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Sub Bundle No</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Cut Length</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Pcs Cut</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Weight</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">End Cut Weight</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {bandSawEntries.filter(e => e.status === 'cut').map((entry) => (
                                <tr key={entry.id} className="hover:bg-blue-50/30 transition-colors group">
                                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{entry.masterBatchNo}</td>
                                  <td className="px-6 py-4 text-sm text-gray-600">{entry.subBundleNo}</td>
                                  <td className="px-6 py-4 text-sm text-gray-600">{entry.cutLength}</td>
                                  <td className="px-6 py-4 text-sm text-gray-600">{entry.pcsCut}</td>
                                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{entry.weight} Kg</td>
                                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{entry.endCutWeight} Kg</td>
                                  <td className="px-6 py-4 text-sm text-gray-400 font-medium">{new Date(entry.date).toLocaleDateString()}</td>
                                </tr>
                              ))}
                              {bandSawEntries.filter(e => e.status === 'cut').length === 0 && (
                                <tr>
                                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">No entries found. Start by adding a new cut detail.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'centering' && (
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <Target className="w-6 h-6 text-purple-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Centering Process</h3>
                      </div>
                      
                      <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                        <RefreshCw className="w-4 h-4" />
                        Fetch Centering
                      </button>

                      <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Sub Bundle No</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Pcs</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Weight (Kg)</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bandSawEntries.filter(e => e.status === 'cut').map((entry) => (
                              <tr key={entry.id} className="hover:bg-purple-50/30 transition-colors">
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{entry.subBundleNo}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{entry.pcsCut}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 font-mono">{entry.weight}</td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={() => updateStatus(entry.id, 'centered')}
                                    className="px-6 py-2 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                  >
                                    Mark Complete
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {bandSawEntries.filter(e => e.status === 'cut').length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No bundles waiting for centering.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'charging' && (
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                        <div className="p-2 bg-orange-50 rounded-lg">
                          <Flame className="w-6 h-6 text-orange-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Charging Process</h3>
                      </div>
                      
                      <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                        <RefreshCw className="w-4 h-4" />
                        Fetch Charging
                      </button>

                      <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Sub Bundle No</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Pcs</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Weight (Kg)</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Action</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Hot_Out_Pcs</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bandSawEntries.filter(e => e.status === 'centered').map((entry) => (
                              <tr key={entry.id} className="hover:bg-orange-50/30 transition-colors">
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{entry.subBundleNo}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{entry.pcsCut}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 font-mono">{entry.weight}</td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={() => updateStatus(entry.id, 'charging')}
                                    className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                  >
                                    Mark Complete (Charging)
                                  </button>
                                </td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={() => updateStatus(entry.id, 'hrm-hot-out')}
                                    className="px-4 py-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                                  >
                                    Mark Complete (Hot_out)
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {bandSawEntries.filter(e => e.status === 'centered').length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No bundles waiting for charging.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'hrm' && (
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <Settings className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">HRM Rolling Process</h3>
                      </div>
                      
                      <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                        <RefreshCw className="w-4 h-4" />
                        Fetch HRM Bundles
                      </button>

                      <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Sub Bundle No</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Pcs</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Weight</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bandSawEntries.filter(e => e.status === 'charging').map((entry) => (
                              <tr key={entry.id} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{entry.subBundleNo}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{entry.pcsCut}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 font-mono">{entry.weight}</td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={() => handleInspect(entry)}
                                    className="flex items-center gap-2 px-6 py-2 bg-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-cyan-600 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                                  >
                                    <Search className="w-3 h-3" />
                                    Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {bandSawEntries.filter(e => e.status === 'charging').length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No bundles waiting for HRM rolling.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'hrm-hot-out' && (
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                        <div className="p-2 bg-red-50 rounded-lg">
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">HRM Hot Out Inspection</h3>
                      </div>
                      
                      <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                        <RefreshCw className="w-4 h-4" />
                        Fetch Hot Out Bundles
                      </button>

                      <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Sub Bundle No</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Pcs</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Weight</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bandSawEntries.filter(e => e.status === 'hrm-hot-out').map((entry) => (
                              <tr key={entry.id} className="hover:bg-red-50/30 transition-colors">
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{entry.subBundleNo}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{entry.pcsCut}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 font-mono">{entry.weight}</td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={() => handleInspect(entry)}
                                    className="flex items-center gap-2 px-6 py-2 bg-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-cyan-600 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                                  >
                                    <Search className="w-3 h-3" />
                                    Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {bandSawEntries.filter(e => e.status === 'hrm-hot-out').length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No hot-out bundles found.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'costing-report' && (
                    <div className="space-y-10">
                      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Production Report</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">From Date:</label>
                          <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">To Date:</label>
                          <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10" />
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-3xl shadow-xl shadow-blue-500/20">
                        <p className="text-blue-100 font-bold text-sm uppercase tracking-widest mb-1">Total Production Weight</p>
                        <p className="text-white font-black text-4xl">0 <span className="text-xl font-medium opacity-70">Kg</span></p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                          { label: 'Shift', placeholder: 'Enter Shift' },
                          { label: 'Production (Kg)', placeholder: '0.00' },
                          { label: 'Water (Tankers)', placeholder: '0' },
                          { label: 'LPG (Kg)', placeholder: '0.00' },
                          { label: 'Electricity (Units)', placeholder: '0' },
                          { label: 'Mandrill Ø59 (pcs)', placeholder: '0' },
                          { label: 'Mandrill Ø51 (pcs)', placeholder: '0' },
                          { label: 'Guide Ø76 (pcs)', placeholder: '0' },
                          { label: 'Mandrill Ø63 (pcs)', placeholder: '0' },
                          { label: 'Guide Ø90 (pcs)', placeholder: '0' },
                          { label: 'Guide Ø66 (pcs)', placeholder: '0' },
                          { label: 'Mandrill Ø42 (pcs)', placeholder: '0' },
                          { label: 'Guide Ø50 (pcs)', placeholder: '0' }
                        ].map((field) => (
                          <div key={field.label} className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{field.label}:</label>
                            <input 
                              type="text" 
                              placeholder={field.placeholder}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" 
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-4 pt-6">
                        <button className="flex items-center gap-2 px-10 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all">
                          Generate Report
                        </button>
                        <button className="flex items-center gap-2 px-10 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all">
                          Submit & Send WhatsApp
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
