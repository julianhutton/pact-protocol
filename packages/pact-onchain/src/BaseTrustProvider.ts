import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Account,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { TrustAttestationABI } from "./abi";

export interface BaseTrustProviderConfig {
  contractAddress: Address;
  privateKey: `0x${string}`;
  rpcUrl?: string;
  chain?: Chain;
}

export class BaseTrustProvider {
  private publicClient: PublicClient;
  private walletClient: WalletClient<Transport, Chain, Account>;
  private contractAddress: Address;

  constructor(config: BaseTrustProviderConfig) {
    const chain = config.chain ?? baseSepolia;
    const transport = http(config.rpcUrl ?? "https://sepolia.base.org");

    this.contractAddress = config.contractAddress;

    this.publicClient = createPublicClient({
      chain,
      transport,
    });

    const account = privateKeyToAccount(config.privateKey);
    this.walletClient = createWalletClient({
      chain,
      transport,
      account,
    });
  }

  async recordAttestation(params: {
    agentId: string;
    decisionId: string;
    action: string;
    trustScore: number;
  }): Promise<{ txHash: string }> {
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: TrustAttestationABI,
      functionName: "recordAttestation",
      args: [
        params.agentId,
        params.decisionId,
        params.action,
        BigInt(params.trustScore),
      ],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return { txHash: hash };
  }

  async getTrustScore(agentId: string): Promise<number> {
    const score = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: TrustAttestationABI,
      functionName: "getTrustScore",
      args: [agentId],
    });

    return Number(score);
  }

  async verifyTrust(agentId: string, minScore: number): Promise<boolean> {
    return await this.publicClient.readContract({
      address: this.contractAddress,
      abi: TrustAttestationABI,
      functionName: "verifyTrust",
      args: [agentId, BigInt(minScore)],
    }) as boolean;
  }
}
