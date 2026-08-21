import { Router, type IRouter } from "express";
import {
  GetCustomerRecoveryProfileParams,
  GetLeakageCategoriesResponse,
  GetRecoveryQueueQueryParams,
  GetRecoveryQueueResponse,
  GetRevenueSummaryResponse,
  RunRecoverySimulationBody,
  TriggerChaosDemoBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const money = (value: number) => Math.round(value);

const opportunities = [
  { id: "opp-10482", customerId: "C10482", customer: "Aarav Sharma", amount: 12499, failureReason: "Temporary gateway failure", probability: 0.81, expectedRecovery: 10124, expectedNet: 10120, action: "RETRY AT 7:30 PM", priority: "P1", confidence: 0.87, status: "Ready", retryCount: 1, paymentMethod: "Visa •• 4242" },
  { id: "opp-10931", customerId: "C10931", customer: "Maya Iyer", amount: 2000, failureReason: "Payment method degraded", probability: 0.9, expectedRecovery: 1800, expectedNet: 1796, action: "SWITCH PAYMENT METHOD", priority: "P1", confidence: 0.93, status: "Ready", retryCount: 0, paymentMethod: "RuPay •• 1188" },
  { id: "opp-10177", customerId: "C10177", customer: "Rohan Mehta", amount: 18900, failureReason: "Insufficient funds", probability: 0.43, expectedRecovery: 8127, expectedNet: 8123, action: "RETRY LATER", priority: "P2", confidence: 0.72, status: "Monitoring", retryCount: 1, paymentMethod: "Mastercard •• 9012" },
  { id: "opp-10654", customerId: "C10654", customer: "Nisha Kapoor", amount: 3499, failureReason: "Checkout abandonment", probability: 0.68, expectedRecovery: 2379, expectedNet: 2367, action: "SEND EMAIL", priority: "P2", confidence: 0.78, status: "Ready", retryCount: 0, paymentMethod: "UPI • nisha@okicici" },
  { id: "opp-10303", customerId: "C10303", customer: "Kabir Rao", amount: 27000, failureReason: "Repeated retry failure", probability: 0.12, expectedRecovery: 3240, expectedNet: 3236, action: "ESCALATE TO HUMAN", priority: "P3", confidence: 0.91, status: "Approval needed", retryCount: 2, paymentMethod: "Amex •• 8877" },
  { id: "opp-10886", customerId: "C10886", customer: "Diya Nair", amount: 7999, failureReason: "Overdue invoice", probability: 0.58, expectedRecovery: 4639, expectedNet: 4627, action: "OFFER LIMITED INCENTIVE", priority: "P2", confidence: 0.74, status: "Ready", retryCount: 0, paymentMethod: "Visa •• 7711" },
  { id: "opp-10742", customerId: "C10742", customer: "Vikram Joshi", amount: 4999, failureReason: "Customer opted out", probability: 0.04, expectedRecovery: 200, expectedNet: -12, action: "DO NOTHING", priority: "P4", confidence: 0.98, status: "Stopped", retryCount: 2, paymentMethod: "UPI • vikram@oksbi" },
];

const customerProfiles: Record<string, any> = {
  C10482: { id: "C10482", name: "Aarav Sharma", outstanding: 12499, probability: 0.81, value: "HIGH", behavior: "Usually pays between 6 PM–9 PM", recentFailures: 2, successfulRecoveries: 4, recommendedAction: "RETRY AT 7:30 PM", expectedRecovery: 10124, confidence: 0.87, why: "Customer has historically recovered after evening retries. Previous morning retries failed.", factors: ["72% historical successful retry probability", "4 previous successful recoveries", "Preferred payment window: 6 PM–9 PM", "Morning retries underperform by 38%"] },
  C10931: { id: "C10931", name: "Maya Iyer", outstanding: 2000, probability: 0.9, value: "MEDIUM", behavior: "Completes UPI payments within 4 minutes", recentFailures: 1, successfulRecoveries: 3, recommendedAction: "SWITCH PAYMENT METHOD", expectedRecovery: 1800, confidence: 0.93, why: "The current RuPay token has degraded; prior UPI completions are consistently successful.", factors: ["90% recovery probability", "UPI success rate: 94%", "Current token failed twice in 24 hours"] },
  C10177: { id: "C10177", name: "Rohan Mehta", outstanding: 18900, probability: 0.43, value: "HIGH", behavior: "Pays after salary-cycle reminders", recentFailures: 3, successfulRecoveries: 2, recommendedAction: "RETRY LATER", expectedRecovery: 8127, confidence: 0.72, why: "Insufficient funds are likely temporary; the next positive balance window is tomorrow evening.", factors: ["Salary-cycle correlation detected", "3 recent failures", "Do not contact more than once today"] },
  C10654: { id: "C10654", name: "Nisha Kapoor", outstanding: 3499, probability: 0.68, value: "MEDIUM", behavior: "Fast checkout, abandoned after 90 seconds", recentFailures: 1, successfulRecoveries: 1, recommendedAction: "SEND EMAIL", expectedRecovery: 2379, confidence: 0.78, why: "Checkout abandonment is better addressed with a single contextual reminder than a payment retry.", factors: ["Abandonment duration: 90 seconds", "68% recovery probability", "Email friction cost is below expected net recovery"] },
};

const auditEvents = [
  { id: "evt-1", time: "09:32:11", type: "Payment failed", detail: "Temporary gateway failure", amount: 4999, status: "observed" },
  { id: "evt-2", time: "09:32:12", type: "AI diagnosed", detail: "Retry timing is the dominant recovery lever", amount: 0, status: "diagnosed" },
  { id: "evt-3", time: "09:32:13", type: "Recovery probability", detail: "78% confidence from 8 behavioral features", amount: 0, status: "calculated" },
  { id: "evt-4", time: "09:32:14", type: "Action selected", detail: "Retry at 7:30 PM", amount: 0, status: "selected" },
  { id: "evt-5", time: "09:32:14", type: "Policy check", detail: "Passed: under 2 retries and ₹25,000 cap", amount: 0, status: "passed" },
  { id: "evt-6", time: "09:32:15", type: "Action executed", detail: "SIMULATED RETRY", amount: 4999, status: "simulated" },
  { id: "evt-7", time: "09:32:17", type: "Payment verified", detail: "SUCCESS", amount: 4999, status: "success" },
  { id: "evt-8", time: "09:32:18", type: "Revenue recovered", detail: "Incremental recovery recorded", amount: 4999, status: "recovered" },
  { id: "evt-9", time: "09:32:19", type: "Decision logged", detail: "Explainability record sealed", amount: 0, status: "logged" },
];

router.get("/revenue/summary", (_req, res) => {
  const data = { processed: 3270000, atRisk: 1840000, recoverable: 1170000, recovered: 710000, recoveryRate: 60.7, incremental: 240000, interventionCost: 18400, netRecovered: 691600, transactions: 10000, customers: 1284 };
  res.json(GetRevenueSummaryResponse.parse(data));
});

router.get("/revenue/leakage", (_req, res) => {
  const data = [
    { id: "payment-failure", label: "Payment Failure", lost: 784000, recoverable: 523000, probability: 66.7, share: 42, color: "#e46f4d" },
    { id: "insufficient-funds", label: "Insufficient Funds", lost: 503000, recoverable: 316000, probability: 62.8, share: 27, color: "#d4a84f" },
    { id: "checkout-abandonment", label: "Checkout Abandonment", lost: 351000, recoverable: 222000, probability: 63.2, share: 19, color: "#6b9de2" },
    { id: "unknown", label: "Unknown", lost: 202000, recoverable: 109000, probability: 54, share: 12, color: "#8a8492" },
  ];
  res.json(GetLeakageCategoriesResponse.parse(data));
});

router.get("/revenue/queue", (req, res) => {
  const parsed = GetRecoveryQueueQueryParams.safeParse(req.query);
  const { search = "", status = "" } = parsed.success ? parsed.data : {};
  const filtered = opportunities.filter((item) => {
    const text = `${item.customer} ${item.customerId} ${item.failureReason} ${item.action}`.toLowerCase();
    return text.includes(String(search).toLowerCase()) && (!status || item.status === status);
  });
  res.json(GetRecoveryQueueResponse.parse(filtered));
});

router.get("/revenue/customers/:customerId", (req, res) => {
  const parsed = GetCustomerRecoveryProfileParams.parse(req.params);
  const profile = customerProfiles[parsed.customerId];
  if (!profile) return res.status(404).json({ error: "Customer not found" });
  return res.json(profile);
});

router.post("/revenue/simulator", (req, res) => {
  const input = RunRecoverySimulationBody.parse(req.body);
  const scale = input.transactions / 10000;
  const atRisk = money(1840000 * scale);
  const make = (name: string, recovered: number, cost: number, contacts: number, falseInterventions: number) => ({ name, recovered: money(recovered * scale), rate: Number(((recovered / 1840000) * 100).toFixed(1)), cost: money(cost * scale), contacts: Math.round(contacts * scale), falseInterventions: Math.round(falseInterventions * scale), net: money((recovered - cost) * scale) });
  const baseline1 = make("No intervention", 0, 0, 0, 0);
  const baseline2 = make("Fixed retry", 320000, 38000, 7900, 2200);
  const baseline3 = make("Rule-based", 470000, 29000, 6400, 1500);
  const model = make("Revenue Autopilot", 710000, 18400, 3810, 410);
  res.json({ transactions: input.transactions, atRisk, incremental: model.net - baseline3.net, heldOut: 30, baselines: [baseline1, baseline2, baseline3], model });
});

router.post("/revenue/chaos", (req, res) => {
  const input = TriggerChaosDemoBody.parse(req.body);
  const scenario = input.scenario || "gateway_timeout";
  res.json({ scenario, title: scenario === "confidence_drop" ? "Confidence dropped below action threshold." : "Gateway timeout detected.", action: "DO NOT retry automatically.", status: "ACTION PAUSED", reason: "Payment state is unknown. A bounded agent never acts on an unverifiable outcome.", nextAction: "Require payment-status verification." });
});

router.post("/revenue/demo", (_req, res) => {
  res.json({ recovered: 124800, incremental: 84200, decisions: 37, recoveryRate: 63.4, events: ["Revenue at risk detected", "Leakage diagnosed: temporary payment failures", "C10482 prioritized by expected net recovery", "Recovery probability calculated at 81%", "Retry at 7:30 PM selected", "Guardrail check passed", "Simulated payment recovered", "Audit trail sealed"] });
});

router.get("/revenue/audit", (_req, res) => {
  res.json(auditEvents);
});

export default router;