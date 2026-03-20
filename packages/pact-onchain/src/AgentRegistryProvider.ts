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
import { AgentRegistryABI } from "./abi";

export interface AgentRegistryProviderConfig {
  contractAddress: Address;
  privateKey: `0x${string}`;
  rpcUrl?: string;
  chain?: Chain;
}

export class AgentRegistryProvider {
  private publicClient: PublicClient;
  private walletClient: WalletClient<Transport, Chain, Account>;
  private contractAddress: Address;

  constructor(config: AgentRegistryProviderConfig) {
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

  async registerAgent(params: {
    agentId: string;
    name: string;
    description: string;
  }): Promise<{ txHash: string }> {
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: AgentRegistryABI,
      functionName: "registerAgent",
      args: [params.agentId, params.name, params.description],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return { txHash: hash };
  }

  async getAgent(agentId: string): Promise<{
    agentId: string;
    name: string;
    description: string;
    owner: string;
    registeredAt: bigint;
  }> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: AgentRegistryABI,
      functionName: "getAgent",
      args: [agentId],
    });

    return result as any;
  }

  async isRegistered(agentId: string): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: AgentRegistryABI,
      functionName: "isRegistered",
      args: [agentId],
    })) as boolean;
  }

  async getAgentCount(): Promise<number> {
    const count = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: AgentRegistryABI,
      functionName: "getAgentCount",
    });

    return Number(count);
  }
}
