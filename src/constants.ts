/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuditBlueprint } from "./types";

export const NSMHS_BLUEPRINT: AuditBlueprint = {
  version: "2026.1-AU",
  standards: {
    "Standard 1": {
      title: "Rights and Responsibilities",
      requirements: [
        {
          id: "1.3",
          standard: "Standard 1",
          criterion: "Criterion 1.3",
          description: "Informed consent must be obtained before treatment and documented, including risks, benefits, and alternatives.",
          evidenceRequired: ["Signed consent forms", "Progress notes detailing consent discussion"]
        }
      ]
    },
    "Standard 2": {
      title: "Safety",
      requirements: [
        {
          id: "2.1",
          standard: "Standard 2",
          criterion: "Criterion 2.1",
          description: "MHS must ensure safety and wellbeing of consumers, carers, and staff.",
          evidenceRequired: ["WHS Policy", "Staff training records", "Traumatic incident procedures"]
        },
        {
          id: "2.8",
          standard: "Standard 2",
          criterion: "Criterion 2.8",
          description: "Sufficient staff to ensure safety; written protocols for alone-working.",
          evidenceRequired: ["Staffing roster", "Alone-worker protocols"]
        },
        {
          id: "2.11",
          standard: "Standard 2",
          criterion: "Criterion 2.11",
          description: "Regular assessments of the environment to mitigate risk of harm.",
          evidenceRequired: ["Environmental risk assessment reports"]
        }
      ]
    },
    "Standard 10": {
      title: "Delivery of Care",
      requirements: [
        {
          id: "10.4.1",
          standard: "Standard 10",
          criterion: "Criterion 10.4.1",
          description: "Clinical assessment includes mental state, physical health, and risk assessment.",
          evidenceRequired: ["Mental State Examination (MSE)", "Physical health review", "Suicide/Risk assessment"]
        },
        {
          id: "10.4.3",
          standard: "Standard 10",
          criterion: "Criterion 10.4.3",
          description: "Evidence that assessments are conducted during first contact and recorded.",
          evidenceRequired: ["Intake intake notes", "First contact record"]
        },
        {
          id: "10.4.8",
          standard: "Standard 10",
          criterion: "Criterion 10.4.8",
          description: "Individual treatment, care and recovery plan developed with consumer/carer.",
          evidenceRequired: ["Signed Care Plan", "Recovery Goals documented"]
        }
      ]
    }
  }
};
