import React from 'react';
import { Package, ClipboardList, Target, Flame, Settings, CheckCircle, LucideIcon } from 'lucide-react';

interface StatProps {
  label: string;
  value: string;
  unit: string;
  Icon: LucideIcon;
  color: string;
}

const StatCard = ({ label, value, unit, Icon, color }: StatProps) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-black/5 flex items-center gap-4">
    <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-400 font-medium">{unit}</span>
      </div>
    </div>
  </div>
);

export const DashboardStats = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <StatCard label="Raw Material" value="906" unit="Kg" Icon={Package} color="bg-blue-500" />
      <StatCard label="WIP" value="294857" unit="Kg" Icon={ClipboardList} color="bg-gray-500" />
      <StatCard label="Centered" value="984" unit="Kg" Icon={Target} color="bg-purple-500" />
      <StatCard label="Charging" value="2410" unit="Kg" Icon={Flame} color="bg-orange-500" />
      <StatCard label="HRM" value="12140" unit="Kg" Icon={Settings} color="bg-indigo-500" />
      <StatCard label="Inspected Pcs" value="44488" unit="Pcs" Icon={CheckCircle} color="bg-emerald-500" />
    </div>
  );
};
