import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("TrustAttestation", function () {
  async function deployFixture() {
    const contract = await hre.viem.deployContract("TrustAttestation");
    const [deployer] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    return { contract, deployer, publicClient };
  }

  it("should record an attestation and update trust score", async function () {
    const { contract } = await deployFixture();

    await contract.write.recordAttestation(["agent-1", "decision-1", "approved", 62n]);

    const score = await contract.read.getTrustScore(["agent-1"]);
    expect(score).to.equal(62n);

    const count = await contract.read.getAttestationCount();
    expect(count).to.equal(1n);
  });

  it("should return attestations for an agent", async function () {
    const { contract } = await deployFixture();

    await contract.write.recordAttestation(["agent-1", "decision-1", "approved", 62n]);
    await contract.write.recordAttestation(["agent-1", "decision-2", "approved", 64n]);
    await contract.write.recordAttestation(["agent-2", "decision-3", "rejected", 55n]);

    const agent1Attestations = await contract.read.getAttestations(["agent-1"]);
    expect(agent1Attestations.length).to.equal(2);
    expect(agent1Attestations[1].trustScore).to.equal(64n);
  });

  it("should verify trust against a threshold", async function () {
    const { contract } = await deployFixture();

    await contract.write.recordAttestation(["agent-1", "decision-1", "approved", 62n]);

    const meetsThreshold = await contract.read.verifyTrust(["agent-1", 60n]);
    expect(meetsThreshold).to.be.true;

    const failsThreshold = await contract.read.verifyTrust(["agent-1", 80n]);
    expect(failsThreshold).to.be.false;
  });

  it("should update latest trust score on subsequent attestations", async function () {
    const { contract } = await deployFixture();

    await contract.write.recordAttestation(["agent-1", "decision-1", "approved", 62n]);
    await contract.write.recordAttestation(["agent-1", "decision-2", "approved", 64n]);

    const score = await contract.read.getTrustScore(["agent-1"]);
    expect(score).to.equal(64n);
  });

  it("should emit AttestationRecorded event", async function () {
    const { contract, publicClient } = await deployFixture();

    const hash = await contract.write.recordAttestation(["agent-1", "decision-1", "approved", 62n]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    expect(receipt.logs.length).to.be.greaterThan(0);
  });
});
