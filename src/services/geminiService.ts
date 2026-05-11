/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { AuditBlueprint, Evidence, AuditFinding, RiskAnalysis, LiveAnalysis, LogicNudge } from "../types";
import { NSMHS_BLUEPRINT } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Local Lite-Audit (RegEx based fallback for high latency/quota)
export function runLiteAudit(text: string): LiveAnalysis {
  const nudges: LogicNudge[] = [];
  
  if (/medication|script|prescribe|mg|dose/i.test(text)) {
    if (!/consent|side effect|alternative|benefits/i.test(text)) {
      nudges.push({
        status: "Amber",
        reason: "Missing Informed Consent documentation for medications.",
        action: "Ask: Did you discuss the 5 rights of medication with the patient?"
      });
    }
  }

  if (/risk|harm|suicide|death|kill|hurt|means/i.test(text)) {
    if (!/intent|plan|access|means|mitigation/i.test(text)) {
      nudges.push({
        status: "Red",
        reason: "Safety Risk mentioned without intent/plan/means assessment.",
        action: "MANDATORY: Ensure there is a clear 'Intent', 'Plan', and 'Access to Means' assessment."
      });
    }
  }

  return {
    score: nudges.length > 0 ? 70 : 100,
    findings: nudges.map(n => ({
      requirementId: n.status === "Red" ? "NSMHS 2.1" : "NSMHS 1.3",
      status: "fail",
      observation: n.reason,
      standardText: n.action
    })),
    sections: { subjective: "", objective: "", assessment: "", plan: "" },
    isRiskDetected: nudges.some(n => n.status === "Red"),
    riskContext: nudges.find(n => n.status === "Red")?.reason,
    validationStatus: nudges.length > 0 ? "Action Required" : "Ready",
    enterpriseAlerts: { crmSync: "Sync active", erpSync: "Certified" },
    jsonMetadata: { compliance_score: 100, nsmhs_reference: "Local Lite-Audit", erp_staff_id: "EMP-077" },
    nudge: nudges[0] || { status: "None", reason: "", action: "" }
  };
}

// Agent 4/Architect: Real-time Analysis and Smart Decomposition
export async function analyzeLiveNote(text: string): Promise<LiveAnalysis> {
  if (!text.trim() || text.length < 10) {
    return {
      score: 100,
      findings: [],
      sections: { subjective: "", objective: "", assessment: "", plan: "" },
      isRiskDetected: false,
      validationStatus: "Ready",
      enterpriseAlerts: { crmSync: "Sync active", erpSync: "Certified" },
      jsonMetadata: { compliance_score: 100, nsmhs_reference: "N/A", erp_staff_id: "EMP-001" },
      nudge: { status: "None", reason: "", action: "" }
    };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `You are the AegisMind Clinical Orchestrator. Synthesize data for a Clinical Integrity Audit.
    
    ### ACTIVE WORK (Clinical Note):
    "${text}"
    
    ### ORCHESTRATION PROTOCOL:
    1. **Vault Agent**: Map to NSMHS 1.5. Target Standards 1, 2, 8, 10.
    2. **Logic-Nudge Agent**:
       - If "Medication" is mentioned: Check for "Informed Consent", "Side Effects", or "Alternatives". If missing, set status to Amber.
       - If "Risk" is mentioned: Ensure "Intent", "Plan", and "Access to Means" assessment exists. If missing, set status to Red.
    3. **Architect Agent**: 
       - Categorize text into SOAP sections.
       - Calculate Integrity Score.
    
    ### ACCREDITATION RULES:
    - Deduct 30 points for missing suicidal/self-harm ideation assessment when risk is mentioned.
    - Cite NSMHS Standard IDs.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          isRiskDetected: { type: Type.BOOLEAN },
          riskContext: { type: Type.STRING },
          validationStatus: { type: Type.STRING, enum: ["Ready", "Action Required"] },
          enterpriseAlerts: {
            type: Type.OBJECT,
            properties: {
              crmSync: { type: Type.STRING },
              erpSync: { type: Type.STRING }
            },
            required: ["crmSync", "erpSync"]
          },
          jsonMetadata: {
            type: Type.OBJECT,
            properties: {
              compliance_score: { type: Type.NUMBER },
              nsmhs_reference: { type: Type.STRING },
              erp_staff_id: { type: Type.STRING }
            },
            required: ["compliance_score", "nsmhs_reference", "erp_staff_id"]
          },
          nudge: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, enum: ["None", "Amber", "Red"] },
              reason: { type: Type.STRING },
              action: { type: Type.STRING }
            },
            required: ["status", "reason", "action"]
          },
          findings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                requirementId: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["pass", "fail", "partial"] },
                observation: { type: Type.STRING },
                standardText: { type: Type.STRING }
              },
              required: ["requirementId", "status", "observation", "standardText"]
            }
          },
          sections: {
            type: Type.OBJECT,
            properties: {
              subjective: { type: Type.STRING },
              objective: { type: Type.STRING },
              assessment: { type: Type.STRING },
              plan: { type: Type.STRING }
            },
            required: ["subjective", "objective", "assessment", "plan"]
          }
        },
        required: ["score", "isRiskDetected", "findings", "sections", "validationStatus", "enterpriseAlerts", "jsonMetadata", "nudge"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as LiveAnalysis;
  } catch (e) {
    console.error("Live Analysis Agent failed", e);
    throw e;
  }
}

// Agent 1: The NSMHS Librarian (Vault)
// Note: In a real app, this might dynamically fetch standards. Here we use the seeded constants.
export async function runVaultAgent(query: string): Promise<AuditBlueprint> {
  // Simulating deconstruction logic
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Based on the Australian NSMHS 2026, deconstruct these requirements: ${query}. 
    Focus on Standard 2 (Safety) and Standard 10 (Delivery of Care).
    Current seeded blueprint: ${JSON.stringify(NSMHS_BLUEPRINT)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          version: { type: Type.STRING },
          standards: { type: Type.OBJECT }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as AuditBlueprint;
  } catch (e) {
    console.error("Vault Agent failed to parse JSON", e);
    return NSMHS_BLUEPRINT;
  }
}

// Agent 2: The Evidence Auditor (Sleuth)
export async function runSleuthAgent(blueprint: AuditBlueprint, evidence: Evidence[]): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  for (const item of evidence) {
    const prompt = `You are the AegisMind Sleuth Agent. Perform a DEEP CLINICAL INTEGRITY ANALYSIS on the provided evidence.
    
    CRITICAL MANDATE: Do NOT rely on simple word matching. You must evaluate the SUBSTANCE of clinical documentation against the NSMHS 2026 Audit Blueprint.
    
    NSMHS Blueprint: ${JSON.stringify(blueprint)}
    Evidence Type: ${item.type}
    Evidence Content: ${item.type === "text" ? item.content : "[IMAGE ATTACHED]"}
    
    ### REASONING PROTOCOL:
    1. **Deconstruction**: Identify exactly what clinical domains are required by the standard (e.g., MSE requires Mood, Affect, Speech, Thought Content, Thought Process, Perception, Cognition, Insight, Judgment).
    2. **Evidence Extraction**: List what is actually present in the evidence.
    3. **Gap Detection (Deep Reasoning)**: Look for the ABSENCE of specific clinical data. 
       - *Word Matching Trap*: Superficial "Patient is fine" or "No signs of psychosis" are NOT valid risk assessments.
       - *MSE Trap*: Mentioning "speech" or "mood" is INSUFFICIENT if Thought Content (e.g., delusions/ideation) or Insight/Judgment are omitted.
    4. **Determination**: Determine if the evidence represents a high-risk omission.
    
    Logical Trap: Flag any note that provides a "conclusion" without the "clinical findings" to support it under NSMHS 10.4.1.
    Return an array of findings.`;

    const parts: any[] = [{ text: prompt }];
    if (item.type === "image") {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: item.content
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview", // Upgraded to Pro for deeper reasoning
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              requirementId: { type: Type.STRING },
              status: { type: Type.STRING, enum: ["pass", "fail", "partial"] },
              observation: { type: Type.STRING },
              evidenceId: { type: Type.STRING }
            },
            required: ["requirementId", "status", "observation"]
          }
        }
      }
    });

    try {
      const itemFindings = JSON.parse(response.text || "[]");
      findings.push(...itemFindings.map((f: any) => ({ ...f, evidenceId: item.id })));
    } catch (e) {
      console.error("Sleuth Agent failed to parse findings", e);
    }
  }

  return findings;
}

// Agent 3: The Risk & Recovery Strategist (Counsel)
export async function runCounselAgent(findings: AuditFinding[]): Promise<RiskAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `You are the AegisMind Counsel Agent. Analyze these audit findings through the lens of Clinical Risk and NSMHS 2026 Accreditation requirements.
    
    ### RISK ANALYSIS FRAMEWORK:
    - **Inference**: If multiple records show "Missing Thought Content," infer a systemic clinical practice failure rather than a single record error.
    - **Accreditation Impact**: Calculate how these omissions affect the 2026 Audit outcome.
    - **Remediation Theory**: remediation steps must address the CLINICAL BEHAVIOR, not just "sign the form." (e.g., implementing an MSE template for all providers).
    
    ### SPECIFIC FOCUS POINTS:
    1. **Structural Gaps**: Flag the failure to document suicide risk ideation as a "High Accreditation Risk."
    2. **Integrity Gaps**: Missing Informed Consent details for medication is a legal violation under Standard 1.3.
    3. **Clinical Gaps**: Vague documentation is a failure of Standard 10.4.
    
    Findings: ${JSON.stringify(findings)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          accreditationScore: { type: Type.NUMBER },
          totalGaps: { type: Type.NUMBER },
          criticalViolations: { type: Type.ARRAY, items: { type: Type.STRING } },
          remediationPlan: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["accreditationScore", "totalGaps", "criticalViolations", "remediationPlan"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as RiskAnalysis;
  } catch (e) {
    throw new Error("Counsel Agent failed to generate risk analysis");
  }
}
