import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Send
} from 'lucide-react';
import Layout from '../components/Layout';

interface TransactionItem {
  id: string;
  type: 'Telemedicine' | 'In clinic' | 'Insurance';
  sendDate: string;
  patientName: string;
  amount: string;
  recipient: string;
  dueDate: string;
  status: 'Requested' | 'Paid' | 'Sent';
}

const TRANSACTIONS: TransactionItem[] = [
  {
    id: 'tx-1',
    type: 'Telemedicine',
    sendDate: '12/12/26',
    patientName: 'Rachel Mayers',
    amount: '$ 345.65',
    recipient: '123456 American Family Insurance',
    dueDate: '12/12/26',
    status: 'Requested'
  },
  {
    id: 'tx-2',
    type: 'In clinic',
    sendDate: '12/12/26',
    patientName: 'Samantha Williams',
    amount: '$ 345.65',
    recipient: 'Samantha Williams',
    dueDate: '—',
    status: 'Paid'
  },
  {
    id: 'tx-3',
    type: 'Insurance',
    sendDate: '12/12/26',
    patientName: 'Amy White',
    amount: '$ 345.65',
    recipient: '123324 GEICO',
    dueDate: '12/12/26',
    status: 'Sent'
  },
  {
    id: 'tx-4',
    type: 'In clinic',
    sendDate: '12/12/26',
    patientName: 'Tyler Young',
    amount: '$ 345.65',
    recipient: '123456 American Family Insurance',
    dueDate: '—',
    status: 'Paid'
  },
  {
    id: 'tx-5',
    type: 'Telemedicine',
    sendDate: '12/12/26',
    patientName: 'Amy White',
    amount: '$ 345.65',
    recipient: '123324 GEICO',
    dueDate: '12/12/26',
    status: 'Paid'
  },
  {
    id: 'tx-6',
    type: 'Telemedicine',
    sendDate: '12/12/26',
    patientName: 'Rachel Mayers',
    amount: '$ 345.65',
    recipient: '123456 American Family Insurance',
    dueDate: '12/12/26',
    status: 'Requested'
  },
  {
    id: 'tx-7',
    type: 'Insurance',
    sendDate: '12/12/26',
    patientName: 'Rachel Mayers',
    amount: '$ 345.65',
    recipient: '123456 American Family Insurance',
    dueDate: '12/12/26',
    status: 'Paid'
  }
];

export default function Billing() {
  const [activeFilter, setActiveFilter] = useState<'All' | 'Telemedicine' | 'In clinic' | 'Insurance'>('All');
  const [requestedPatients, setRequestedPatients] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'This week' | 'This month' | 'Quarter'>('This week');

  const filteredTransactions = activeFilter === 'All'
    ? TRANSACTIONS
    : TRANSACTIONS.filter(t => t.type === activeFilter);

  const handleRequestPayment = (name: string) => {
    setRequestedPatients(prev => [...prev, name]);
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12">
        {/* Header section inspired by Reference 5 ("Your patients billing & invoices") */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#151719]">
              Your patients billing & invoices
            </h1>
            <p className="text-xs sm:text-sm text-[#575D65] mt-0.5">
              FHIR Account & Claim transactions, E/M coding attribution, and insurance claims.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-[#E8E5DC] text-[#151719] shadow-xs cursor-pointer focus:outline-none"
            >
              <option value="This week">This week</option>
              <option value="This month">This month</option>
              <option value="Quarter">Q4 2026</option>
            </select>
          </div>
        </div>

        {/* Top Analytics Row: Donut Ring & Metric Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Donut Ring Distribution (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-[#E8E5DC] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center relative">
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* SVG Donut Ring with soft pastel segments */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F4F2EC" strokeWidth="12" />
                {/* Yellow Segment (Non-insurance) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#FEF08A"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset="180"
                  strokeLinecap="round"
                />
                {/* Periwinkle Segment (Requested) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#BFDBFE"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset="130"
                  strokeLinecap="round"
                />
                {/* Pink Segment (Received) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#FCE7F3"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset="50"
                  strokeLinecap="round"
                />
              </svg>

              {/* Center Donut Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-extrabold tracking-tight text-[#151719] font-mono">
                  23,4k
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#88909A] mt-0.5">
                  Total Volume ($)
                </span>
              </div>
            </div>

            <div className="w-full mt-4 pt-4 border-t border-[#F0ECE1] flex items-center justify-around text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FCE7F3] border border-[#FBCFE8]" />
                <span className="text-[#575D65]">Received</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#BFDBFE] border border-[#93C5FD]" />
                <span className="text-[#575D65]">Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FEF08A] border border-[#FDE047]" />
                <span className="text-[#575D65]">Direct</span>
              </div>
            </div>
          </div>

          {/* Right: Pastel Metric Cards (8 cols) */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Payments Received (Blush Pink) */}
            <div className="bg-[#FCE7F3] rounded-3xl border border-[#FBCFE8] p-5 flex flex-col justify-between text-[#9D174D] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Payments received</span>
                <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold">
                  <TrendingUp className="w-3 h-3" />
                  <span>+13%</span>
                </div>
              </div>
              <div className="my-4">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">$ 14,568</div>
                <div className="text-[10px] opacity-80 mt-1">Total receipts value</div>
              </div>
              <div className="text-[10px] font-medium opacity-75">
                18 claims settled
              </div>
            </div>

            {/* Payments Requested (Serene Blue) */}
            <div className="bg-[#EFF6FF] rounded-3xl border border-[#BFDBFE] p-5 flex flex-col justify-between text-[#1E40AF] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Payments requested</span>
                <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold">
                  <TrendingDown className="w-3 h-3" />
                  <span>-6%</span>
                </div>
              </div>
              <div className="my-4">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">$ 6,234</div>
                <div className="text-[10px] opacity-80 mt-1">Total waiting payments value</div>
              </div>
              <div className="text-[10px] font-medium opacity-75">
                9 claims pending payer
              </div>
            </div>

            {/* Non insurance payments (Canary Yellow) */}
            <div className="bg-[#FEF08A] rounded-3xl border border-[#FDE047] p-5 flex flex-col justify-between text-[#854D0E] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Non insurance payments</span>
                <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold">
                  <TrendingDown className="w-3 h-3" />
                  <span>-17%</span>
                </div>
              </div>
              <div className="my-4">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">$ 3,786</div>
                <div className="text-[10px] opacity-80 mt-1">Total value of non covered</div>
              </div>
              <div className="text-[10px] font-medium opacity-75">
                HSA / Self-pay co-pays
              </div>
            </div>

          </div>

        </div>

        {/* Section: Waiting for bills */}
        <div>
          <h2 className="text-sm font-bold text-[#151719] uppercase tracking-wider mb-3">Waiting for bills</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Samantha Williams card */}
            <div className="bg-[#F9F8F5] rounded-3xl border border-[#E8E5DC] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E0E7FF] text-[#1E40AF] flex items-center justify-center font-bold text-xs">
                  SW
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#151719]">Samantha Williams</h4>
                  <p className="text-[11px] text-[#575D65]">12KL - Routine Check-Up</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-[#E0E7FF] text-[#1E40AF]">
                  09:15 AM
                </span>
                <button
                  type="button"
                  onClick={() => handleRequestPayment('Samantha Williams')}
                  disabled={requestedPatients.includes('Samantha Williams')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                    requestedPatients.includes('Samantha Williams')
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#151619] hover:bg-[#252830] text-white shadow-xs'
                  }`}
                >
                  {requestedPatients.includes('Samantha Williams') ? 'Requested' : 'Request payment'}
                </button>
              </div>
            </div>

            {/* Amy White card */}
            <div className="bg-[#F9F8F5] rounded-3xl border border-[#E8E5DC] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center font-bold text-xs">
                  AW
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#151719]">Amy White</h4>
                  <p className="text-[11px] text-[#575D65]">12OO - Video Consultation</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-[#FCE7F3] text-[#9D174D]">
                  09:45 AM
                </span>
                <button
                  type="button"
                  onClick={() => handleRequestPayment('Amy White')}
                  disabled={requestedPatients.includes('Amy White')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                    requestedPatients.includes('Amy White')
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#151619] hover:bg-[#252830] text-white shadow-xs'
                  }`}
                >
                  {requestedPatients.includes('Amy White') ? 'Requested' : 'Request payment'}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Section: Latest transaction cards */}
        <div>
          <h2 className="text-sm font-bold text-[#151719] uppercase tracking-wider mb-3">Latest transaction</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white rounded-2xl border border-[#E8E5DC] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#88909A]">121377 GEICO ****5684</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-[#DCFCE7] text-[#166534]">
                  + $ 568.56
                </span>
              </div>
              <p className="text-xs font-semibold text-[#151719]">324343 ProtonMed Claim</p>
              <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE1] text-[10px] text-[#88909A]">
                <span className="font-mono">#3586895</span>
                <span>15 min ago</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DC] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#88909A]">Wilkinson T. ****5684</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-[#DCFCE7] text-[#166534]">
                  + $ 465.4
                </span>
              </div>
              <p className="text-xs font-semibold text-[#151719]">24245 Dr. Olivia Consultation</p>
              <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE1] text-[10px] text-[#88909A]">
                <span className="font-mono">#1244657</span>
                <span>15 min ago</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5DC] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#88909A]">121377 GEICO ****5684</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-[#DCFCE7] text-[#166534]">
                  + $ 568.56
                </span>
              </div>
              <p className="text-xs font-semibold text-[#151719]">324343 ProtonMed Claim</p>
              <div className="flex items-center justify-between pt-2 border-t border-[#F0ECE1] text-[10px] text-[#88909A]">
                <span className="font-mono">#5476856</span>
                <span>15 min ago</span>
              </div>
            </div>

          </div>
        </div>

        {/* Master Transactions Ledger Table */}
        <div className="bg-white rounded-3xl border border-[#E8E5DC] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
          
          {/* Table Header Filter Tabs */}
          <div className="flex items-center gap-2 pb-2 border-b border-[#F0ECE1] overflow-x-auto">
            {(['All', 'Telemedicine', 'In clinic', 'Insurance'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFilter(tab)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  activeFilter === tab
                    ? 'bg-[#151619] text-white shadow-xs'
                    : 'text-[#575D65] hover:bg-[#F9F8F5]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DC] text-[#88909A] font-medium">
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Send date</th>
                  <th className="pb-3 font-semibold">Name</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Recipient</th>
                  <th className="pb-3 font-semibold">Due date</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE1]">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F9F8F5] transition-colors">
                    <td className="py-3 font-medium text-[#151719]">{tx.type}</td>
                    <td className="py-3 font-mono text-[#575D65]">{tx.sendDate}</td>
                    <td className="py-3 font-semibold text-[#151719]">{tx.patientName}</td>
                    <td className="py-3 font-mono font-bold text-[#151719]">{tx.amount}</td>
                    <td className="py-3 text-[#575D65] max-w-[200px] truncate">{tx.recipient}</td>
                    <td className="py-3 font-mono text-[#575D65]">{tx.dueDate}</td>
                    <td className="py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.status === 'Paid'
                          ? 'bg-[#FCE7F3] text-[#9D174D]'
                          : tx.status === 'Requested'
                          ? 'bg-[#E0E7FF] text-[#1E40AF]'
                          : 'bg-[#DCFCE7] text-[#166534]'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1 rounded text-[#88909A] hover:text-[#151719]" title="Download invoice">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1 rounded text-[#88909A] hover:text-[#151719]" title="Send reminder">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </Layout>
  );
}
