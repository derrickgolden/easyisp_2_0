const Footer: React.FC = () => (
    <footer className="mt-auto border-t border-gray-300 dark:border-slate-800/60 pt-12">
        <div className="flex w-full items-center justify-between gap-6 px-2">
            <div className="flex flex-col w-full items-center justify-center space-y-2">
                <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 bg-white rounded flex items-center justify-center text-[10px] font-black text-white">
                        <img src="/EasyTech.svg" alt="Logo" className="" />
                    </div>
                    <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight">
                        Easy Tech <span className="text-gray-400 font-medium">Cloud</span>
                    </span>
                </div>
                <p className="text-[10px] text-center text-gray-500 font-medium uppercase tracking-widest">
                    © {new Date().getFullYear()} Enterprise ISP Management System. <br className="lg:hidden"/> All rights reserved.
                </p>
            </div>
        </div>
    </footer>
);

export default Footer;