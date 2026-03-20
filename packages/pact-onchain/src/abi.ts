export const TrustAttestationABI = [
  {
    type: "function",
    name: "recordAttestation",
    inputs: [
      { name: "agentId", type: "string" },
      { name: "decisionId", type: "string" },
      { name: "action", type: "string" },
      { name: "trustScore", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTrustScore",
    inputs: [{ name: "agentId", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyTrust",
    inputs: [
      { name: "agentId", type: "string" },
      { name: "minScore", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAttestations",
    inputs: [{ name: "agentId", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "agentId", type: "string" },
          { name: "decisionId", type: "string" },
          { name: "action", type: "string" },
          { name: "trustScore", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "attester", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAttestationCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AttestationRecorded",
    inputs: [
      { name: "index", type: "uint256", indexed: true },
      { name: "agentId", type: "string", indexed: false },
      { name: "decisionId", type: "string", indexed: false },
      { name: "action", type: "string", indexed: false },
      { name: "trustScore", type: "uint256", indexed: false },
      { name: "attester", type: "address", indexed: false },
    ],
  },
] as const;

export const AgentRegistryABI = [
  {
    type: "function",
    name: "registerAgent",
    inputs: [
      { name: "agentId", type: "string" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "agentId", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "agentId", type: "string" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "owner", type: "address" },
          { name: "registeredAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isRegistered",
    inputs: [{ name: "agentId", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
    ],
  },
] as const;
