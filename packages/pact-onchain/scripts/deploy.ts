import hre from "hardhat";

async function main() {
  const contractName = process.env.CONTRACT_NAME ?? "TrustAttestation";
  console.log(`Deploying ${contractName} to ${hre.network.name}...`);

  const contract = await hre.viem.deployContract(contractName);

  console.log(`${contractName} deployed to:`, contract.address);

  const explorerUrls: Record<string, string> = {
    baseSepolia: "https://sepolia.basescan.org",
    base: "https://basescan.org",
  };

  const explorer = explorerUrls[hre.network.name];
  if (explorer) {
    console.log(`Explorer: ${explorer}/address/${contract.address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
