import { useState } from "react";
import TableScrollModal from "../../modals/TableScrollModal";
import { Badge, Card } from "../../UI";

const PaymentHistoryCard = ({ customerPayments }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const totalPages = Math.max(1, Math.ceil((customerPayments?.length || 0) / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const pagedPayments = (customerPayments || []).slice(startIndex, startIndex + rowsPerPage);

    return (
        <Card title="Payment Ledger History" className="rounded-[2.5rem] border-none shadow-sm overflow-hidden">
                     <div className="max-h-[420px] overflow-y-auto overflow-x-auto -mx-6 -mt-4">
                       <table className="w-full text-sm">
                         <thead className="text-left text-gray-400 uppercase text-[10px] tracking-widest bg-gray-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
                           <tr>
                             <th className="py-4 px-6">Date</th>
                             <th className="py-4 px-6">M-Pesa Code</th>
                             <th className="py-4 px-6">Description</th>
                             <th className="py-4 px-6">Amount</th>
                             <th className="py-4 px-6">Phone</th>
                             <th className="py-4 px-6 text-right">Status</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y dark:divide-slate-800">
                            {pagedPayments.length > 0 ? pagedPayments.map(p => (
                              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="py-4 px-6 text-xs text-gray-500 font-medium">{new Date(p.timestamp).toLocaleString()}</td>
                                <td className="py-4 px-6 font-mono font-black text-gray-900 dark:text-white tracking-widest">{p.mpesaCode}</td>
                                <td className="py-4 px-6 text-xs text-gray-400">{p.billRef}</td>
                                <td className="py-4 px-6 font-black text-emerald-600">KSH {p.amount.toLocaleString()}</td>
                                <td className="py-4 px-6 font-mono text-gray-700 dark:text-gray-300">{p.phone}</td>
                                <td className="py-4 px-6 text-right"><Badge variant={p.status}>{p.status.toUpperCase()}</Badge></td>
                              </tr>
                            )) : (
                              <tr><td colSpan={6} className="py-12 text-center text-gray-400 italic">No transaction history found for this subscriber.</td></tr>
                            )}
                         </tbody>
                       </table>
                      </div>
                       <TableScrollModal
                          currentPage={currentPage}
                          setCurrentPage={setCurrentPage}
                          totalPages={totalPages}
                          rowsPerPage={rowsPerPage}
                          setRowsPerPage={setRowsPerPage}
                        />
        </Card>
    );
}

export default PaymentHistoryCard;
    