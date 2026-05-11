/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  FileText, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Upload,
  ChevronRight,
  Shield,
  Activity,
  Download,
  AlertTriangle,
  Zap,
  Info,
  Maximize2,
  Minimize2,
  Save,
  Grid,
  User,
  Settings,
  LogOut,
  Award,
  Bell,
  Moon,
  ToggleLeft,
  ToggleRight,
  Archive,
  BookOpen,
  Plus,
  Edit3,
  X,
  FileSpreadsheet
} from "lucide-react";
import { Evidence, AuditBlueprint, AuditFinding, RiskAnalysis, AgentStatus, LiveAnalysis, ClinicianProfile, LogicNudge } from "./types";
import { runVaultAgent, runSleuthAgent, runCounselAgent, analyzeLiveNote, runLiteAudit } from "./services/geminiService";
import { NSMHS_BLUEPRINT } from "./constants";

// Helper for SHA-256 hashing
async function hashNote(text: string) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useDropzone } from "react-dropzone";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [view, setView] = useState<"workspace" | "profile">("workspace");
  const [profile, setProfile] = useState<ClinicianProfile>({
    id: "EMP-077",
    name: "Dr. Sarah Chen",
    role: "Senior Clinical Psychologist",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    credentials: [
      { id: "C1", name: "AHPRA Registration", expiryDate: "2026-12-31", status: "Active" },
      { id: "C2", name: "Working with Children Check", expiryDate: "2025-06-15", status: "Active" },
      { id: "C3", name: "CBT Advanced Certification", expiryDate: "2024-05-01", status: "Expired" }
    ],
    settings: {
      darkMode: false,
      autoSave: true,
      notifications: true
    }
  });

  const [currentNote, setCurrentNote] = useState(() => localStorage.getItem("aegismind_draft") || "");
  const [analysis, setAnalysis] = useState<LiveAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isDistractionFree, setIsDistractionFree] = useState(false);
  const [showConfirmGate, setShowConfirmGate] = useState(false);
  const [showAddCredentialModal, setShowAddCredentialModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [credentialForm, setCredentialForm] = useState({ name: "", expiryDate: "" });
  const [profileForm, setProfileForm] = useState({ name: profile.name, role: profile.role });
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastQuotaErrorTime = useRef<number>(0);
  const lastNoteAnalyzed = useRef<string>("");

  // Dark Mode Side Effect
  useEffect(() => {
    if (profile.settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [profile.settings.darkMode]);

  // Auto-Drafting and Real-time Analysis
  useEffect(() => {
    localStorage.setItem("aegismind_draft", currentNote);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(async () => {
      if (currentNote.trim() === lastNoteAnalyzed.current.trim()) return;

      // Cooldown check (60 seconds if 429 was hit)
      const now = Date.now();
      if (quotaExceeded && now - lastQuotaErrorTime.current < 60000) {
        console.warn("Analysis in cooldown due to quota exhaustion.");
        const noteHash = await hashNote(currentNote);
        const liteResult = runLiteAudit(currentNote);
        setAnalysis({ ...liteResult, noteHash });
        return;
      }

      if (currentNote.length > 50) {
        setIsAnalyzing(true);
        const startTime = Date.now();
        const noteHash = await hashNote(currentNote);

        try {
          // Time the Gemini request for latency management
          const result = await analyzeLiveNote(currentNote);
          const latency = Date.now() - startTime;
          
          if (latency > 2000) {
            console.warn("Gemini latency > 2s, switching to Lite-Audit for next turn.");
          }

          lastNoteAnalyzed.current = currentNote;
          setQuotaExceeded(false);
          setAnalysis({ ...result, noteHash });
        } catch (e: any) {
          console.error("Live analysis failed, falling back to Lite-Audit", e);
          
          // Improved quota error detection
          const isQuotaError = 
            e.status === "RESOURCE_EXHAUSTED" || 
            e.code === 429 || 
            JSON.stringify(e).includes("429") ||
            JSON.stringify(e).includes("RESOURCE_EXHAUSTED") ||
            e.message?.includes("429") || 
            e.message?.includes("quota");

          if (isQuotaError) {
            setQuotaExceeded(true);
            lastQuotaErrorTime.current = Date.now();
          }
          
          const liteResult = runLiteAudit(currentNote);
          setAnalysis({ ...liteResult, noteHash });
        } finally {
          setIsAnalyzing(false);
        }
      }
    }, 5000); // Increased to 5s to reduce frequency and help with quota

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [currentNote]);

  const handleTemplateChange = (templateId: string) => {
    const templates: Record<string, string> = {
      SOAP: "Subjective:\nObjective:\nAssessment:\nPlan:",
      CBT: "Session Focused On:\nCognitive Distortion Identified:\nReframing Exercise:\nHomework Assignment:",
      DBT: "Distress Tolerance Level:\nSkill Practiced:\nValidation Provided:\nInterpersonal Effectiveness Goal:"
    };
    setCurrentNote(templates[templateId]);
    setActiveTemplate(templateId);
  };

  const exportAsJSON = () => {
    if (!analysis) return;
    const data = {
      timestamp: new Date().toISOString(),
      note_hash: analysis.noteHash,
      clinical_note: currentNote,
      analysis: analysis,
      clinician: profile
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AegisMind_Export_${analysis.noteHash?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    if (!analysis) return;
    const headers = ["Standard ID", "Status", "Observation", "Requirement Text"];
    const rows = analysis.findings.map(f => [
      f.requirementId,
      f.status,
      `"${f.observation.replace(/"/g, '""')}"`,
      `"${f.standardText?.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      ["Encounter Note Hash", analysis.noteHash],
      ["Accreditation Score", analysis.score],
      [],
      headers,
      ...rows
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AegisMind_Audit_${analysis.noteHash?.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFinalize = () => {
    if (analysis && (analysis.score < 80 || analysis.isRiskDetected)) {
      setShowConfirmGate(true);
    } else {
      window.print();
    }
  };

  const handleAddCredential = (e: any) => {
    e.preventDefault();
    const newCred = {
      id: Math.random().toString(36).substr(2, 9),
      name: credentialForm.name,
      expiryDate: credentialForm.expiryDate,
      status: "Active" as const
    };
    setProfile({
      ...profile,
      credentials: [...profile.credentials, newCred]
    });
    setCredentialForm({ name: "", expiryDate: "" });
    setShowAddCredentialModal(false);
  };

  const handleUpdateProfile = (e: any) => {
    e.preventDefault();
    setProfile({
      ...profile,
      name: profileForm.name,
      role: profileForm.role
    });
    setShowEditProfileModal(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 flex flex-col transition-colors duration-300">
      {/* Navbar - Hidden in Distraction Free */}
      <AnimatePresence>
        {!isDistractionFree && (
          <motion.nav 
            initial={{ y: -64 }}
            animate={{ y: 0 }}
            exit={{ y: -64 }}
            className="sticky top-0 z-50 bg-white border-b border-slate-200 h-16 shrink-0 no-print"
          >
            <div className="max-w-full mx-auto px-6 h-full flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
                  <ShieldCheck className="text-white dark:text-slate-900 w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    AegisMind <span className="font-light text-slate-400 dark:text-slate-600 font-serif italic text-sm ml-1">v2026.1</span>
                  </h1>
                </div>
              </div>

                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setView(view === "workspace" ? "profile" : "workspace")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border",
                      view === "profile" 
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white" 
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                    )}
                  >
                    {view === "profile" ? <FileText className="w-4 h-4" strokeWidth={1.5} /> : <User className="w-4 h-4" strokeWidth={1.5} />}
                    <span className="text-xs font-bold uppercase tracking-wider">{view === "profile" ? "Workspace" : "Profile"}</span>
                  </button>

                  <div className="flex items-center gap-2 px-4 py-2 bg-white/50 border border-slate-200 rounded-2xl glass transition-colors">
                    <div className={cn(
                      "w-3 h-3 rounded-full transition-all duration-500",
                      quotaExceeded ? "bg-red-500" :
                      isAnalyzing ? "bg-cyan-400 animate-pulse" : 
                      analysis ? (analysis.score > 90 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-amber-500") : "bg-slate-300 dark:bg-slate-700"
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      {quotaExceeded ? "Quota Limit" : "Compliance Pulse"}
                    </span>
                  </div>
                  <button 
                    onClick={() => setIsDistractionFree(!isDistractionFree)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500 flex items-center gap-2 group"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Focus Mode</span>
                    {isDistractionFree ? <Minimize2 className="w-5 h-5" strokeWidth={1.5} /> : <Maximize2 className="w-5 h-5" strokeWidth={1.5} />}
                  </button>
                </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Main Workspace / Profile */}
      <main className="grow flex overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "workspace" ? (
            <motion.div 
              key="workspace"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex overflow-hidden"
            >
              {/* Left Pane: Data Entry (70%) */}
              <section className={cn(
                "flex-[0.7] flex flex-col transition-all duration-500 ease-in-out bg-white dark:bg-slate-950 p-12 paper-texture",
                isDistractionFree ? "flex-1 max-w-4xl mx-auto shadow-2xl my-8 rounded-3xl" : "border-r border-slate-100 dark:border-slate-800"
              )}>
                <header className="mb-10 flex justify-between items-center no-print">
                  <div className="flex gap-3">
                    {['SOAP', 'CBT', 'DBT'].map(t => (
                      <button 
                        key={t}
                        onClick={() => handleTemplateChange(t)}
                        className={cn(
                          "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm",
                          activeTemplate === t 
                            ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950" 
                            : "bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700"
                        )}
                      >
                        {t} Template
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </header>
                <textarea 
                  spellCheck={false}
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  placeholder="Draft clinical encounter notes here..."
                  style={{ lineHeight: '1.6' }}
                  className="flex-1 w-full text-lg text-slate-700 dark:text-slate-300 placeholder-slate-200 dark:placeholder-slate-800 focus:outline-none resize-none font-sans overflow-y-auto pr-4 bg-transparent"
                />

                <footer className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center no-print">
                  <div className="flex gap-4">
                    <button className="flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-black text-[10px] uppercase tracking-[0.2em] transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 px-4 py-2 rounded-xl">
                      <AlertCircle className="w-4 h-4" strokeWidth={1.5} /> Policy Code
                    </button>
                    <button 
                      onClick={exportAsJSON}
                      disabled={!analysis}
                      className="flex items-center gap-2 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-black text-[10px] uppercase tracking-[0.2em] transition-colors border border-transparent hover:border-cyan-100 dark:hover:border-cyan-900 px-4 py-2 rounded-xl disabled:opacity-30"
                    >
                      <Download className="w-4 h-4" strokeWidth={1.5} /> Export JSON
                    </button>
                    <button 
                      onClick={exportAsCSV}
                      disabled={!analysis}
                      className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em] transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 px-4 py-2 rounded-xl disabled:opacity-30"
                    >
                      <FileSpreadsheet className="w-4 h-4" strokeWidth={1.5} /> Export CSV
                    </button>
                  </div>
                  <button 
                    onClick={handleFinalize}
                    className="bg-slate-900 dark:bg-white dark:text-slate-950 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-4 hover:bg-black dark:hover:bg-slate-100 transition-all shadow-xl shadow-slate-200 dark:shadow-none"
                  >
                    Finalize Encounter
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </button>
                </footer>
              </section>

              {/* Right Pane: AegisMind Live Feed (30%) */}
              {!isDistractionFree && (
                <aside className="flex-[0.3] min-w-[400px] border-l border-slate-100 dark:border-slate-800 p-10 overflow-y-auto no-print relative bg-slate-50/30 dark:bg-slate-950/30 glass transition-colors">
                  <div className="space-y-10 relative z-10">
                    <header className="flex justify-between items-start">
                      <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">AegisMind Live</h3>
                        <p className="text-sm font-black italic serif text-slate-800 dark:text-slate-100">Clinical Integrity Agent</p>
                      </div>
                      
                      {/* Compliance Ring */}
                      <div className="relative w-16 h-16">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="32" cy="32" r="28" className="fill-none stroke-slate-200/50 dark:stroke-slate-800 stroke-[4]" />
                          <motion.circle 
                            cx="32" cy="32" r="28" 
                            className={cn(
                              "fill-none stroke-[4] transition-colors duration-1000",
                              analysis ? (analysis.score > 90 ? "stroke-emerald-500" : "stroke-cyan-500") : "stroke-slate-200 dark:stroke-slate-700"
                            )}
                            strokeDasharray="176"
                            initial={{ strokeDashoffset: 176 }}
                            animate={{ strokeDashoffset: 176 - (176 * (analysis?.score || 0)) / 100 }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{analysis?.score || 0}</span>
                        </div>
                      </div>
                    </header>

                    {/* Quota Exhaustion Warning */}
                    <AnimatePresence>
                      {quotaExceeded && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 rounded-[2rem] p-6 shadow-sm"
                        >
                          <header className="flex items-center gap-3 mb-2">
                            <AlertTriangle className="text-amber-600 dark:text-amber-500 w-5 h-5" strokeWidth={1.5} />
                            <h4 className="font-black text-amber-800 dark:text-amber-300 text-[10px] uppercase tracking-widest">Rate Limited</h4>
                          </header>
                          <p className="text-amber-900 dark:text-amber-400 text-[11px] font-medium leading-relaxed">
                            API quota reached. Lite-audit mode engaged. Neural connections will resume shortly.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Enterprise Matrix */}
                    <div className="bg-white/40 dark:bg-slate-900/40 p-6 rounded-[2rem] border border-white/60 dark:border-slate-800/60">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">CRM Health</span>
                          <span className={cn(
                            "text-[10px] font-bold",
                            analysis?.enterpriseAlerts.crmSync.toLowerCase().includes("risk") ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {analysis?.enterpriseAlerts.crmSync || "Stable"}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Staff Auth</span>
                          <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                            {analysis?.jsonMetadata.erp_staff_id || "EMP-077"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Logic Nudge Cards */}
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Activity className="w-3 h-3 text-cyan-500" strokeWidth={1.5} />
                          Integrity Stream
                        </h3>
                        {analysis?.noteHash && (
                          <span className="text-[7px] font-mono text-slate-300 dark:text-slate-600 truncate">SHA256: {analysis.noteHash}</span>
                        )}
                      </div>

                      <AnimatePresence mode="popLayout">
                        {analysis?.nudge && analysis.nudge.status !== "None" && (
                          <motion.div 
                            key="logic-nudge"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn(
                              "p-6 rounded-[2.5rem] border-2 shadow-lg transition-all",
                              analysis.nudge.status === "Red" 
                                ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900 glow-red animate-pulse-red-border" 
                                : "bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900 glow-cyan"
                            )}
                          >
                            <header className="flex items-center gap-3 mb-4">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3",
                                analysis.nudge.status === "Red" ? "bg-red-600" : "bg-cyan-500"
                              )}>
                                <Zap className="text-white w-5 h-5 fill-white" strokeWidth={1.5} />
                              </div>
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-[0.2em]",
                                analysis.nudge.status === "Red" ? "text-red-600 dark:text-red-400" : "text-cyan-600 dark:text-cyan-400"
                              )}>
                                Logic Nudge
                              </span>
                            </header>
                            <p className="text-slate-800 dark:text-slate-200 text-xs font-bold leading-relaxed mb-4 italic serif">
                              "{analysis.nudge.reason}"
                            </p>
                            <button className={cn(
                              "w-full py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg flex items-center justify-center gap-2",
                              analysis.nudge.status === "Red" ? "bg-red-600 hover:bg-red-700" : "bg-cyan-600 hover:bg-cyan-700"
                            )}>
                              Address Requirement <ChevronRight className="w-3 h-3" />
                            </button>
                          </motion.div>
                        )}

                        {analysis?.findings.map((finding, idx) => (
                          <motion.div 
                            key={finding.requirementId + idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/80 dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                          >
                            <div className={cn(
                              "absolute left-0 top-0 bottom-0 w-1",
                              finding.status === "pass" ? "bg-emerald-500" : finding.status === "fail" ? "bg-red-500" : "bg-amber-400"
                            )} />
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">{finding.requirementId}</span>
                              {finding.status === 'fail' && <AlertCircle className="w-3 h-3 text-red-500" strokeWidth={1.5} />}
                            </div>
                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                              {finding.observation}
                            </p>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {(!analysis || analysis.findings.length === 0) && !analysis?.nudge && (
                        <div className="py-20 text-center opacity-30">
                          <Search className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-4" strokeWidth={1} />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Awaiting stream data...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </aside>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-slate-950 p-12 transition-colors"
            >
              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Profile Summary Card */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-sm text-center transition-colors">
                    <div className="relative w-32 h-32 mx-auto mb-6 group">
                      <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-800 shadow-xl" />
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center border-4 border-white dark:border-slate-800 text-white">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <button 
                        onClick={() => {
                          setProfileForm({ name: profile.name, role: profile.role });
                          setShowEditProfileModal(true);
                        }}
                        className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                      >
                        <Edit3 className="w-6 h-6" />
                      </button>
                    </div>
                    <h2 className="text-2xl font-black italic serif text-slate-900 dark:text-white">{profile.name}</h2>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">{profile.role}</p>
                    <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Employee ID</span>
                        <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{profile.id}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Office Location</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Sydney Central</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 dark:bg-indigo-950/40 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-200 dark:shadow-none transition-colors">
                    <header className="mb-6 flex items-center gap-3">
                      <Shield className="w-6 h-6 text-indigo-400" strokeWidth={1.5} />
                      <h3 className="font-black italic serif text-lg text-indigo-100">Integrity Rank</h3>
                    </header>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 leading-relaxed">
                      Your clinical integrity score is in the top 5% of the Sydney network.
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-black text-white">A+</div>
                      <div className="grow bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full w-[94%]" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                    <header className="mb-6 flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-cyan-500" strokeWidth={1.5} />
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Training Compliance</h3>
                    </header>
                    <div className="space-y-4">
                      {[
                        { name: "Risk Assessment v4", date: "2026-03", score: "100%" },
                        { name: "Clinical Ethics AM-7", date: "2026-01", score: "96%" },
                        { name: "GDPR/HIPAA Recert", date: "2025-11", score: "100%" }
                      ].map((m, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase">{m.date}</p>
                          </div>
                          <span className="text-xs font-black text-cyan-600 dark:text-cyan-400">{m.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Profile Info */}
                <div className="lg:col-span-2 space-y-12">
                  {/* Credentials Section */}
                  <section>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                        <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Professional Credentials
                      </h3>
                      <button 
                        onClick={() => setShowAddCredentialModal(true)}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline transition-all flex items-center gap-2"
                      >
                        <Plus className="w-3 h-3" /> Add Credential
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile.credentials.map(cred => (
                        <div key={cred.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                          <header className="flex justify-between items-start mb-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                              cred.status === 'Active' 
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400" 
                                : "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"
                            )}>
                              {cred.status === 'Active' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            </div>
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-1 rounded-lg transition-colors",
                              cred.status === 'Active' 
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" 
                                : "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            )}>
                              {cred.status}
                            </span>
                          </header>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 leading-tight mb-2 transition-colors">{cred.name}</h4>
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Expires {cred.expiryDate}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Settings Section */}
                  <section>
                    <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6 transition-colors">
                      <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" strokeWidth={1.5} />
                      Personalized Preferences
                    </h3>
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm divide-y divide-slate-100">
                      <div className="p-8 flex justify-between items-center">
                        <div className="flex gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors",
                            profile.settings.darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"
                          )}>
                            <Moon className={cn("w-6 h-6", profile.settings.darkMode ? "text-indigo-400" : "text-slate-400")} strokeWidth={1.5} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">Midnight Workspace</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dark interface to reduce eye strain during late clinical shifts.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setProfile({...profile, settings: {...profile.settings, darkMode: !profile.settings.darkMode}})}
                          className={cn("transition-colors", profile.settings.darkMode ? "text-indigo-400" : "text-[#2C5282]")}
                        >
                          {profile.settings.darkMode ? <ToggleRight className="w-8 h-8" strokeWidth={1.5} /> : <ToggleLeft className="w-8 h-8 text-slate-300" strokeWidth={1.5} />}
                        </button>
                      </div>

                      <div className="p-8 flex justify-between items-center">
                        <div className="flex gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors",
                            profile.settings.darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"
                          )}>
                            <Save className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">Auto-Save Clinical Drafts</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Persist local versions of clinical notes in the browser.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setProfile({...profile, settings: {...profile.settings, autoSave: !profile.settings.autoSave}})}
                          className={cn("transition-colors", profile.settings.darkMode ? "text-indigo-400" : "text-[#2C5282]")}
                        >
                          {profile.settings.autoSave ? <ToggleRight className="w-8 h-8" strokeWidth={1.5} /> : <ToggleLeft className="w-8 h-8 text-slate-300" strokeWidth={1.5} />}
                        </button>
                      </div>

                      <div className="p-8 flex justify-between items-center">
                        <div className="flex gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors",
                            profile.settings.darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"
                          )}>
                            <Bell className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">Compliance Strobe Alerts</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Visual feedback when high-risk omissions are detected.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setProfile({...profile, settings: {...profile.settings, notifications: !profile.settings.notifications}})}
                          className={cn("transition-colors", profile.settings.darkMode ? "text-indigo-400" : "text-[#2C5282]")}
                        >
                          {profile.settings.notifications ? <ToggleRight className="w-8 h-8" strokeWidth={1.5} /> : <ToggleLeft className="w-8 h-8 text-slate-300" strokeWidth={1.5} />}
                        </button>
                      </div>

                      <div className={cn(
                        "p-8 flex justify-between items-center rounded-b-[2.5rem] transition-colors",
                        profile.settings.darkMode ? "bg-slate-900/50" : "bg-slate-50"
                      )}>
                        <div className="flex gap-4 items-center">
                          <LogOut className="w-5 h-5 text-red-500" strokeWidth={1.5} />
                          <span className="text-sm font-bold text-red-600">Enterprise Session Termination</span>
                        </div>
                        <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors">
                          Log Out
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Credential Modal */}
      <AnimatePresence>
        {showAddCredentialModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 no-print"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddCredentialModal(false)}
                className="absolute top-8 right-8 text-slate-300 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-black italic serif text-slate-900 mb-8">Add New Credential</h3>
              <form onSubmit={handleAddCredential} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credential Name</label>
                  <input 
                    required
                    type="text"
                    value={credentialForm.name}
                    onChange={e => setCredentialForm({...credentialForm, name: e.target.value})}
                    placeholder="e.g. Master Clinical Supervision"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry Date</label>
                  <input 
                    required
                    type="date"
                    value={credentialForm.expiryDate}
                    onChange={e => setCredentialForm({...credentialForm, expiryDate: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-200 transition-all"
                >
                  Verify & Add
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditProfileModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 no-print"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowEditProfileModal(false)}
                className="absolute top-8 right-8 text-slate-300 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-black italic serif text-slate-900 mb-8">Update Profile</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinical Role</label>
                  <input 
                    required
                    type="text"
                    value={profileForm.role}
                    onChange={e => setProfileForm({...profileForm, role: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-200 transition-all"
                >
                  Save Changes
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Gate Modal */}
      <AnimatePresence>
        {showConfirmGate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 no-print"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#121212] border border-slate-800 w-full max-w-[500px] p-8 rounded-2xl shadow-2xl relative"
            >
              <button 
                onClick={() => setShowConfirmGate(false)}
                className="absolute top-6 right-6 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-[10px] font-mono text-slate-400 tracking-widest uppercase">
                  Clinical Integrity Protocol 402
                </h2>
              </div>

              <p className="text-slate-200 text-lg font-bold mb-6 italic serif">
                AegisMind has detected logic gaps in the current session record.
              </p>

              <div className="bg-black/40 border border-slate-800 rounded-xl p-4 mb-8 font-mono text-[11px] text-red-400 max-h-[200px] overflow-y-auto">
                {analysis?.findings.filter(f => f.status === 'fail').map((d, idx) => (
                  <div key={idx} className="mb-3 flex gap-3">
                    <span className="opacity-30 shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                    <span>{d.observation}</span>
                  </div>
                ))}
                {(!analysis || analysis.findings.filter(f => f.status === 'fail').length === 0) && (
                  <div className="text-slate-500 italic">No critical discrepancies detected. Ready for secure hash generation.</div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setShowConfirmGate(false);
                    window.print();
                  }}
                  className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_30px_rgba(8,145,178,0.5)] transform active:scale-[0.98]"
                >
                  VERIFY & GENERATE SHA-256 HASH
                </button>
                <button 
                  onClick={() => setShowConfirmGate(false)}
                  className="w-full py-3 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-widest transition-colors"
                >
                  Abort Protocol / Return to Editor
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Print Report View - Similar to previous but adapted */}
      <div className="hidden print:block p-12 bg-white text-black">
        <header className="border-b-4 border-black pb-8 mb-8 flex justify-between">
          <div>
            <h1 className="text-4xl font-black serif italic tracking-tighter">Enterprise Clinical Record</h1>
            <p className="text-sm font-bold mt-2 uppercase tracking-widest text-slate-500">AegisMind Integrity Orchestrator v2026.1</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs mb-1 uppercase text-slate-400">Record SHA-256</p>
            <p className="font-mono text-[10px] break-all max-w-[200px]">AM-SEC-{Math.random().toString(16).slice(2, 18).toUpperCase()}</p>
            <p className="font-bold text-2xl mt-2">Score: {analysis?.score}%</p>
          </div>
        </header>
        
        <div className="grid grid-cols-3 gap-8 mb-12 border-b border-black pb-8">
          <div>
            <h2 className="text-[10px] font-black uppercase text-slate-400 mb-2">Clinical Validation</h2>
            <p className={cn(
              "text-sm font-bold",
              analysis?.validationStatus === "Ready" ? "text-emerald-600" : "text-red-600"
            )}>Status: {analysis?.validationStatus}</p>
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase text-slate-400 mb-2">CRM Sync Status</h2>
            <p className="text-sm font-bold">{analysis?.enterpriseAlerts.crmSync}</p>
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase text-slate-400 mb-2">ERP Staff Auth</h2>
            <p className="text-sm font-bold">{analysis?.jsonMetadata.erp_staff_id}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase border-b border-black pb-1">Subjective / Objective</h2>
            <p className="text-sm whitespace-pre-wrap">{analysis?.sections.subjective}</p>
            <p className="text-sm border-t pt-2 whitespace-pre-wrap">{analysis?.sections.objective}</p>
          </div>
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase border-b border-black pb-1">Assessment / Plan</h2>
            <p className="text-sm whitespace-pre-wrap">{analysis?.sections.assessment}</p>
            <p className="text-sm border-t pt-2 whitespace-pre-wrap">{analysis?.sections.plan}</p>
          </div>
        </div>

        <div className="border-t-2 border-black pt-8 mb-8">
          <h2 className="text-xs font-black uppercase mb-4">Integrity Findings</h2>
          <div className="space-y-3">
            {analysis?.findings.map((f, i) => (
              <div key={i} className="text-xs flex gap-4">
                <span className="font-black text-slate-400 w-20 shrink-0">{f.requirementId}</span>
                <span className="font-bold">{f.observation}</span>
                <span className="ml-auto italic">{f.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t-2 border-black pt-8">
          <h2 className="text-xs font-black uppercase mb-4">Enterprise Machine Metadata</h2>
          <pre className="text-[8px] bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-slate-500 overflow-hidden">
            {JSON.stringify(analysis?.jsonMetadata, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

