import React, { useState, useEffect } from 'react';
import { ApplicantData, InterviewReport } from '../types';

interface AdminPortalProps {
  onLogout: () => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout }) => {
  const [reports, setReports] = useState<(InterviewReport & { applicant: ApplicantData })[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    // Load data from localStorage
    const savedReports = localStorage.getItem('interview_reports');
    const savedApplicants = localStorage.getItem('applicants');

    if (savedReports && savedApplicants) {
        const parsedReports: InterviewReport[] = JSON.parse(savedReports);
        const parsedApplicants: ApplicantData[] = JSON.parse(savedApplicants);

        // Join data
        const joined = parsedReports.map(r => {
            const app = parsedApplicants.find(a => a.id === r.applicantId);
            return app ? { ...r, applicant: app } : null;
        }).filter(Boolean) as (InterviewReport & { applicant: ApplicantData })[];

        setReports(joined.reverse()); // Newest first
    }
  }, []);

  const selectedReport = reports.find(r => r.applicantId === selectedReportId);

  return (
    <div className="h-screen overflow-hidden bg-gray-900 text-white flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
        <div className="p-6 border-b border-gray-700">
            <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                Eburon Admin
            </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {reports.length === 0 ? (
                <div className="p-6 text-gray-500 text-sm">No interviews recorded yet.</div>
            ) : (
                reports.map(report => (
                    <button 
                        key={report.applicantId}
                        onClick={() => setSelectedReportId(report.applicantId)}
                        className={`w-full text-left p-4 border-b border-gray-700 hover:bg-gray-700 transition-colors ${selectedReportId === report.applicantId ? 'bg-gray-700 border-l-4 border-l-emerald-500' : ''}`}
                    >
                        <div className="font-semibold text-white">{report.applicant.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{report.applicant.role}</div>
                        <div className="flex justify-between items-center mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                                report.recommendation === 'HIRE' ? 'bg-emerald-500/20 text-emerald-300' :
                                report.recommendation === 'PASS' ? 'bg-red-500/20 text-red-300' :
                                'bg-yellow-500/20 text-yellow-300'
                            }`}>
                                {report.recommendation}
                            </span>
                            <span className="text-xs text-gray-500">
                                {new Date(report.applicant.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                    </button>
                ))
            )}
        </div>

        <div className="p-4 border-t border-gray-700">
            <button 
                onClick={onLogout}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
            >
                Log Out
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-900 overflow-y-auto p-8 h-full">
        {selectedReport ? (
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-white">{selectedReport.applicant.name}</h2>
                        <p className="text-xl text-gray-400">{selectedReport.applicant.role}</p>
                        <p className="text-sm text-gray-500 mt-1">{selectedReport.applicant.email}</p>
                    </div>
                    <div className="text-center bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div className="text-sm text-gray-400 uppercase tracking-wider mb-1">Fit Score</div>
                        <div className={`text-4xl font-bold ${
                            selectedReport.score >= 80 ? 'text-emerald-400' :
                            selectedReport.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                            {selectedReport.score}/100
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        AI Executive Summary
                    </h3>
                    <p className="text-gray-300 leading-relaxed">
                        {selectedReport.summary}
                    </p>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                             <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             Key Strengths
                        </h3>
                        <ul className="space-y-2">
                            {selectedReport.strengths.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Areas for Concern
                        </h3>
                        <ul className="space-y-2">
                            {selectedReport.weaknesses.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Transcript */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                     <h3 className="text-lg font-bold text-white mb-4">Transcript Excerpt</h3>
                     <div className="max-h-64 overflow-y-auto space-y-4 bg-gray-900/50 p-4 rounded-lg">
                        {selectedReport.transcript.length > 0 ? selectedReport.transcript.map((t, i) => (
                            <div key={i} className={`flex ${t.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                                    t.role === 'model' 
                                    ? 'bg-gray-700 text-white rounded-tl-none' 
                                    : 'bg-indigo-600 text-white rounded-tr-none'
                                }`}>
                                    <div className="text-xs opacity-50 mb-1">{t.role === 'model' ? 'Beatrice' : 'Candidate'}</div>
                                    {t.text}
                                </div>
                            </div>
                        )) : (
                            <div className="text-gray-500 italic">No transcript available.</div>
                        )}
                     </div>
                </div>

            </div>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                <p>Select an applicant from the sidebar to view their full AI report.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminPortal;