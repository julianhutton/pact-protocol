import { expect } from "chai";
import hre from "hardhat";

describe("AgentRegistry", function () {
  async function deployFixture() {
    const contract = await hre.viem.deployContract("AgentRegistry");
    const [deployer] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    return { contract, deployer, publicClient };
  }

  it("should register an agent and read it back", async function () {
    const { contract } = await deployFixture();

    await contract.write.registerAgent(["agent-1", "Deploy Bot", "Handles production deployments"]);

    const agent = await contract.read.getAgent(["agent-1"]);
    expect(agent.agentId).to.equal("agent-1");
    expect(agent.name).to.equal("Deploy Bot");
    expect(agent.description).to.equal("Handles production deployments");
  });

  it("should track registration status", async function () {
    const { contract } = await deployFixture();

    const beforeReg = await contract.read.isRegistered(["agent-1"]);
    expect(beforeReg).to.be.false;

    await contract.write.registerAgent(["agent-1", "Deploy Bot", "Deploys things"]);

    const afterReg = await contract.read.isRegistered(["agent-1"]);
    expect(afterReg).to.be.true;
  });

  it("should reject duplicate registration", async function () {
    const { contract } = await deployFixture();

    await contract.write.registerAgent(["agent-1", "Deploy Bot", "v1"]);

    try {
      await contract.write.registerAgent(["agent-1", "Deploy Bot", "v2"]);
      expect.fail("Should have reverted");
    } catch (error: any) {
      expect(error.message).to.include("Agent already registered");
    }
  });

  it("should count registered agents", async function () {
    const { contract } = await deployFixture();

    await contract.write.registerAgent(["agent-1", "Bot A", "First"]);
    await contract.write.registerAgent(["agent-2", "Bot B", "Second"]);

    const count = await contract.read.getAgentCount();
    expect(count).to.equal(2n);
  });

  it("should emit AgentRegistered event", async function () {
    const { contract, publicClient } = await deployFixture();

    const hash = await contract.write.registerAgent(["agent-1", "Deploy Bot", "Deploys"]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    expect(receipt.logs.length).to.be.greaterThan(0);
  });
});
