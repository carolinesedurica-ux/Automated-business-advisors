/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AuditRequirement {
  id: string;
  standard: string;
  criterion: string;
  description: string;
  evidenceRequired: string[];
}

export interface AuditBlueprint {
  version: string;
  standards: {
    [key: string]: {
      title: string;
      requirements: AuditRequirement[];
    };
  };
}

export interface Evidence {
  id: string;
  type: "text" | "image";
  content: string;
  fileName?: string;
  timestamp: number;
}

export interface AuditFinding {
  requirementId: string;
  status: "pass" | "fail" | "partial";
  observation: string;
  evidenceId?: string;
  standardText?: string;
}

export interface RiskAnalysis {
  accreditationScore: number;
  totalGaps: number;
  criticalViolations: string[];
  remediationPlan: string[];
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "idle" | "working" | "complete" | "error";
  output?: any;
}

export interface LogicNudge {
  status: "Amber" | "Red" | "None";
  reason: string;
  action: string;
}

export interface LiveAnalysis {
  score: number;
  findings: AuditFinding[];
  sections: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  isRiskDetected: boolean;
  riskContext?: string;
  enterpriseAlerts: {
    crmSync: string;
    erpSync: string;
  };
  validationStatus: "Ready" | "Action Required";
  jsonMetadata: {
    compliance_score: number;
    nsmhs_reference: string;
    erp_staff_id: string;
  };
  nudge?: LogicNudge;
  noteHash?: string;
}

export interface ClinicianCredential {
  id: string;
  name: string;
  expiryDate: string;
  status: "Active" | "Expired" | "Pending Renewal";
}

export interface ClinicianProfile {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  credentials: ClinicianCredential[];
  settings: {
    darkMode: boolean;
    autoSave: boolean;
    notifications: boolean;
  };
}
