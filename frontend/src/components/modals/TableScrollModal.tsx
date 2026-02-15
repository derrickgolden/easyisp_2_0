const TableScrollModal: React.FC<{
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  rowsPerPage: number;
  setRowsPerPage: React.Dispatch<React.SetStateAction<number>>;
}> = ({ currentPage, setCurrentPage, totalPages, rowsPerPage, setRowsPerPage }) => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between 
          gap-4 mt-6 pt-6 border-t dark:border-slate-800">
          

          <div className="flex items-center gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-20 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

            <div className="flex items-center gap-1 px-4">
              <span className="text-sm font-bold text-gray-900 dark:text-white">Page {currentPage}</span>
              <span className="text-sm text-gray-400">of {totalPages || 1}</span>
            </div>

            <button 
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-20 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Show</span>
            <select 
              value={rowsPerPage} 
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-gray-100 dark:bg-slate-800 border-none rounded-lg text-xs font-black p-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 Rows</option>
              <option value={15}>15 Rows</option>
              <option value={25}>25 Rows</option>
            </select>
          </div>
        </div>
    );
};

export default TableScrollModal;